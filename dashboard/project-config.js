// Project data only. Load before shared.js in a browser; Node loads it with require.
// Changing a profile does not enable a new network, token program, or signing mode.
var ShahCatConfig = (() => {
  "use strict";

  const config = {
    PROJECT: {
      name: "SHAH CAT",
      symbol: "SHAH",
      tagline: "Small Cat. Infinite Worlds.",
      logoUrl: "/logo.png",
    },
    NETWORK: {
      chain: "solana:devnet",
      cluster: "devnet",
      label: "Solana Devnet",
      genesisHash: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
      rpcUrl: "https://api.devnet.solana.com",
      explorerUrl: "https://explorer.solana.com",
      explorerCluster: "devnet",
    },
    TOKEN: {
      id: "shah-devnet",
      name: "SHAH CAT",
      symbol: "SHAH",
      mint: "82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2",
      decimals: 9,
      programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    },
    OWNERS: [
      { role: "Development", address: "3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs" },
      { role: "SHAH Treasury", address: "9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9" },
    ],
  };

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      for (const child of Object.values(value)) deepFreeze(child);
      Object.freeze(value);
    }
    return value;
  }

  return deepFreeze(config);
})();
if (typeof module === "object" && module.exports) module.exports = ShahCatConfig;
