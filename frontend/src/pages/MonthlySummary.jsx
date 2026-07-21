import { useEffect, useState } from "react";
import { Copy, Download, Printer } from "lucide-react";
import { api } from "../api";
import { Bars } from "../components/Bars";

const monthOptions = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthlySummary() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState(null);
  const yearOptions = Array.from({ length: 7 }, (_, index) => now.getFullYear() - 3 + index);
  const summaryParams = () => ({ month, year });
  const load = () => api.summary(summaryParams()).then(setSummary);
  useEffect(() => { load(); }, [month, year]);
  async function copyEmail() {
    const data = await api.email(summaryParams());
    await navigator.clipboard.writeText(data.email);
  }
  const exportQuery = new URLSearchParams(summaryParams()).toString();
  return (
    <>
      <div className="topbar"><h1>Monthly Summary</h1></div>
      <section className="panel">
        <div className="filters">
          <div className="field">
            <label>Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {monthOptions.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={load}>Generate</button>
          <a className="btn" href={api.exportUrl(`/api/export/monthly-summary.xlsx?${exportQuery}`)}><Download size={16} /> Excel Report</a>
          <a className="btn" href={api.exportUrl(`/api/export/monthly-summary.html?${exportQuery}`)} target="_blank" rel="noreferrer"><Printer size={16} /> Printable</a>
          <button className="btn" onClick={copyEmail}><Copy size={16} /> Copy Email Summary</button>
        </div>
      </section>
      {summary && (
        <>
          <p className="page-subtitle" style={{ marginTop: 10 }}>Showing {monthOptions[(summary.month || month) - 1]} {summary.year || year}</p>
          <section className="cards" style={{ marginTop: 12 }}>
            <Metric label="Total" value={summary.total} />
            <Metric label="Open" value={summary.open} />
            <Metric label="Closed" value={summary.closed} />
            <Metric label="Avg closing days" value={summary.average_closing_days} />
          </section>
          <section className="panel" style={{ marginTop: 12 }}>
            <h2>Suggested Management Summary</h2>
            <div className="summary-text">{summary.suggested_summary}</div>
          </section>
          <section className="grid-2">
            <div className="panel"><h2>Department-wise Count</h2><Bars data={summary.department_counts} /></div>
            <div className="panel"><h2>Status Count</h2><Bars data={summary.status_counts} /></div>
          </section>
        </>
      )}
    </>
  );
}

function Metric({ label, value }) {
  return <div className="card"><div className="label">{label}</div><div className="value">{value}</div></div>;
}
