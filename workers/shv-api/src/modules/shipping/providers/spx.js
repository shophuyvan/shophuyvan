
// Placeholder for SPX adapter (to be implemented in next steps)
export async function quoteSPX(payload) {
  return { ok: true, provider: "spx", fee: 15000, eta: "1-3 ngày" };
}
export async function createSPX(payload) {
  return { ok: false, error: "CREATE_FAILED", raw: { error: true, message: "Adapter not implemented" } };
}
