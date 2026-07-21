import { useEffect, useState } from "react";
import { MessageSquare, Save } from "lucide-react";
import { api } from "../api";
import { StatusBadge } from "../components/Badges";

export function HiccupDetail({ id, lookups, currentUser, back }) {
  const [hiccup, setHiccup] = useState(null);
  const [edit, setEdit] = useState({});
  const [comment, setComment] = useState("");
  const load = () => api.hiccup(id).then((data) => { setHiccup(data); setEdit({ status: data.status, owner: data.owner || "", action_taken: data.action_taken || "", closing_remarks: data.closing_remarks || "" }); });
  useEffect(() => { load(); }, [id]);
  if (!hiccup) return <div>Loading hiccup...</div>;
  const set = (key, value) => setEdit((prev) => ({ ...prev, [key]: value }));
  async function save() {
    await api.updateHiccup(id, { ...edit, changed_by_id: currentUser.id });
    load();
  }
  async function addComment() {
    if (!comment.trim()) return;
    await api.addComment(id, { user_id: currentUser.id, body: comment });
    setComment("");
    load();
  }
  return (
    <>
      <div className="topbar">
        <h1>Hiccup #{hiccup.id}</h1>
        <button className="btn" onClick={back}>Back to list</button>
      </div>
      <div className="detail-layout">
        <section className="panel">
          <h2>Issue Information</h2>
          <KV label="Date reported" value={new Date(hiccup.date_reported).toLocaleString()} />
          <KV label="Department" value={hiccup.department.name} />
          <KV label="Person sent" value={hiccup.owner} />
          <KV label="Describe the situation / occurrence" value={hiccup.description} />
          <KV label="How it was resolved / action taken" value={hiccup.action_taken} />
          <KV label="Status" value={hiccup.status} />
          <KV label="Created by" value={`${hiccup.created_by.name} (${hiccup.created_by.role})`} />
          <div className="actions"><StatusBadge status={hiccup.status} />{hiccup.overdue && <span className="overdue">Overdue</span>}</div>
        </section>
        <section className="panel">
          <h2>Edit Tracking</h2>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field label="Status"><select value={edit.status} onChange={(e) => set("status", e.target.value)}>{lookups.statuses.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Person sent"><input value={edit.owner} onChange={(e) => set("owner", e.target.value)} /></Field>
            <Field label="Closing remarks"><input value={edit.closing_remarks} onChange={(e) => set("closing_remarks", e.target.value)} /></Field>
            <Field label="Action taken" wide><textarea value={edit.action_taken} onChange={(e) => set("action_taken", e.target.value)} /></Field>
          </div>
          <button className="btn primary" onClick={save}><Save size={16} /> Save Changes</button>
        </section>
      </div>
      <section className="grid-2">
        <div className="panel">
          <h2>Comments / Updates</h2>
          <div className="timeline">{hiccup.comments.map((item) => <div className="timeline-item" key={item.id}><strong>{item.user.name}</strong><div>{item.body}</div><small className="muted">{new Date(item.created_at).toLocaleString()}</small></div>)}</div>
          <div className="actions" style={{ marginTop: 12 }}><input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add update" /><button className="btn" onClick={addComment}><MessageSquare size={16} /> Add</button></div>
        </div>
        <div className="panel">
          <h2>Status History</h2>
          <div className="timeline">{hiccup.status_history.map((item) => <div className="timeline-item" key={item.id}><strong>{item.old_status || "New"} to {item.new_status}</strong><div className="muted">{item.changed_by.name} · {new Date(item.changed_at).toLocaleString()}</div></div>)}</div>
        </div>
      </section>
    </>
  );
}

function KV({ label, value }) { return <div className="kv"><strong>{label}</strong><span>{value || "-"}</span></div>; }
function Field({ label, wide, children }) { return <div className={`field ${wide ? "full" : ""}`}><label>{label}</label>{children}</div>; }
