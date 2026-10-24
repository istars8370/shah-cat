/* SHAH Wallet 1.0 RC · browser controller. Read-only, no secret keys or signing APIs. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const {NETWORK,TOKEN,MINT,DECIMALS,isPublicKey,parseAmount,rawAmount,amount,solAmount,format}=ShahCat;
  const Model=ShahWalletModel;
  const registry=ShahCatWallets.createRegistry(window);
  const STORE="shah-cat-v1-address-book";
  let wallets=[],activeWallet=null,stopEvents=null,availableAccounts=[];
  let connectedAddress=null,watchOnly=false,busy=false;
  let sessionVersion=0,balanceRequest=0,historyRequest=0,quoteRequest=0;
  let shahRaw=null,solRaw=null,balanceAt=0,contacts=[];
  function notice(id,message,kind=""){
    const target=$(id);target.textContent=message;target.className="notice"+(kind?" "+kind:"");
  }
  const isActive=(address,session)=>connectedAddress===address && session===sessionVersion;
  function invalidateQuote(){
    ++quoteRequest;
    $("quoteDetails").hidden=true;
    $("quoteNotice").textContent="이전 검증 결과가 무효화됐습니다. 현재 주소와 수량으로 다시 확인하세요.";
    $("quoteButton").disabled=false;
  }
  function eraseView(){
    ++balanceRequest;++historyRequest;invalidateQuote();
    shahRaw=null;solRaw=null;balanceAt=0;
    $("shahBalance").textContent="—";$("solBalance").textContent="—";
    $("historyList").replaceChildren();
    const empty=document.createElement("p");empty.className="empty";empty.textContent="조회 대기 중입니다.";
    $("historyList").append(empty);
    $("balanceNotice").textContent="지갑을 연결하거나 공개 주소를 조회하세요.";
    notice("historyNotice","거래내역 조회 전입니다.");
  }
  function renderSession(){
    $("currentAddress").textContent=connectedAddress||"연결 안 됨";
    $("modeLabel").textContent=!connectedAddress?"연결 전":watchOnly?"공개 주소 조회만 가능":"확장 지갑 공개 주소 연결";
    $("connectionState").textContent=!connectedAddress?"연결 전":watchOnly?"조회 전용":"연결됨";
    $("disconnectButton").disabled=!activeWallet;
    $("connectButton").disabled=busy||!!activeWallet;
    $("walletSelect").disabled=busy||!!activeWallet;
    $("refreshButton").disabled=!connectedAddress;
    $("historyButton").disabled=!connectedAddress;
    $("copyAddress").disabled=!connectedAddress;
  }
  function endSession(){
    ++sessionVersion;
    stopEvents?.();stopEvents=null;activeWallet=null;availableAccounts=[];
    connectedAddress=null;watchOnly=false;
    $("walletAccountSelect").hidden=true;$("walletAccountLabel").hidden=true;
    eraseView();renderSession();
  }
  function startAddress(address,watch){
    ++sessionVersion;
    connectedAddress=address;watchOnly=watch;
    eraseView();
    renderSession();
    refreshBalance();
  }
  function drawWallets(){
    const selected=$("walletSelect").value;
    wallets=registry.getWallets();
    const field=$("walletSelect");
    field.replaceChildren();
    if(!wallets.length){
      const option=document.createElement("option");option.value="";option.textContent="감지된 지갑이 없습니다.";field.append(option);
    }else{
      wallets.forEach(wallet=>{
        const option=document.createElement("option");
        option.value=wallet.id;
        option.textContent=wallet.name+(wallet.kind==="standard"?" · Wallet Standard":" · 확장");
        field.append(option);
      });
      if(wallets.some(x=>x.id===selected))field.value=selected;
      else if(activeWallet&&wallets.some(x=>x.id===activeWallet.id))field.value=activeWallet.id;
    }
    renderSession();
  }
  function drawAccounts(){
    const select=$("walletAccountSelect");select.replaceChildren();
    for(const account of availableAccounts){
      const option=document.createElement("option");option.value=account.address;
      const short=account.address.slice(0,7)+"…"+account.address.slice(-6);
      option.textContent=(account.label?account.label+" · ":"")+short;
      select.append(option);
    }
    select.hidden=availableAccounts.length<=1;
    $("walletAccountLabel").hidden=availableAccounts.length<=1;
    if(connectedAddress && availableAccounts.some(x=>x.address===connectedAddress))select.value=connectedAddress;
  }
  async function connect(){
    if(busy||activeWallet)return;
    const wallet=wallets.find(x=>x.id===$("walletSelect").value);
    if(!wallet){notice("walletNotice","Phantom 또는 Solflare를 설치하거나 공개 주소로 조회하세요.","error");return;}
    busy=true;const requested=++sessionVersion;
    renderSession();notice("walletNotice","지갑 연결 승인을 기다리는 중입니다…");
    try{
      const accounts=await wallet.connect();
      if(requested!==sessionVersion)return;
      if(!Array.isArray(accounts)||!accounts.length)throw Error("Devnet을 지원하는 계정이 없습니다.");
      const usable=accounts.filter(a=>isPublicKey(a.address));
      if(!usable.length)throw Error("유효한 공개 주소를 받지 못했습니다.");
      stopEvents?.();
      activeWallet=wallet;
      stopEvents=wallet.subscribe(event=>{
        if(activeWallet!==wallet)return;
        if(event.error){endSession();notice("walletNotice",event.error,"error");return;}
        if(!Array.isArray(event.accounts))return;
        availableAccounts=event.accounts.filter(a=>isPublicKey(a.address));
        if(!availableAccounts.length){endSession();notice("walletNotice","지갑 계정이 연결 해제됐습니다.");return;}
        const next=availableAccounts.some(a=>a.address===connectedAddress)?connectedAddress:availableAccounts[0].address;
        if(next!==connectedAddress){startAddress(next,false);}
        drawAccounts();
      });
      availableAccounts=usable;
      startAddress(usable[0].address,false);
      drawAccounts();
      notice("walletNotice",wallet.name+"의 공개 주소 연결 완료. 거래 서명은 요청하지 않습니다.","success");
    }catch(error){
      if(requested===sessionVersion){
        endSession();notice("walletNotice","연결하지 못했습니다: "+(error?.message||"취소됨"),"error");
      }
    }finally{busy=false;renderSession();}
  }
  async function disconnect(){
    if(busy)return;
    const wallet=activeWallet;
    endSession();
    if(wallet){try{await wallet.disconnect();}catch(_){/* Wallet permission may outlive the website session. */}}
    notice("walletNotice","월렛 화면의 연결을 해제했습니다. 확장 지갑 자체의 권한 설정은 별도입니다.");
  }
  async function watchAddress(){
    if(busy)return;
    const address=$("watchAddress").value.trim();
    if(!isPublicKey(address)){notice("walletNotice","유효한 Solana 공개 주소만 입력하세요. 시드·비밀키를 입력하지 마세요.","error");return;}
    const wallet=activeWallet;
    endSession();
    if(wallet){try{await wallet.disconnect();}catch(_){}}
    startAddress(address,true);
    notice("walletNotice","공개 주소 조회 모드입니다. 이 주소의 서명 권한은 없습니다.","success");
  }
  async function refreshBalance(){
    if(!connectedAddress)return;
    const address=connectedAddress,session=sessionVersion,ticket=++balanceRequest;
    shahRaw=null;solRaw=null;balanceAt=0;invalidateQuote();
    $("shahBalance").textContent="—";$("solBalance").textContent="—";
    $("balanceNotice").textContent="Devnet 실시간 잔액 조회 중…";
    $("refreshButton").disabled=true;
    try{
      const response=await fetch("/api/wallet?address="+encodeURIComponent(address),{cache:"no-store"});
      const data=await response.json();
      if(!isActive(address,session)||ticket!==balanceRequest)return;
      if(!response.ok)throw Error(data.error||"잔액 조회 실패");
      const parsed=Model.validBalance(data,address,ShahCat);
      shahRaw=parsed.shah;solRaw=parsed.sol;balanceAt=parsed.checkedAt;
      $("shahBalance").textContent=format(amount(shahRaw));
      $("solBalance").textContent=format(solAmount(solRaw));
      $("balanceNotice").textContent="✓ Devnet 확인 완료 · "+new Date(data.checkedAt).toLocaleString("ko-KR");
    }catch(e){
      if(isActive(address,session)&&ticket===balanceRequest){
        $("balanceNotice").textContent="⚠ 잔액 조회 실패: "+e.message;
      }
    }finally{if(isActive(address,session)&&ticket===balanceRequest)$("refreshButton").disabled=false;}
  }
  function validate(){
    const to=$("recipient").value.trim(),quantity=$("quantity").value.trim();
    if(!connectedAddress)throw Error("먼저 지갑을 연결하거나 공개 주소로 조회하세요.");
    if(shahRaw===null||solRaw===null)throw Error("지갑 잔액 조회를 완료하세요.");
    if(Date.now()-balanceAt>60000){shahRaw=null;solRaw=null;invalidateQuote();throw Error("잔액 조회 후 60초가 지났습니다. 잔액을 다시 조회하세요.");}
    if(!isPublicKey(to))throw Error("수신 주소의 형식이 올바르지 않습니다.");
    if(to===connectedAddress)throw Error("자기 자신에게 보내는 검증은 지원하지 않습니다.");
    const raw=parseAmount(quantity);
    if(raw<=0n)throw Error("SHAH 수량은 0보다 커야 합니다.");
    if(raw>shahRaw)throw Error("SHAH 잔액이 부족합니다.");
    if(solRaw<10000000n)throw Error("시뮬레이션 안전 여유분으로 Devnet SOL 0.01 이상이 필요합니다.");
    return {sender:connectedAddress,recipient:to,quantity,rawAmount:raw};
  }
  function validateInputs(){
    invalidateQuote();
    try{
      const x=validate();
      $("quoteNotice").textContent="✓ 입력 검증 통과 · "+amount(x.rawAmount)+" SHAH · 발신 "+(watchOnly?"공개 주소 조회 모드":"연결된 지갑")+" · 다음 버튼으로 서명 없는 RPC 시뮬레이션을 실행하세요.";
    }catch(e){$("quoteNotice").textContent="⚠ "+e.message;}
  }
  async function simulate(){
    let input;
    try{input=validate();}catch(e){$("quoteNotice").textContent="⚠ "+e.message;return;}
    const {sender,recipient,quantity,rawAmount:raw}=input;
    const session=sessionVersion,ticket=++quoteRequest;
    $("quoteDetails").hidden=true;$("quoteButton").disabled=true;
    $("quoteNotice").textContent="Devnet 계정·수수료·ATA·서명 없는 시뮬레이션 조회 중…";
    try{
      const params=new URLSearchParams({sender,recipient,amount:quantity});
      const response=await fetch("/api/quote?"+params,{cache:"no-store"});
      const data=await response.json();
      if(!isActive(sender,session)||ticket!==quoteRequest||
          $("recipient").value.trim()!==recipient||$("quantity").value.trim()!==quantity)return;
      if(!response.ok)throw Error(data.error||"RPC 시뮬레이션 실패");
      const costs=Model.validQuote(data,{sender,recipient,rawAmount:raw},ShahCat);
      $("quoteAta").textContent=data.recipientAta+(data.recipientAtaExists?" · 기존 계정":" · ATA 생성 시뮬레이션 포함");
      $("quoteFee").textContent=solAmount(costs.fee)+" SOL";
      $("quoteRent").textContent=solAmount(costs.rent)+" SOL";
      $("quoteUnits").textContent=Number.isSafeInteger(data.unitsConsumed)?String(data.unitsConsumed)+" CU":"확인 불가";
      $("quoteDetails").hidden=false;
      $("quoteNotice").textContent="✓ Devnet 서명 없는 시뮬레이션 성공. 실제 전송·서명은 수행하지 않았습니다.";
    }catch(e){
      if(isActive(sender,session)&&ticket===quoteRequest)$("quoteNotice").textContent="⚠ "+e.message;
    }finally{if(isActive(sender,session)&&ticket===quoteRequest)$("quoteButton").disabled=false;}
  }
  function makeEntry(label,detail){
    const box=document.createElement("div");box.className="entry";
    const left=document.createElement("div");left.className="grow";
    const strong=document.createElement("strong");strong.textContent=label;
    const small=document.createElement("small");small.className="wrap";small.textContent=detail;
    left.append(strong,small);box.append(left);
    return box;
  }
  async function fetchHistory(){
    if(!connectedAddress)return;
    const address=connectedAddress,session=sessionVersion,ticket=++historyRequest;
    notice("historyNotice","Devnet 거래내역을 읽는 중입니다…");
    $("historyList").replaceChildren();
    $("historyButton").disabled=true;
    try{
      const response=await fetch("/api/wallet-history?address="+encodeURIComponent(address),{cache:"no-store"});
      const data=await response.json();
      if(!isActive(address,session)||ticket!==historyRequest)return;
      if(!response.ok)throw Error(data.error||"거래내역 조회 실패");
      const items=Model.validHistory(data,address,ShahCat);
      $("historyList").replaceChildren();
      if(!items.length){
        const node=document.createElement("p");node.className="empty";node.textContent="현재 활성 SHAH 토큰 계정에서 확인된 최근 입출금이 없습니다.";
        $("historyList").append(node);
      }
      for(const item of items){
        const box=makeEntry(item.direction+" · "+new Date(item.timestamp).toLocaleString("ko-KR"),item.signature.slice(0,14)+"…"+item.signature.slice(-10));
        const end=document.createElement("div");end.className="btns";
        const val=document.createElement("span");val.className="amount "+(item.direction==="입금"?"in":"out");
        val.textContent=(item.direction==="입금"?"+":"−")+item.amount+" SHAH";
        const link=document.createElement("a");link.href=NETWORK.explorerUrl+"/tx/"+encodeURIComponent(item.signature)+"?cluster=devnet";
        link.textContent="탐색기 ↗";link.target="_blank";link.rel="noopener noreferrer";
        end.append(val,link);box.append(end);$("historyList").append(box);
      }
      notice("historyNotice","최근 "+items.length+"건 표시 · "+data.scannedSignatures+"개 서명 검색 · 전체 거래내역이 아니며 실제 Devnet 공개 정보입니다.","success");
    }catch(e){
      if(isActive(address,session)&&ticket===historyRequest)notice("historyNotice","거래내역을 조회하지 못했습니다: "+e.message,"error");
    }finally{if(isActive(address,session)&&ticket===historyRequest)$("historyButton").disabled=false;}
  }
  function persistContacts(){
    try{localStorage.setItem(STORE,JSON.stringify(contacts));return true;}catch(_){return false;}
  }
  function renderContacts(){
    const root=$("contactsList");root.replaceChildren();
    if(!contacts.length){const empty=document.createElement("p");empty.className="empty";empty.textContent="주소록에 등록된 공개 주소가 없습니다.";root.append(empty);return;}
    for(const item of contacts){
      const card=makeEntry(item.label,item.address);
      const controls=document.createElement("div");controls.className="btns";
      const use=document.createElement("button");use.type="button";use.textContent="사용";
      use.addEventListener("click",()=>{
        $("recipient").value=item.address;invalidateQuote();
        $("quoteNotice").textContent="수신 주소를 선택했습니다. 수량을 입력하고 다시 검증하세요.";
        $("recipient").focus();
      });
      const remove=document.createElement("button");remove.type="button";remove.textContent="삭제";
      remove.addEventListener("click",()=>{
        contacts=contacts.filter(x=>x.address!==item.address);
        const stored=persistContacts();renderContacts();
        notice("contactNotice",stored?"주소록에서 삭제했습니다.":"목록에서 삭제했지만 브라우저 저장은 불가능합니다.");
      });
      controls.append(use,remove);card.append(controls);root.append(card);
    }
  }
  function saveContact(){
    try{
      contacts=Model.addContact(contacts,$("contactName").value,$("contactAddress").value,isPublicKey);
      const stored=persistContacts();
      $("contactName").value="";$("contactAddress").value="";
      renderContacts();notice("contactNotice",stored?"공개 주소를 저장했습니다.":"저장 기능이 차단되어 이번 화면에서만 유지합니다.",stored?"success":"");
    }catch(e){notice("contactNotice",e.message,"error");}
  }
  async function copyAddress(){
    if(!connectedAddress)return;
    try{
      if(!navigator.clipboard?.writeText)throw Error("Clipboard unavailable");
      await navigator.clipboard.writeText(connectedAddress);
      notice("walletNotice","연결된 공개 주소를 복사했습니다.","success");
    }catch(_){notice("walletNotice","주소 복사를 지원하지 않는 환경입니다. 화면의 공개 주소를 직접 선택해 주세요.","error");}
  }
  async function selectAccount(){
    if(!activeWallet)return;
    const address=$("walletAccountSelect").value;
    if(!availableAccounts.some(a=>a.address===address)||address===connectedAddress)return;
    startAddress(address,false);
    notice("walletNotice","지갑 계정이 변경됐습니다. 이전 조회·검증 결과는 무효화됐습니다.");
  }
  $("connectButton").addEventListener("click",connect);
  $("disconnectButton").addEventListener("click",disconnect);
  $("watchButton").addEventListener("click",watchAddress);
  $("refreshButton").addEventListener("click",refreshBalance);
  $("historyButton").addEventListener("click",fetchHistory);
  $("validateButton").addEventListener("click",validateInputs);
  $("quoteButton").addEventListener("click",simulate);
  $("copyAddress").addEventListener("click",copyAddress);
  $("saveContact").addEventListener("click",saveContact);
  $("walletAccountSelect").addEventListener("change",selectAccount);
  $("recipient").addEventListener("input",invalidateQuote);
  $("quantity").addEventListener("input",invalidateQuote);
  try{contacts=Model.normalizeContacts(JSON.parse(localStorage.getItem(STORE)||"[]"),isPublicKey);}
  catch(_){contacts=[];}
  renderContacts();
  $("mintAddress").textContent=MINT;
  $("mintExplorer").href=NETWORK.explorerUrl+"/address/"+encodeURIComponent(MINT)+"?cluster=devnet";
  registry.subscribe(drawWallets);drawWallets();
  window.addEventListener("focus",()=>{registry.refresh();drawWallets();});
  renderSession();
})();
