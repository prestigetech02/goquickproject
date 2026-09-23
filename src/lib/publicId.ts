/** User-facing IDs: ER-260921026, CH-000045 */

function padPublicId(prefix: string, id: number | string | null | undefined): string {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${prefix}-${String(Math.trunc(n)).padStart(6, "0")}`;
}

function padSerial(id: number): string {
  return String(Math.trunc(id)).padStart(3, "0");
}

function dateStamp(createdAt: string | Date): string | null {
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/** Errand codes: ER-YYMMDD + serial, e.g. ER-260921026 */
export function formatErrandCode(
  id: number | string | null | undefined,
  createdAt?: string | Date | null,
  code?: string | null,
): string {
  if (code && code.trim()) return code.trim();
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return "";
  const serial = padSerial(n);
  if (!createdAt) return `ER-${serial}`;
  const stamp = dateStamp(createdAt);
  return stamp ? `ER-${stamp}${serial}` : `ER-${serial}`;
}

export function formatChatCode(id: number | string | null | undefined): string {
  return padPublicId("CH", id);
}
