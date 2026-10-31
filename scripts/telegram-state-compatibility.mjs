/**
 * A transfer key is the JSON-encoded tuple:
 * [signature, sender, recipient, amount].
 * Legacy pipe-separated keys must be migrated manually, never discarded.
 */
export function assertStateKeysCompatible(state) {
  for (const key of Object.keys(state)) {
    let parsed;
    try { parsed=JSON.parse(key); }
    catch { throw new Error("Legacy or malformed delivery key; manual migration required"); }
    if (!Array.isArray(parsed) || parsed.length!==4 ||
        parsed.some(value=>typeof value!=="string" || !value.trim()) ||
        JSON.stringify(parsed)!==key) {
      throw new Error("Incompatible delivery key; manual migration required");
    }
  }
  return true;
}
