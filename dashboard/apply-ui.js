(()=>{'use strict';
const form=document.getElementById('airdropForm');
const result=document.getElementById('result');
form.addEventListener('submit',async e=>{
  e.preventDefault();
  const activities=[...form.querySelectorAll('input[name="activity"]:checked')].map(x=>x.value);
  if(!activities.length){result.textContent='활동을 하나 이상 선택하세요.';return;}
  const payload={
    communityId:document.getElementById('communityId').value.trim(),
    wallet:document.getElementById('wallet').value.trim(),
    evidenceUrl:document.getElementById('evidenceUrl').value.trim(),
    submittedAt:new Date().toISOString(),
    activities,
    flags:[]
  };
  result.textContent='신청 확인 중…';
  try{
    const r=await fetch('/api/airdrop/public/applications',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const d=await r.json();
    if(!r.ok)throw Error(d.error||'신청 실패');
    result.textContent='신청 접수 완료 · 상태: '+d.status+' · '+d.reason;
    form.reset();
  }catch(err){result.textContent=err.message;}
});
})();