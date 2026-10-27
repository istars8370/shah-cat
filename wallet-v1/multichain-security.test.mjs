import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {queryReadOnly,readMultiChainBalance} from "./multichain.mjs";
import {createWalletRequestHandler} from "./server.mjs";
const require=createRequire(import.meta.url);
const M=require("./multichain-registry.js");
const chain=M.getChain("ethereum");
const address="0x1111111111111111111111111111111111111111";
const response=payload=>({ok:true,text:async()=>JSON.stringify(payload)});

for(const [name,mutate] of [
  ["wrong version",p=>({...p,jsonrpc:"1.0"})],
  ["wrong ID",p=>({...p,id:p.id+1})],
  ["string ID",p=>({...p,id:String(p.id)})],
  ["missing ID",p=>({jsonrpc:p.jsonrpc,result:p.result})],
  ["result and error",p=>({...p,error:{message:"synthetic-private-marker"}})],
  ["null error",p=>({...p,error:null})],
  ["missing result",p=>({jsonrpc:p.jsonrpc,id:p.id})],
  ["null result",p=>({...p,result:null})],
  ["array",p=>[p]],
  ["null",()=>null],
]){
  test("multichain rejects RPC envelope: "+name,async()=>{
    await assert.rejects(queryReadOnly(chain,"eth_chainId",[],async(url,opts)=>{
      const {id}=JSON.parse(opts.body);
      return response(mutate({jsonrpc:"2.0",id,result:"0x1"}));
    }),/Invalid RPC response/);
  });
}

test("concurrent RPC responses are bound to their own request IDs",async()=>{
  const pending=[];
  const fetcher=(url,opts)=>new Promise(resolve=>pending.push({id:JSON.parse(opts.body).id,resolve}));
  const first=queryReadOnly(chain,"eth_chainId",[],fetcher);
  const second=queryReadOnly(chain,"eth_chainId",[],fetcher);
  assert.notEqual(pending[0].id,pending[1].id);
  pending[1].resolve(response({jsonrpc:"2.0",id:pending[1].id,result:"0x2"}));
  pending[0].resolve(response({jsonrpc:"2.0",id:pending[0].id,result:"0x1"}));
  assert.deepEqual(await Promise.all([first,second]),["0x1","0x2"]);
});

test("fixed RPC endpoints cannot be replaced or redirected",async()=>{
  let calls=0;
  const fetcher=async(url,opts)=>{
    calls++;
    assert.equal(url,chain.rpc);
    assert.equal(opts.redirect,"error");
    return response({jsonrpc:"2.0",id:JSON.parse(opts.body).id,result:"0x1"});
  };
  await assert.rejects(queryReadOnly({...chain,rpc:"http://127.0.0.1"},"eth_chainId",[],fetcher),/Unregistered/);
  assert.equal(calls,0);
  assert.equal(await queryReadOnly(chain,"eth_chainId",[],fetcher),"0x1");
});

test("transport, HTTP, JSON and oversized replies fail without reflecting external errors",async()=>{
  const marker="synthetic-private-marker";
  for(const fetcher of [
    async()=>{throw Error(marker);},
    async()=>({ok:false,status:502,text:async()=>marker}),
    async()=>({ok:true,text:async()=>marker}),
    async()=>({ok:true,text:async()=>" ".repeat(2_000_001)}),
  ]){
    await assert.rejects(queryReadOnly(chain,"eth_chainId",[],fetcher),error=>!error.message.includes(marker));
  }
});

test("multichain HTTP errors preserve status but never echo upstream messages",async()=>{
  for(const [status,expected] of [[400,400],[409,409],[500,502],[undefined,502]]){
    const handler=createWalletRequestHandler(undefined,async()=>assert.fail("core"),async()=>{
      const e=Error("synthetic-private-marker");e.status=status;throw e;
    });
    const res={writeHead(code,headers){this.code=code;this.headers=headers;},end(body){this.body=body;}};
    await handler({method:"GET",url:"/api/multichain?chain=ethereum&address="+address},res);
    assert.equal(res.code,expected);
    assert.doesNotMatch(res.body,/synthetic-private-marker/);
    assert.equal(res.headers["cache-control"],"no-store");
  }
});

test("invalid EVM address fails as client error before any RPC",async()=>{
  await assert.rejects(readMultiChainBalance("ethereum","invalid",async()=>assert.fail("RPC")),e=>e.status===400);
});

test("new browser assets are served only through explicit static paths",async()=>{
  const handler=createWalletRequestHandler(undefined,async(req,res)=>{res.writeHead(404);res.end("Missing");});
  for(const [url,expected] of [["/multichain-registry.js",200],["/multichain-ui.js",200],["/multichain.mjs",404],["/../wallet-v1/multichain.mjs",404]]){
    const res={writeHead(code){this.code=code;},end(){}};
    await handler({method:"GET",url},res);
    assert.equal(res.code,expected,url);
  }
});
