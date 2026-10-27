import { airdropReadiness } from '../dashboard/airdrop-readiness.mjs';

const result=airdropReadiness(process.env);
console.log(JSON.stringify(result,null,2));
if(!result.ready){
  console.error('Airdrop runtime configuration is not ready.');
  process.exitCode=1;
}
