// Verifies an existing Solana Devnet signature. Never signs or broadcasts.
import {DEVNET_RPC} from './devnet-readonly.mjs';
const B58=/^[1-9A-HJ-NP-Za-km-z]{80,90}$/;
export async function verifyDevnetReceipt(signature,{fetchImpl=fetch,rpcUrl=DEVNET_RPC}={}){
 if(rpcUrl!==DEVNET_RPC)throw Error('devnet-only');
 if(typeof signature!=='string'||!B58.test(signature))throw Error('invalid-signature-format');
 const call=async(method,params)=>{
  const r=await fetchImpl(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:method,method,params})});
  if(!r.ok)throw Error('rpc-http-error');
  const j=await r.json();if(j.error)throw Error('rpc-error');return j.result;
 };
 const status=await call('getSignatureStatuses',[[signature],{searchTransactionHistory:true}]);
 const item=status?.value?.[0];
 if(!item)return {verified:false,reason:'not-found'};
 if(item.err)return {verified:false,reason:'transaction-failed',error:item.err};
 if(item.confirmationStatus!=='finalized')return {verified:false,reason:'not-finalized',status:item.confirmationStatus};
 const tx=await call('getTransaction',[signature,{encoding:'json',commitment:'finalized',maxSupportedTransactionVersion:0}]);
 if(!tx||tx.meta?.err)return {verified:false,reason:'transaction-unavailable-or-failed'};
 return {verified:true,signature,slot:tx.slot,feeLamports:tx.meta?.fee??null,network:'devnet',warning:'RPC receipt alone does not prove Guardian authorization or program security'};
}
