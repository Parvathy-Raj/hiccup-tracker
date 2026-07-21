export function StatusBadge({ status }) {
  return <span className={`badge status-${String(status).replace(/\s/g, "")}`}>{status}</span>;
}
