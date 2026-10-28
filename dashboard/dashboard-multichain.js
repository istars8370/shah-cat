// Dashboard-to-wallet bridge. Uses only the already exposed public Solana address.
// No keys, signing, Mainnet authority, transfers or background address lookup.
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const source=$("walletAddress");
  const target=$("mcAddress");
  const chain=$("mcNetwork");
  const button=$("mcCopyConnected");
  const notice=$("mcNotice");
  if(!source||!target||!chain||!button||!notice)return;
  const connected=()=>source.textContent.trim();
  function refresh(){
    // A Devnet public address can be observed on Solana Mainnet, but no
    // Devnet token or balance may be copied or treated as a Mainnet asset.
    button.disabled=chain.value!=="solana-mainnet"||!ShahCat.isPublicKey(connected());
  }
  button.addEventListener("click",()=>{
    const address=connected();
    if(chain.value!=="solana-mainnet"||!ShahCat.isPublicKey(address)){
      notice.textContent="Solana Mainnet을 선택하고 먼저 Devnet 공개 지갑을 연결하세요.";
      refresh();return;
    }
    target.value=address;
    // Reuse the multi-chain controller's stale-result invalidation.
    target.dispatchEvent(new Event("input",{bubbles:true}));
    notice.textContent="Devnet 지갑의 공개 주소만 복사했습니다. 메인넷 자산은 '잔액 조회'를 누르기 전까지 조회되지 않습니다.";
    refresh();
  });
  chain.addEventListener("change",refresh);
  if(typeof MutationObserver==="function"){
    new MutationObserver(refresh).observe(source,{
      childList:true,characterData:true,subtree:true,
    });
  }
  refresh();
})();
