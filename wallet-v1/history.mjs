// SHAH Wallet 1.0: bounded, read-only and non-exhaustive Devnet SHAH transaction history.
// Does not sign, submit, create accounts, or expose any wallet secret.
import ShahCat from "../dashboard/shared.js";
const { MINT, DECIMALS, DEVNET_GENESIS, isPublicKey, rawAmount, amount } = ShahCat;
function bad(message,status=400){const error=Error(message);error.status=status;return error;}
function deltaFor(balances,address){
  if(!Array.isArray(balances))return 0n;
  return balances.filter(x=>x?.mint===MINT && x?.owner===address).reduce((sum,item)=>{
    const token=item.uiTokenAmount;
    if(token?.decimals!==DECIMALS)throw bad("SHAH history token precision mismatch",409);
    return sum+rawAmount(token.amount);
  },0n);
}
export async function walletHistory(address,query){
  if(!isPublicKey(address))throw bad("Invalid Solana wallet address");
  if(typeof query!=="function")throw Error("RPC query required");
  if(await query("getGenesisHash",[])!==DEVNET_GENESIS)throw bad("Only Solana Devnet history is supported",409);
  const accounts=await query("getTokenAccountsByOwner",[
    address,{mint:MINT},{encoding:"jsonParsed",commitment:"confirmed"},
  ]);
  if(!Array.isArray(accounts?.value))throw Error("Invalid token-account history response");
  if(accounts.value.length>8)throw bad("Too many SHA​H token accounts to safely scan; use Explorer",409);
  const addresses=accounts.value.map(x=>x.pubkey);
  if(addresses.some(x=>!isPublicKey(x)))throw Error("Invalid token-account response");
  const map=new Map();
  for(const tokenAccount of addresses){
    const list=await query("getSignaturesForAddress",[
      tokenAccount,{limit:12,commitment:"confirmed"},
    ]);
    if(!Array.isArray(list))throw Error("Invalid recent-signatures response");
    for(const row of list){
      if(typeof row?.signature!=="string" || row.err)continue;
      if(!map.has(row.signature))map.set(row.signature,row);
    }
  }
  const candidates=[...map.values()]
    .sort((a,b)=>(b.blockTime||0)-(a.blockTime||0))
    .slice(0,12);
  const transactions=[];
  for(const candidate of candidates){
    const tx=await query("getTransaction",[
      candidate.signature,{encoding:"jsonParsed",maxSupportedTransactionVersion:0,commitment:"confirmed"},
    ]);
    if(!tx?.meta || tx.meta.err)continue;
    const before=deltaFor(tx.meta.preTokenBalances,address);
    const after=deltaFor(tx.meta.postTokenBalances,address);
    const delta=after-before;
    const time=tx.blockTime||candidate.blockTime;
    if(delta===0n || !Number.isSafeInteger(time) || time<=0)continue;
    const value=delta<0n?-delta:delta;
    transactions.push({
      signature:candidate.signature,
      direction:delta>0n?"입금":"출금",
      rawAmount:String(value),
      amount:amount(value),
      timestamp:new Date(time*1000).toISOString(),
    });
  }
  return {
    network:"devnet",mint:MINT,address,limited:true,checkedAt:new Date().toISOString(),
    scannedTokenAccounts:addresses.length,scannedSignatures:candidates.length,
    limitations:"Only recent transactions of currently existing SHAH token accounts; complex transfers and closed accounts may be absent",
    transactions,
  };
}
