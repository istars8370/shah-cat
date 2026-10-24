// SHAH Wallet 1.1 Mainnet watch-only portfolio.
// No signing, wallet network switching, transaction submission, custody or swap.
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const M=ShahMultiChains;
  const KEY=/^(?:0|[1-9][0-9]*)$/;
  let activeRequest=0,lastKind=M.getChain($("mcNetwork").value).kind;
  let provider=null,accountChanged=null,disconnected=null;
  function tell(message,bad=false){
    const node=$("mcNotice");node.textContent=message;node.className="notice"+(bad?" error":"");
  }
  function empty(message="조회 전 · 메인넷 자산은 여기에 별도로 표시됩니다."){
    const node=$("mcAssets");node.replaceChildren();
    const item=document.createElement("p");item.className="empty";item.textContent=message;
    node.append(item);
    $("mcChecked").textContent="조회 시각 —";
  }
  function invalidate(note="주소 또는 네트워크가 변경됐습니다. 다시 조회하세요."){
    ++activeRequest;
    $("mcRead").disabled=false;
    empty();
    tell(note);
  }
  function currentAddress(chain){
    const candidate=$("mcAddress").value.trim();
    if(chain.kind==="evm")return M.parseEvmAddress(candidate);
    if(!ShahCat.isPublicKey(candidate))throw Error("Solana Mainnet 공개 주소 형식이 올바르지 않습니다.");
    return candidate;
  }
  function checkResponse(data,chain,address,now){
    if(!data||data.network!=="mainnet"||data.chain!==chain.id||data.kind!==chain.kind||
       data.readOnly!==true||data.walletSigningEnabled!==false||
       data.broadcastingEnabled!==false||data.address!==address||
       data.chainId!==(chain.chainId||null)||
       !Array.isArray(data.assets)||data.assets.length!==chain.tokens.length+1) {
      throw Error("네트워크·지갑·자산 정보가 조회 요청과 일치하지 않습니다.");
    }
    const at=Date.parse(data.checkedAt);
    if(!Number.isFinite(at)||at>now+5000||now-at>60000)throw Error("오래된 메인넷 잔액 조회입니다.");
    const expected=[chain.native,...chain.tokens];
    return data.assets.map((value,i)=>{
      const asset=expected[i];
      if(!value||value.id!==asset.id||value.symbol!==asset.symbol||value.decimals!==asset.decimals||
         (value.contract||null)!==(asset.contract||null)||
         (value.mint||null)!==(asset.mint||null)||
         (value.issuer||null)!==(asset.issuer||null)||
         typeof value.rawAmount!=="string"||!KEY.test(value.rawAmount)||
         value.rawAmount.length>80||M.formatUnits(value.rawAmount,value.decimals)!==value.amount) {
        throw Error("발행사 주소·토큰 수량을 검증하지 못했습니다.");
      }
      return value;
    });
  }
  function draw(assets,chain,address,time){
    const list=$("mcAssets");list.replaceChildren();
    for(const item of assets){
      const card=document.createElement("div");card.className="multi-asset";
      const symbol=document.createElement("strong");symbol.className="asset-symbol";symbol.textContent=item.symbol+" · "+chain.label;
      const value=document.createElement("div");value.className="asset-amount";value.textContent=item.amount;
      const type=document.createElement("div");type.className="asset-kind";
      type.textContent=item.issuer?item.issuer+" 발행 "+item.symbol:"네이티브 가스 코인";
      card.append(symbol,value,type);
      if(item.contract||item.mint){
        const ref=document.createElement("div");ref.className="asset-address mono";
        ref.textContent=item.contract||item.mint;
        card.append(ref);
      }
      list.append(card);
    }
    $("mcChecked").textContent="확인 시각 "+new Date(time).toLocaleString("ko-KR");
    $("mcVerified").textContent=chain.label+" · "+address.slice(0,9)+"…"+address.slice(-7)+" · 각 체인 별도 조회";
  }
  async function readPortfolio(){
    const chain=M.getChain($("mcNetwork").value);
    let address;
    try{address=currentAddress(chain);}
    catch(e){invalidate("공개 주소를 확인해 주세요.");tell(e.message,true);return;}
    const ticket=++activeRequest;
    $("mcRead").disabled=true;empty("실제 메인넷 자산 잔액을 읽는 중입니다…");
    tell(chain.label+" 공개 주소 잔액을 읽고 네트워크와 발행사 정보를 검증하고 있습니다.");
    try{
      const response=await fetch("/api/multichain?"+new URLSearchParams({chain:chain.id,address}),{cache:"no-store"});
      const data=await response.json();
      if(ticket!==activeRequest||$("mcNetwork").value!==chain.id)return;
      let current;
      try{current=currentAddress(chain);}catch{return;}
      if(current!==address)return;
      if(!response.ok)throw Error(data.error||"메인넷 공개 RPC 잔액 조회가 실패했습니다.");
      const assets=checkResponse(data,chain,address,Date.now());
      draw(assets,chain,address,data.checkedAt);
      tell("✓ 메인넷 읽기 전용 잔액 조회 성공. 입출금·브리지·서명은 전혀 수행하지 않았습니다.");
    }catch(e){
      if(ticket===activeRequest){empty("잔액을 확인하지 못했습니다. 0잔액으로 처리하지 않습니다.");tell("⚠ "+e.message,true);}
    }finally{if(ticket===activeRequest)$("mcRead").disabled=false;}
  }
  function refreshChain(){
    const chain=M.getChain($("mcNetwork").value);
    if(chain.kind!==lastKind)$("mcAddress").value="";
    lastKind=chain.kind;
    $("mcAddress").placeholder=chain.kind==="solana"?"Solana Mainnet 공개 주소 (Base58)":"0x로 시작하는 EVM 공개 주소";
    $("mcConnectEvm").disabled=chain.kind!=="evm";
    invalidate("선택한 네트워크: "+chain.label+". 공개 주소를 확인하고 잔액을 조회하세요.");
  }
  function disconnectEvents(){
    if(provider){
      const off=provider.removeListener||provider.off;
      if(typeof off==="function"){
        try{
          if(accountChanged)off.call(provider,"accountsChanged",accountChanged);
          if(disconnected)off.call(provider,"disconnect",disconnected);
        }catch(_){}
      }
    }
    provider=null;accountChanged=null;disconnected=null;
  }
  async function connectEvm(){
    const chain=M.getChain($("mcNetwork").value);
    if(chain.kind!=="evm")return;
    const injected=window.ethereum;
    if(typeof injected?.request!=="function"){
      tell("EIP-1193 호환 EVM 지갑이 감지되지 않습니다. 0x 공개 주소를 수동 입력할 수 있습니다.",true);return;
    }
    $("mcConnectEvm").disabled=true;
    tell("확장 지갑에서 공개 주소 연결만 승인하세요. 서명이나 전송 요청은 하지 않습니다.");
    try{
      // An EIP-1193 account request is a user consent action, NOT a transaction signature.
      const accounts=await injected.request({method:"eth_requestAccounts"});
      if(!Array.isArray(accounts)||!accounts.length)throw Error("지갑 계정 권한을 허용하지 않았습니다.");
      const address=M.parseEvmAddress(accounts[0]);
      disconnectEvents();provider=injected;
      if(typeof injected.on==="function"){
        accountChanged=next=>{
          invalidate("확장 지갑 계정이 변경됐습니다. 새 공개 주소를 다시 확인하세요.");
          $("mcAddress").value=Array.isArray(next)&&M.isEvmAddress(next[0])?M.parseEvmAddress(next[0]):"";
        };
        disconnected=()=>{invalidate("EVM 확장 지갑 연결이 해제됐습니다.");$("mcAddress").value="";};
        injected.on("accountsChanged",accountChanged);
        injected.on("disconnect",disconnected);
      }
      $("mcAddress").value=address;
      invalidate("EVM 공개 주소 연결 완료. 이 주소는 Ethereum·Base·Polygon에서 조회할 수 있습니다.");
      tell("✓ EVM 공개 주소 연결 승인 완료. 실제 조회는 버튼을 눌러 수행하며 거래 서명 권한은 없습니다.");
    }catch(e){tell("연결 취소 또는 오류: "+(e?.message||"주소를 확인하지 못했습니다."),true);}
    finally{$("mcConnectEvm").disabled=M.getChain($("mcNetwork").value).kind!=="evm";}
  }
  $("mcNetwork").addEventListener("change",refreshChain);
  $("mcAddress").addEventListener("input",()=>invalidate("주소가 변경됐습니다. 조회 결과를 초기화했습니다."));
  $("mcRead").addEventListener("click",readPortfolio);
  $("mcConnectEvm").addEventListener("click",connectEvm);
  window.addEventListener("pagehide",disconnectEvents);
  refreshChain();
})();
