// Read-only Solana Devnet RPC probe. No keys, signing or sendTransaction.
export const DEVNET_RPC='https://api.devnet.solana.com';
export async function inspectDevnet(fetchImpl=fetch,url=DEVNET_RPC){
 if(url!==DEVNET_RPC)throw Error('devnet-only');
 const call=async(method,params=[])=>{
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:method,method,params})});
  if(!response.ok)throw Error('rpc-http-error');
  const data=await response.json();
  if(data.error||data.result===undefined)throw Error('rpc-response-error');
  return data.result;
 };
 const [genesisHash,slot,version]=await Promise.all([call('getGenesisHash'),call('getSlot',[{commitment:'confirmed'}]),call('getVersion')]);
 return {network:'devnet',genesisHash,slot,version,readOnly:true,transfersEnabled:false};
}
