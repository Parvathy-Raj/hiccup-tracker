import { useEffect, useState } from "react";
import { Download, ExternalLink, Search } from "lucide-react";
import { api } from "../api";

const monthOptions = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function HiccupList({ lookups, currentUser, openDetail }) {
  const [rows, setRows] = useState([]);
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, index) => currentYear - 3 + index);
  const [filters, setFilters] = useState({ search: "", month: "", year: currentYear, department_id: "", status: "", owner: "", sort: "created_desc" });
  const exportQuery = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== "" && value != null)).toString();
  const load = () => api.hiccups(filters).then(setRows);
  useEffect(() => { load(); }, [currentUser.id]);
  const set = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  return (
    <>
      <div className="topbar">
        <h1>Hiccup Register</h1>
        <div className="actions">
          <a className="btn" href={api.exportUrl(`/api/export/hiccups.csv?${exportQuery}`)}><Download size={16} /> CSV</a>
          <a className="btn" href={api.exportUrl(`/api/export/hiccups.xlsx?${exportQuery}`)}><Download size={16} /> XLSX</a>
        </div>
      </div>
      <section className="panel">
        <div className="filters">
          <Field label="Search"><input value={filters.search} onChange={(e) => set("search", e.target.value)} placeholder="Search occurrence/action" /></Field>
          <Field label="Status"><select value={filters.status} onChange={(e) => set("status", e.target.value)}><option value="">All</option>{lookups.statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>
          <Field label="Month">
            <select value={filters.month} onChange={(e) => set("month", e.target.value)}>
              <option value="">All</option>
              {monthOptions.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
            </select>
          </Field>
          <Field label="Year">
            <select value={filters.year} onChange={(e) => set("year", Number(e.target.value))}>
              {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </Field>
          <Field label="Department"><Select value={filters.department_id} onChange={(v) => set("department_id", v)} items={lookups.departments} /></Field>
          <Field label="Person sent"><input value={filters.owner} onChange={(e) => set("owner", e.target.value)} /></Field>
        </div>
        <button className="btn primary" onClick={load}><Search size={16} /> Apply Filters</button>
      </section>
      <div className="table-wrap excel-wrap" style={{ marginTop: 12 }}>
        <table className="excel-table">
          <thead><tr><th>Sr No.</th><th>Date</th><th>Department<br />(where hiccup came)</th><th>Person Sent</th><th>Describe the Situation/Occurrence</th><th>How it was Resolved or Action Taken</th><th></th></tr></thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}</td>
                <td>{new Date(row.date_reported).toLocaleDateString()}</td>
                <td>{row.department.name}</td>
                <td>{row.owner}</td>
                <td>{row.description}</td>
                <td>{row.action_taken || "-"}</td>
                <td><button className="btn" onClick={() => openDetail(row.id)}><ExternalLink size={15} /> Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Field({ label, children }) { return <div className="field"><label>{label}</label>{children}</div>; }
function Select({ value, onChange, items }) { return <select value={value} onChange={(e) => onChange(e.target.value)}><option value="">All</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>; }
