export type AppNotification = {
  id: number;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  related_id?: string | null;
};

export function parseNotification(raw: Record<string, unknown>): AppNotification {
  const dataRaw = raw.data;
  let data: Record<string, unknown> | null = null;
  if (dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)) {
    data = dataRaw as Record<string, unknown>;
  }

  const readAt = raw.read_at;
  const isRead = readAt != null || raw.is_read === true;

  return {
    id: Number(raw.id) || 0,
    type: String(raw.type ?? ""),
    title: String(raw.title ?? ""),
    message: String(raw.message ?? raw.body ?? ""),
    data,
    is_read: isRead,
    created_at: String(raw.created_at ?? new Date().toISOString()),
    related_id:
      raw.related_id != null
        ? String(raw.related_id)
        : data?.errand_id != null
          ? String(data.errand_id)
          : null,
  };
}
