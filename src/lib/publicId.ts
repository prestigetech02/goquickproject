/** User-facing IDs: ER-000123, CH-000045 */

function padPublicId(prefix: string, id: number | string | null | undefined): string {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${prefix}-${String(Math.trunc(n)).padStart(6, "0")}`;
}

export function formatErrandCode(id: number | string | null | undefined): string {
  return padPublicId("ER", id);
}

export function formatChatCode(id: number | string | null | undefined): string {
  return padPublicId("CH", id);
}
