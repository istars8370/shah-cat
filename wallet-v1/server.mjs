// SHAH Wallet 1.0 standalone localhost server.
// Reuses vetted Dashboard read-only RPC endpoints. No signing or writes.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ShahCat from "../dashboard/shared.js";
import { createRequestHandler } from "../dashboard/server.mjs";
import { walletHistory } from "./history.mjs";
import { readMultiChainBalance } from "./multichain.mjs";

const here=dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||4184);
const RPC=process.env.SOLANA_RPC_URL||ShahCat.NETWORK.rpcUrl;
const ALLOWED=new Set(["getGenesisHash","getTokenAccountsByOwner","getSignaturesForAddress","getTransaction"]);
let rpcId=0;
async function rpc(method,params=[]){
  if(!ALLOWED.has(method))throw Error("Disallowed history RPC method: "+method);
  const response=await fetch(RPC,{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:++rpcId,method,params}),
    signal:AbortSignal.timeout(15000),
  });
  if(!response.ok)throw Error("Devnet RPC HTTP "+response.status);
  const body=await response.json();
  if(body.error)throw Error(body.error.message||"RPC error");
  if(!Object.hasOwn(body,"result"))throw Error("Missing RPC result");
  return body.result;
}
function send(res,status,type,body){
  res.writeHead(status,{
    "content-type":type,"cache-control":"no-store",
    "x-content-type-options":"nosniff","referrer-policy":"no-referrer",
    "x-frame-options":"DENY",
    "content-security-policy":"default-src 'none';script-src 'self';style-src 'self';img-src 'self';connect-src 'self';base-uri 'none';form-action 'none';frame-ancestors 'none'",
  });
  res.end(body);
}
const staticRoutes=new Map([
  ["/",["index.html","text/html; charset=utf-8"]],
  ["/index.html",["index.html","text/html; charset=utf-8"]],
  ["/wallet-v1.css",["wallet.css","text/css; charset=utf-8"]],
  ["/wallet-v1.js",["wallet.js","text/javascript; charset=utf-8"]],
  ["/wallet-v1-model.js",["model.js","text/javascript; charset=utf-8"]],
  ["/multichain-registry.js",["multichain-registry.js","text/javascript; charset=utf-8"]],
  ["/multichain-ui.js",["multichain-ui.js","text/javascript; charset=utf-8"]],
]);
export function createWalletRequestHandler(query=rpc,core=createRequestHandler(),multichain=readMultiChainBalance){
  return async(req,res)=>{
    if(req.method!=="GET")return send(res,405,"text/plain; charset=utf-8","Method not allowed");
    const path=(req.url||"/").split("?")[0];
    if(path==="/api/multichain"){
      try{
        const input=new URL(req.url,"http://127.0.0.1");
        const chain=input.searchParams.get("chain")||"";
        const address=input.searchParams.get("address")||"";
        return send(res,200,"application/json; charset=utf-8",
          JSON.stringify(await multichain(chain,address)));
      }catch(error){
        return send(res,[400,409].includes(error.status)?error.status:502,
          "application/json; charset=utf-8",JSON.stringify({error:error.message||"Mainnet lookup failed"}));
      }
    }
    if(path==="/api/wallet-history"){
      try{
        const address=new URL(req.url,"http://127.0.0.1").searchParams.get("address")||"";
        return send(res,200,"application/json; charset=utf-8",JSON.stringify(await walletHistory(address,query)));
      }catch(error){
        return send(res,[400,409].includes(error.status)?error.status:502,
          "application/json; charset=utf-8",JSON.stringify({error:error.message||"History error"}));
      }
    }
    if(path==="/dashboard"){
      // Dashboard has its own CSP/script policy; serve through its established
      // handler instead of applying the standalone wallet's strict CSP.
      return core({method:req.method,url:"/"},res);
    }
    if(staticRoutes.has(path)){
      const [file,type]=staticRoutes.get(path);
      try{return send(res,200,type,await readFile(join(here,file),"utf8"));}
      catch{return send(res,502,"text/plain; charset=utf-8","Wallet file unavailable");}
    }
    return core(req,res);
  };
}
const server=http.createServer(createWalletRequestHandler());
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  server.listen(PORT,"127.0.0.1",()=>console.log("SHAH Wallet 1.0 RC: http://127.0.0.1:"+PORT));
}
