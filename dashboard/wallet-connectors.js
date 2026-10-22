// Original, read-only implementation of the published Wallet Standard interfaces.
// Protocol references (reviewed 2026-10-22; no upstream implementation is vendored):
// https://github.com/wallet-standard/wallet-standard/blob/master/packages/core/app/src/wallets.ts
// https://github.com/wallet-standard/wallet-standard/blob/master/packages/core/features/src/connect.ts
// https://github.com/wallet-standard/wallet-standard/blob/master/extensions/solana.md
// https://docs.phantom.com/solana/detecting-the-provider
// https://docs.phantom.com/solana/establishing-a-connection
// https://github.com/solflare-wallet/solflare-sdk
// Only connection, account observation and disconnection are exposed. No signing API.
var ShahCatWallets = (() => {
  "use strict";
  const CHAIN = "solana:devnet";
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const majorOne = version => typeof version === "string" && /^1\.\d+\.\d+$/.test(version);
  const hasChain = chains => Array.isArray(chains) && chains.includes(CHAIN);
  const notify = (listeners, value) => {
    for (const listener of [...listeners]) {
      try { listener(value); } catch (error) { console.error("Wallet listener failed", error); }
    }
  };
  function validStandard(features) {
    const connect = features?.["standard:connect"];
    const events = features?.["standard:events"];
    return majorOne(connect?.version) && typeof connect.connect === "function" &&
      majorOne(events?.version) && typeof events.on === "function";
  }
  function publicKeyAddress(bytes) {
    if (!bytes || bytes.length !== 32) return null;
    let number = 0n;
    for (const byte of bytes) {
      if (!Number.isInteger(byte) || byte < 0 || byte > 255) return null;
      number = number * 256n + BigInt(byte);
    }
    let address = "";
    while (number > 0n) {
      address = alphabet[Number(number % 58n)] + address;
      number /= 58n;
    }
    for (const byte of bytes) {
      if (byte !== 0) break;
      address = "1" + address;
    }
    return address;
  }
  function standardAccounts(accounts) {
    const result = [], seen = new Set();
    if (!Array.isArray(accounts)) return result;
    for (const account of accounts) {
      try {
        if (!hasChain(account?.chains) || !Array.isArray(account.features) ||
            !ShahCat.isPublicKey(account.address) ||
            publicKeyAddress(account.publicKey) !== account.address || seen.has(account.address)) continue;
        seen.add(account.address);
        result.push(Object.freeze({ address: account.address,
          label: typeof account.label === "string" ? account.label.slice(0, 80) : "" }));
      } catch (_) { /* A malformed advertised account is not an authorized Solana account. */ }
    }
    return result;
  }
  function injectedAccounts(key) {
    let address;
    try { address = key?.toBase58?.(); } catch (_) { return []; }
    return ShahCat.isPublicKey(address) ? [Object.freeze({ address, label: "" })] : [];
  }

  function createRegistry(host = window) {
    const standards = new Map(), injected = new Map(), listeners = new Set();
    const standardIds = new WeakMap(), injectedIds = new WeakMap();
    let sequence = 0;
    function identity(map, object, prefix) {
      if (!map.has(object)) map.set(object, prefix + ++sequence);
      return map.get(object);
    }
    const changed = () => notify(listeners, getWallets());

    function register(...wallets) {
      const added = [];
      for (const wallet of wallets) {
        if (!wallet || standards.has(wallet)) continue;
        try {
          if (!majorOne(wallet.version) || typeof wallet.name !== "string" || !wallet.name.trim() ||
              !Array.isArray(wallet.chains) || !Array.isArray(wallet.accounts) || !validStandard(wallet.features)) continue;
          const state = { chains: wallet.chains, features: wallet.features, accounts: wallet.accounts, accountRevision: 0 };
          const accountListeners = new Set();
          const supported = () => hasChain(state.chains) && validStandard(state.features);
          const currentAccounts = () => supported() ? standardAccounts(state.accounts) : [];
          const entry = Object.freeze({
            id: identity(standardIds, wallet, "standard-"),
            name: wallet.name.trim().slice(0, 80),
            kind: "standard",
            connectionNote: "Solana Devnet을 지원하는 공개 계정을 연결했습니다.",
            async connect() {
              if (!supported()) throw Error("이 지갑은 현재 Solana Devnet 연결을 지원하지 않습니다.");
              const revision = state.accountRevision;
              const response = await state.features["standard:connect"].connect();
              if (!supported()) throw Error("연결 중 지갑의 Devnet 지원 상태가 변경됐습니다.");
              if (!Array.isArray(response?.accounts)) throw Error("지갑이 유효한 계정 목록을 반환하지 않았습니다.");
              // A change event may already have superseded this delayed response.
              if (revision === state.accountRevision) state.accounts = response.accounts;
              return currentAccounts();
            },
            async disconnect() {
              const feature = state.features?.["standard:disconnect"];
              if (!majorOne(feature?.version) || typeof feature.disconnect !== "function") return false;
              await feature.disconnect();
              return true;
            },
            subscribe(listener) {
              accountListeners.add(listener);
              return () => accountListeners.delete(listener);
            },
          });
          const record = { entry, supported, off: null };
          standards.set(wallet, record);
          record.off = state.features["standard:events"].on("change", properties => {
            try {
              if (!properties || typeof properties !== "object") return;
              for (const key of ["chains", "features", "accounts"]) {
                if (own(properties, key)) state[key] = properties[key];
              }
              const accountsChanged = own(properties, "accounts");
              if (accountsChanged) ++state.accountRevision;
              const error = supported() ? "" : "지갑의 Solana Devnet 지원이 해제되어 연결을 종료했습니다.";
              // Capability announcements are not account revocations. In particular,
              // accounts is often still empty while a connect prompt is awaiting approval.
              if (error || accountsChanged) notify(accountListeners, { accounts: currentAccounts(), error });
              changed();
            } catch (_) {
              notify(accountListeners, { accounts: [], error: "지갑 계정 변경 정보를 확인하지 못했습니다. 다시 연결하세요." });
            }
          });
          if (typeof record.off !== "function") throw Error("Wallet events must return an unsubscribe function");
          added.push([wallet, record]);
        } catch (_) {
          const record = standards.get(wallet);
          standards.delete(wallet);
          try { record?.off?.(); } catch (_) {}
        }
      }
      if (added.length) changed();
      return () => {
        let removed = false;
        for (const [wallet, record] of added) {
          if (standards.get(wallet) !== record) continue;
          standards.delete(wallet);
          try { record.off?.(); } catch (_) {}
          removed = true;
        }
        if (removed) changed();
      };
    }

    function fallback(provider, name) {
      return Object.freeze({
        id: identity(injectedIds, provider, "injected-"), name, kind: "injected",
        connectionNote: "공개 주소를 연결했습니다. 잔액 조회는 Devnet 전용이며 지갑 앱의 네트워크는 자동으로 바꾸지 않습니다.",
        async connect() {
          const response = await provider.connect();
          return injectedAccounts(response?.publicKey || provider.publicKey);
        },
        async disconnect() { await provider.disconnect(); return true; },
        subscribe(listener) {
          let active = true;
          const accountChanged = key => { if (active) listener({ accounts: injectedAccounts(key), error: "" }); };
          const disconnected = () => { if (active) listener({ accounts: [], error: "" }); };
          provider.on("accountChanged", accountChanged);
          provider.on("disconnect", disconnected);
          return () => {
            active = false;
            const remove = provider.removeListener || provider.off;
            if (typeof remove === "function") {
              try { remove.call(provider, "accountChanged", accountChanged); remove.call(provider, "disconnect", disconnected); } catch (_) {}
            }
          };
        },
      });
    }
    function refresh() {
      const found = new Map();
      // Names are not identity. Deduplicate only the same provider object.
      // A generic window.solana without an explicit, unambiguous provider flag is ignored.
      for (const candidate of [() => host.phantom?.solana, () => host.solflare, () => host.solana]) {
        try {
          const provider = candidate();
          const phantom = provider?.isPhantom === true, solflare = provider?.isSolflare === true;
          if (phantom === solflare || typeof provider?.connect !== "function" ||
              typeof provider.disconnect !== "function" || typeof provider.on !== "function") continue;
          found.set(provider, phantom ? "Phantom" : "Solflare");
        } catch (_) {}
      }
      let modified = false;
      for (const provider of injected.keys()) {
        if (!found.has(provider)) { injected.delete(provider); modified = true; }
      }
      for (const [provider, name] of found) {
        if (!injected.has(provider)) { injected.set(provider, fallback(provider, name)); modified = true; }
      }
      if (modified) changed();
    }
    function getWallets() {
      return [...standards.values()].filter(record => record.supported()).map(record => record.entry)
        .concat([...injected.values()]);
    }
    const api = Object.freeze({ register });
    if (typeof host.addEventListener === "function") {
      host.addEventListener("wallet-standard:register-wallet", event => {
        try { if (typeof event.detail === "function") event.detail(api); } catch (_) {}
      });
      host.addEventListener("focus", refresh);
      host.addEventListener("load", refresh);
      if (typeof host.dispatchEvent === "function" && typeof host.Event === "function") {
        // Read-only detail and non-interruptible propagation match the standard's event contract.
        class AppReady extends host.Event {
          constructor() { super("wallet-standard:app-ready"); }
          get detail() { return api; }
          preventDefault() { throw Error("Wallet discovery cannot be cancelled"); }
          stopPropagation() { throw Error("Wallet discovery cannot be stopped"); }
          stopImmediatePropagation() { throw Error("Wallet discovery cannot be stopped"); }
        }
        host.dispatchEvent(new AppReady());
      }
    }
    refresh();
    return Object.freeze({
      getWallets, refresh,
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    });
  }
  return Object.freeze({ createRegistry });
})();
