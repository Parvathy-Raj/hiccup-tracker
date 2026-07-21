export function Bars({ data }) {
  const entries = Object.entries(data || {});
  const max = Math.max(...entries.map(([, value]) => value), 1);
  if (!entries.length) return <div className="muted">No data for this period.</div>;
  return (
    <div>
      {entries.map(([label, value]) => (
        <div className="bar-row" key={label}>
          <div>{label}</div>
          <div className="bar-track"><div className="bar" style={{ width: `${(value / max) * 100}%` }} /></div>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
