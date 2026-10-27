// Local, guest-only contract for a future MONO RUN engine. No wallet/RPC capability.
export const CONTRACT_VERSION = 1;
export function createMonoRunSession(sessionId) {
  if (typeof sessionId !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(sessionId)) {
    throw Error("Invalid MONO RUN session ID");
  }
  let active = true;
  return Object.freeze({
    context: Object.freeze({ version: CONTRACT_VERSION, game: "mono-run", sessionId,
      mode: "guest", rewardsEnabled: false }),
    finish(result) {
      if (!active) throw Error("MONO RUN session is no longer active");
      if (!result || result.version !== CONTRACT_VERSION || result.sessionId !== sessionId ||
          !Number.isSafeInteger(result.score) || result.score < 0 || result.score > 1000000 ||
          !Number.isSafeInteger(result.durationMs) || result.durationMs < 0 || result.durationMs > 3600000) {
        throw Error("Invalid MONO RUN result");
      }
      // Copy allowlisted scalar fields only. A client score never authorizes rewards.
      active = false;
      return Object.freeze({ version: CONTRACT_VERSION, game: "mono-run", sessionId,
        score: result.score, durationMs: result.durationMs, verified: false, rewardsEnabled: false });
    },
    dispose() { active = false; },
  });
}
