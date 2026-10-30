(()=>{'use strict';
const $=id=>document.getElementById(id);
const saved=sessionStorage.getItem('shah-airdrop-admin-token')||'';
if($('adminToken')) $('adminToken').value=saved;
function adminHeaders(){
  const token=$('adminToken')?.value.trim()||'';
  if(token) sessionStorage.setItem('shah-airdrop-admin-token',token);
  return token?{authorization:'Bearer '+token}:{};
}
async function load(){
  const r=await fetch('/api/airdrop',{cache:'no-store'});
  const d=await r.json();
  if(!r.ok)throw Error(d.error||'조회 실패');
  $('message').textContent=d.enabled?'Airdrop v0.1 활성 · 자동 송금 없음':d.message;
  $('total').textContent=d.total??0;
  $('pass').textContent=d.counts?.PASS??0;
  $('review').textContent=d.counts?.REVIEW??0;
  $('reject').textContent=d.counts?.REJECT??0;
  $('rows').replaceChildren(...(d.applications||[]).slice().reverse().map(x=>{
    const tr=document.createElement('tr');
    for(const v of [x.createdAt,x.communityId||x.id,(x.wallet||'—').slice(0,8)+(x.wallet?'…':''),x.score,x.status,x.reason]){
      const td=document.createElement('td');td.textContent=String(v);tr.append(td);
    }
    const action=document.createElement('td');
    if(x.status==='REVIEW'){
      const approve=document.createElement('button');approve.type='button';approve.className='button button-mint';approve.textContent='승인';
      const reject=document.createElement('button');reject.type='button';reject.className='button button-quiet';reject.textContent='거절';
      approve.addEventListener('click',()=>review(x.id,'approve'));
      reject.addEventListener('click',()=>review(x.id,'reject'));
      action.append(approve,reject);
    }else action.textContent='—';
    tr.append(action);
    return tr;
  }));
}
async function review(id,decision){
  const note=prompt(decision==='approve'?'승인 메모를 입력하세요.':'거절 사유를 입력하세요.');
  if(!note)return;
  const r=await fetch('/api/airdrop/review',{method:'POST',headers:{'content-type':'application/json',...adminHeaders()},body:JSON.stringify({id,decision,note})});
  const d=await r.json();
  if(!r.ok)throw Error(d.error||'심사 저장 실패');
  $('message').textContent=decision==='approve'?'승인 결정이 원장에 기록되었습니다.':'거절 결정이 원장에 기록되었습니다.';
  await load();
}
async function showPlan(){
  const r=await fetch('/api/airdrop/proposal',{headers:adminHeaders()});const d=await r.json();
  if(!r.ok)throw Error(d.error||'지급안 조회 실패');
  $('plan').textContent=JSON.stringify(d,null,2);
}
async function exportJson(){
  const r=await fetch('/api/airdrop/treasury-export',{headers:adminHeaders()});const d=await r.json();
  if(!r.ok)throw Error(d.error||'내보내기 실패');
  const url=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='SHAH_CAT_Airdrop_Treasury_Proposal.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('refresh').addEventListener('click',()=>load().catch(e=>$('message').textContent=e.message));
$('proposal').addEventListener('click',()=>showPlan().catch(e=>$('message').textContent=e.message));
$('export').addEventListener('click',()=>exportJson().catch(e=>$('message').textContent=e.message));
load().catch(e=>$('message').textContent=e.message);
})();