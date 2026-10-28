import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ShahCat from '../dashboard/shared.js';
import {createWalletRequestHandler} from './server.mjs';
const require=createRequire(import.meta.url);
const M=require('./multichain-registry.js');
const address='0x1111111111111111111111111111111111111111';
function consentView(){
  const elements=new Map(),pending=[],events={};
  const element=id=>{
    if(!elements.has(id))elements.set(id,{value:id==='mcNetwork'?'ethereum':'',disabled:false,textContent:'',className:'',
      addEventListener(type,fn){this[type]=fn;},replaceChildren(){},append(){}});
    return elements.get(id);
  };
  const window={ethereum:{request:({method})=>{
    assert.equal(method,'eth_requestAccounts');
    return new Promise((resolve,reject)=>pending.push({resolve,reject}));
  }},addEventListener(type,fn){events[type]=fn;}};
  const document={getElementById:element,createElement:()=>({append(){}})};
  vm.runInNewContext(readFileSync(new URL('./multichain-ui.js',import.meta.url),'utf8'),
    {window,document,ShahMultiChains:M,ShahCat,URLSearchParams,fetch:()=>assert.fail('unexpected network')});
  return {element,pending,events};
}
test('a superseded consent cannot reset the newer pending button or address',async()=>{
  const {element,pending}=consentView();
  const old=element('mcConnectEvm').click();
  element('mcNetwork').value='base';element('mcNetwork').change();
  const current=element('mcConnectEvm').click();
  const notice=element('mcNotice').textContent;
  pending[0].resolve([address]);await old;
  assert.equal(element('mcConnectEvm').disabled,true);
  assert.equal(element('mcAddress').value,'');
  assert.equal(element('mcNotice').textContent,notice);
  pending[1].resolve([address]);await current;
  assert.equal(element('mcAddress').value,address);
  assert.equal(element('mcConnectEvm').disabled,false);
});
test('leaving and returning to the original chain does not revive stale consent',async()=>{
  const {element,pending}=consentView();
  const task=element('mcConnectEvm').click();
  for(const chain of ['base','ethereum']){element('mcNetwork').value=chain;element('mcNetwork').change();}
  pending[0].resolve([address]);await task;
  assert.equal(element('mcAddress').value,'');
});
test('page exit invalidates pending consent before it can mutate the view',async()=>{
  const {element,pending,events}=consentView();
  const task=element('mcConnectEvm').click();
  events.pagehide();
  const notice=element('mcNotice').textContent;
  pending[0].resolve([address]);await task;
  assert.equal(element('mcAddress').value,'');
  assert.equal(element('mcNotice').textContent,notice);
  assert.equal(element('mcConnectEvm').disabled,false);
});
test('wallet history never reflects transport or validation exception messages',async()=>{
  const publicAddress='3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs';
  for(const [given,expected] of [[undefined,502],[500,502],[409,409],[400,400]]){
    const handler=createWalletRequestHandler(async()=>{
      throw Object.assign(Error('SYNTHETIC_PRIVATE_RPC_DETAIL'),{status:given});
    });
    const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};
    await handler({method:'GET',url:'/api/wallet-history?address='+publicAddress},res);
    assert.equal(res.status,expected);
    assert.doesNotMatch(res.body,/SYNTHETIC_PRIVATE_RPC_DETAIL/);
    assert.equal(res.headers['cache-control'],'no-store');
  }
});
