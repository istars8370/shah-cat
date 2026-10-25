// In-memory replay guard for research tests. Not durable or on-chain.
import {evaluateAdaptivePolicy} from './adaptive-policy.mjs';
const fail=reason=>({ok:false,reason});
export class ReplayGuard {
  constructor(){this.used=new Set();this.pending=new Set();}
  key(request){return JSON.stringify([request.network,request.program,request.account,request.nonce]);}
  async evaluate(request,context,evidence,commit=async()=>true){
    const key=this.key(request);
    if(this.used.has(key)||this.pending.has(key))return fail('replay');
    this.pending.add(key);
    try{
      const decision=evaluateAdaptivePolicy(request,{...context,usedNonces:new Set([...context.usedNonces,request.nonce].filter(n=>n!==request.nonce))},evidence);
      if(!decision.ok)return decision;
      // Commit is a research callback, not a blockchain transaction.
      if(await commit(request,decision)!==true)return fail('commit-failed');
      this.used.add(key);
      return {...decision,nonceConsumed:true};
    }catch{return fail('commit-error');}
    finally{this.pending.delete(key);}
  }
}
