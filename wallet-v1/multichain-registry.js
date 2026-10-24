// SHAH Wallet 1.1 verified mainnet asset allowlist.
// Public contract/mint identifiers only. Do not infer assets from ticker names.
// Reference: https://developers.circle.com/stablecoins/usdc-contract-addresses
// Reference: https://tether.to/en/supported-protocols/
// Reference: https://solana.com/docs/payments/how-payments-work
var ShahMultiChains = (() => {
  "use strict";
  const chains = {
    "solana-mainnet": {
      id:"solana-mainnet", label:"Solana Mainnet", kind:"solana",
      genesis:"5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
      rpc:"https://api.mainnet-beta.solana.com",
      explorer:"https://explorer.solana.com/address/",
      native:{id:"sol",symbol:"SOL",decimals:9},
      tokens:[
        {id:"usdc",symbol:"USDC",decimals:6,issuer:"Circle",mint:"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"},
        {id:"usdt",symbol:"USDT",decimals:6,issuer:"Tether",mint:"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"},
      ],
    },
    "ethereum": {
      id:"ethereum", label:"Ethereum Mainnet", kind:"evm", chainId:1,
      rpc:"https://ethereum-rpc.publicnode.com",explorer:"https://etherscan.io/address/",
      native:{id:"eth",symbol:"ETH",decimals:18},
      tokens:[
        {id:"usdc",symbol:"USDC",decimals:6,issuer:"Circle",contract:"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"},
        {id:"usdt",symbol:"USDT",decimals:6,issuer:"Tether",contract:"0xdac17f958d2ee523a2206206994597c13d831ec7"},
      ],
    },
    "base": {
      id:"base",label:"Base Mainnet",kind:"evm",chainId:8453,
      rpc:"https://mainnet.base.org",explorer:"https://basescan.org/address/",
      native:{id:"eth",symbol:"ETH",decimals:18},
      tokens:[
        {id:"usdc",symbol:"USDC",decimals:6,issuer:"Circle",contract:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"},
      ],
    },
    "polygon": {
      id:"polygon",label:"Polygon PoS Mainnet",kind:"evm",chainId:137,
      rpc:"https://polygon.drpc.org",explorer:"https://polygonscan.com/address/",
      native:{id:"pol",symbol:"POL",decimals:18},
      tokens:[
        {id:"usdc",symbol:"USDC",decimals:6,issuer:"Circle",contract:"0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"},
      ],
    },
  };
  const HEX_ADDR=/^0x[0-9a-fA-F]{40}$/;
  function isEvmAddress(input){return typeof input==="string"&&HEX_ADDR.test(input);}
  function parseEvmAddress(input){
    if(!isEvmAddress(input))throw Error("올바른 0x 형식의 EVM 공개 주소를 입력하세요.");
    // This is hex-format validation only. This first read-only release
    // deliberately does NOT claim to verify mixed-case EIP-55 checksums.
    return input.toLowerCase();
  }
  function formatUnits(raw,decimals){
    const n=typeof raw==="bigint"?raw:BigInt(raw);
    if(n<0n||!Number.isSafeInteger(decimals)||decimals<0||decimals>18)throw Error("Invalid amount or decimals");
    const base=10n**BigInt(decimals);
    const whole=n/base;
    const fractional=(n%base).toString().padStart(decimals,"0").replace(/0+$/,"");
    return whole.toString()+(fractional?"."+fractional:"");
  }
  function getChain(id){
    if(typeof id!=="string"||!Object.prototype.hasOwnProperty.call(chains,id))throw Error("지원하지 않는 메인넷 네트워크입니다.");
    return chains[id];
  }
  function deepFreeze(x){
    if(x&&typeof x==="object"&&!Object.isFrozen(x)){
      for(const nested of Object.values(x))deepFreeze(nested);
      Object.freeze(x);
    }
    return x;
  }
  deepFreeze(chains);
  return Object.freeze({chains,getChain,isEvmAddress,parseEvmAddress,formatUnits});
})();
if(typeof module==="object"&&module.exports)module.exports=ShahMultiChains;
