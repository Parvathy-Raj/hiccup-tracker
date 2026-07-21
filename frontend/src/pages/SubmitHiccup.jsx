import { useEffect, useState } from "react";
import { ExternalLink, Save } from "lucide-react";
import { api } from "../api";

const emptyForm = {
  date_reported: new Date().toISOString().slice(0, 10),
  department_id: "",
  description: "",
  action_taken: "",
  owner: "",
  status: "Open",
};

export function SubmitHiccup({ lookups, currentUser, openDetail }) {
  const [form, setForm] = useState({ ...emptyForm, department_id: currentUser?.department_id || "" });
  const [myRows, setMyRows] = useState([]);
  const [message, setMessage] = useState("");
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const loadMyRows = () => api.hiccups({ created_by_id: currentUser.id, sort: "created_desc" }).then(setMyRows);

  useEffect(() => { loadMyRows(); }, [currentUser.id]);

  async function submit(event) {
    event.preventDefault();
    const payload = {
      ...form,
      date_reported: new Date(form.date_reported).toISOString(),
      department_id: Number(form.department_id),
      created_by_id: currentUser.id,
    };
    const created = await api.createHiccup(payload);
    setMessage(`Created hiccup #${created.id}`);
    setForm({ ...emptyForm, department_id: currentUser?.department_id || "" });
    loadMyRows();
  }

  return (
    <>
      <div className="topbar"><h1>Add Hiccup Row</h1></div>
      <form className="panel" onSubmit={submit}>
        <div className="simple-form-grid">
          <Field label="Date reported"><input type="date" value={form.date_reported} onChange={(e) => set("date_reported", e.target.value)} required /></Field>
          <Field label="Department (where hiccup came)"><Select value={form.department_id} onChange={(v) => set("department_id", v)} items={lookups.departments} /></Field>
          <Field label="Person sent"><input value={form.owner} onChange={(e) => set("owner", e.target.value)} required /></Field>
          <Field label="Status"><select value={form.status} onChange={(e) => set("status", e.target.value)}>{lookups.statuses.map((status) => <option key={status}>{status}</option>)}</select></Field>
          <Field label="Describe the situation / occurrence" wide><textarea value={form.description} onChange={(e) => set("description", e.target.value)} required /></Field>
          <Field label="How it was resolved / action taken" wide><textarea value={form.action_taken} onChange={(e) => set("action_taken", e.target.value)} /></Field>
        </div>
        <div className="actions">
          <button className="btn primary"><Save size={16} /> Submit</button>
          {message && <span className="muted">{message}</span>}
        </div>
      </form>
      <section className="panel" style={{ marginTop: 14 }}>
        <div className="panel-head">
          <h2>My Submitted Hiccups</h2>
          <span className="muted">Newest first</span>
        </div>
        <div className="table-wrap excel-wrap">
          <table className="excel-table">
            <thead><tr><th>Sr No.</th><th>Date</th><th>Department<br />(where hiccup came)</th><th>Person Sent</th><th>Describe the Situation/Occurrence</th><th>How it was Resolved or Action Taken</th><th></th></tr></thead>
            <tbody>
              {myRows.length ? myRows.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>{new Date(row.date_reported).toLocaleDateString()}</td>
                  <td>{row.department.name}</td>
                  <td>{row.owner}</td>
                  <td>{row.description}</td>
                  <td>{row.action_taken || "-"}</td>
                  <td><button className="btn" onClick={() => openDetail(row.id)}><ExternalLink size={15} /> View</button></td>
                </tr>
              )) : (
                <tr><td colSpan="7" className="muted">No hiccups submitted by you yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Field({ label, wide, children }) {
  return <div className={`field ${wide ? "wide" : ""}`}><label>{label}</label>{children}</div>;
}

function Select({ value, onChange, items }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} required>
      <option value="">Select</option>
      {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  );
}
