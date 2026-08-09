export function PlaceholderPage({ title, body }: { title: string; body?: string }) {
  return (
    <div className="page">
      <h1>{title}</h1>
      <p className="muted">{body ?? "This section is coming in a later phase of the web MVP."}</p>
    </div>
  );
}
