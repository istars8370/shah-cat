// SHAH Wallet 1.1 — read-only Mainnet portfolio query.
// Fixed-chain RPC URLs, pinned token contracts, no wallet keys, signing,
// transaction simulation or broadcasts. Mainnet view is separate from SHAH Devnet.
import {createRequire} from "node:module";
import ShahCat from "../dashboard/shared.js";
const require=createRequire(import.meta.url);
const registry=require("./multichain-registry.js");
const {getChain,formatUnits,parseEvmAddress}=registry;
const SOL_TOKEN_PROGRAM="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const MAX_ERC20=(1n<<256n)-1n;
const MAX_SPL=(1n<<64n)-1n;
const READ_METHODS=new Set(["eth_chainId","eth_getBalance","eth_call","getGenesisHash","getBalance","getTokenAccountsByOwner"]);
let sequence=0;
function invalid(message,status=400){const e=Error(message);e.status=status;return e;}
export async function queryReadOnly(chain,method,params=[],fetcher=fetch){
  if(!READ_METHODS.has(method))throw invalid("RPC method not allowed in read-only wallet",400);
  const permitted=chain.kind==="evm"?method.startsWith("eth_"):!method.startsWith("eth_");
  if(!permitted)throw invalid("RPC method not valid for requested chain",400);
  const response=await fetcher(chain.rpc,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:++sequence,method,params}),
    signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)throw Error("Public "+chain.label+" RPC HTTP "+response.status);
  // Public RPC can be unreliable, but must never fall back to another chain.
  const text=await response.text();
  if(text.length>2_000_000)throw Error("Oversized RPC reply");
  const payload=JSON.parse(text);
  if(payload.error)throw Error("Public "+chain.label+" RPC rejected "+method);
  if(!Object.hasOwn(payload,"result")||payload.result===null||payload.result===undefined)throw Error("Invalid RPC result for "+method);
  return payload.result;
}
function hexUInt(raw,max=MAX_ERC20){
  if(typeof raw!=="string"||!/^0x(?:0|[0-9a-fA-F]+)$/.test(raw))throw Error("Malformed EVM RPC integer");
  const n=BigInt(raw);
  if(n<0n||n>max)throw Error("Out-of-range EVM RPC integer");
  return n;
}
function splUInt(raw){
  if(typeof raw!=="string"||!/^(?:0|[1-9][0-9]*)$/.test(raw))throw Error("Malformed Solana token amount");
  const n=BigInt(raw);
  if(n>MAX_SPL)throw Error("Out-of-range Solana token amount");
  return n;
}
function asset(asset,raw){
  return {
    id:asset.id,symbol:asset.symbol,decimals:asset.decimals,
    issuer:asset.issuer||null,
    contract:asset.contract||null,mint:asset.mint||null,
    rawAmount:raw.toString(),amount:formatUnits(raw,asset.decimals),
  };
}
function approveAddress(chain,address){
  if(chain.kind==="evm")return parseEvmAddress(address);
  if(typeof address!=="string"||!ShahCat.isPublicKey(address))throw invalid("올바른 Solana 공개 주소가 필요합니다.");
  return address;
}
export async function readMultiChainBalance(chainName,address,query=queryReadOnly){
  const chain=getChain(chainName);
  const wallet=approveAddress(chain,address);
  if(typeof query!=="function")throw Error("RPC query required");
  const assets=[];
  if(chain.kind==="evm"){
    const reported=hexUInt(await query(chain,"eth_chainId",[]),MAX_ERC20);
    if(reported!==BigInt(chain.chainId))throw invalid("RPC 네트워크 Chain ID가 일치하지 않아 조회를 차단했습니다.",409);
    const nativeRaw=hexUInt(await query(chain,"eth_getBalance",[wallet,"latest"]));
    assets.push(asset(chain.native,nativeRaw));
    const callAddress="0x70a08231"+wallet.slice(2).padStart(64,"0");
    for(const token of chain.tokens){
      const raw=await query(chain,"eth_call",[{to:token.contract,data:callAddress},"latest"]);
      if(typeof raw!=="string"||!/^0x[0-9a-fA-F]{64}$/.test(raw)){
        throw Error("ERC-20 balanceOf response is not 32 bytes for "+token.symbol);
      }
      assets.push(asset(token,hexUInt(raw)));
    }
  }else{
    const genesis=await query(chain,"getGenesisHash",[]);
    if(genesis!==chain.genesis)throw invalid("Solana Mainnet genesis 불일치: Devnet과 자산을 혼합하지 않습니다.",409);
    const native=await query(chain,"getBalance",[wallet,{commitment:"confirmed"}]);
    const lamports=native?.value;
    if(!Number.isSafeInteger(lamports)||lamports<0)throw Error("Invalid Solana mainnet SOL balance");
    assets.push(asset(chain.native,BigInt(lamports)));
    for(const token of chain.tokens){
      const response=await query(chain,"getTokenAccountsByOwner",[
        wallet,{mint:token.mint},{encoding:"jsonParsed",commitment:"confirmed"},
      ]);
      if(!Array.isArray(response?.value)||response.value.length>64)throw Error("Invalid Solana token-account response");
      let total=0n;
      for(const entry of response.value){
        const record=entry?.account;
        const parsed=record?.data?.parsed;
        const info=parsed?.info;
        if(record?.owner!==SOL_TOKEN_PROGRAM||parsed?.type!=="account"||
          info?.mint!==token.mint||info?.owner!==wallet||
          info?.tokenAmount?.decimals!==token.decimals) {
          throw Error("Solana token account owner/mint/decimals mismatch for "+token.symbol);
        }
        total+=splUInt(info.tokenAmount.amount);
      }
      assets.push(asset(token,total));
    }
  }
  return {
    network:"mainnet",chain:chain.id,label:chain.label,kind:chain.kind,
    chainId:chain.chainId||null,address:wallet,assets,
    checkedAt:new Date().toISOString(),readOnly:true,
    walletSigningEnabled:false,broadcastingEnabled:false,
    notice:"Public RPC mainnet account balances may have real value. Viewing does not grant transfer authority.",
  };
}
