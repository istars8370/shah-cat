import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { airdropAPI } from './airdrop-api.mjs';

async function serve(getStore,getTreasuryStore){
  const server=http.createServer((req,res)=>airdropAPI(req,res,getStore,getTreasuryStore).catch(error=>{
    res.writeHead(error.status||500,{'content-type':'application/json'});
    res.end(JSON.stringify({error:error.message}));
  }));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {port}=server.address();
  return {base:'http://127.0.0.1:'+port,port,close:()=>new Promise(resolve=>server.close(resolve))};
}

test('admin bridge creates pending Treasury requests without transaction execution',async()=>{
  const prior=process.env.AIRDROP_ADMIN_TOKEN;
  process.env.AIRDROP_ADMIN_TOKEN='abcdefghijklmnopqrstuvwxyz123456';
  let created=false;
  const draft={
    batchId:'airdrop-0123456789abcdef',
    payoutCount:1,
    requests:[{
      kind:'spend',purpose:'Genesis Community Airdrop reward',
      evidence:'[airdrop-batch:airdrop-0123456789abcdef] Airdrop v0.1 approved application: member-a',
      amountRaw:'1000000000',feeCapLamports:'5000',
      startsAt:'2026-11-01T00:00:00.000Z',expiresAt:'2026-11-30T00:00:00.000Z',
      recipient:'3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs',conflicts:[],budgetId:'budget-1'
    }]
  };
  const store={devnetBatchDraft:()=>draft};
  const treasury={createBatch:async(batchId,requests)=>{
    assert.equal(batchId,draft.batchId); assert.equal(requests.length,1);
    if(created)return {batchId,created:false,requests:[{id:'req-1',status:'pending',content:requests[0]}]};
    created=true;return {batchId,created:true,requests:[{id:'req-1',status:'pending',content:requests[0]}]};
  }};
  const s=await serve(async()=>store,async()=>treasury);
  try{
    const headers={
      origin:'http://127.0.0.1:'+s.port,
      authorization:'Bearer abcdefghijklmnopqrstuvwxyz123456',
      'content-type':'application/json'
    };
    const first=await fetch(s.base+'/api/airdrop/treasury-create',{method:'POST',headers,body:'{}'});
    assert.equal(first.status,201);
    const a=await first.json();
    assert.equal(a.created,true);
    assert.equal(a.requestCount,1);
    assert.equal(a.transactionCreated,false);
    assert.equal(a.signed,false);
    assert.equal(a.broadcast,false);

    const second=await fetch(s.base+'/api/airdrop/treasury-create',{method:'POST',headers,body:'{}'});
    assert.equal(second.status,200);
    const b=await second.json();
    assert.equal(b.created,false);
    assert.equal(b.requests[0].id,'req-1');
  }finally{
    await s.close();
    if(prior===undefined)delete process.env.AIRDROP_ADMIN_TOKEN;else process.env.AIRDROP_ADMIN_TOKEN=prior;
  }
});

test('Treasury creation bridge rejects missing admin bearer token',async()=>{
  const prior=process.env.AIRDROP_ADMIN_TOKEN;
  process.env.AIRDROP_ADMIN_TOKEN='abcdefghijklmnopqrstuvwxyz123456';
  const store={devnetBatchDraft:()=>({batchId:'airdrop-0123456789abcdef',payoutCount:1,requests:[{}]})};
  const treasury={createBatch:async()=>{throw Error('must not run');}};
  const s=await serve(async()=>store,async()=>treasury);
  try{
    const r=await fetch(s.base+'/api/airdrop/treasury-create',{
      method:'POST',
      headers:{origin:'http://127.0.0.1:'+s.port,'content-type':'application/json'},
      body:'{}'
    });
    assert.equal(r.status,403);
  }finally{
    await s.close();
    if(prior===undefined)delete process.env.AIRDROP_ADMIN_TOKEN;else process.env.AIRDROP_ADMIN_TOKEN=prior;
  }
});
