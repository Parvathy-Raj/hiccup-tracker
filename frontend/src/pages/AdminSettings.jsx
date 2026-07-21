import { useState } from "react";
import { KeyRound, Pencil, Plus, Save, Trash2, UserCheck, UserX, X } from "lucide-react";
import { api } from "../api";

export function AdminSettings({ lookups, currentUser, refreshLookups }) {
  const [department, setDepartment] = useState("");
  const [user, setUser] = useState({ name: "", username: "", email: "", password: "", role: "Employee", department_id: "" });
  const [editingUser, setEditingUser] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [userMessage, setUserMessage] = useState("");

  async function addDepartment() {
    if (!department.trim()) return;
    await api.addDepartment(department);
    setDepartment("");
    refreshLookups();
  }
  async function addUser() {
    setUserMessage("");
    if (!user.name.trim() || !user.username.trim() || !user.email.trim() || !user.password) {
      setUserMessage("Name, username, email, and password are required.");
      return;
    }
    try {
      await api.addUser({ ...user, admin_user_id: currentUser.id, department_id: user.department_id ? Number(user.department_id) : null });
      setUser({ name: "", username: "", email: "", password: "", role: "Employee", department_id: "" });
      setUserMessage("User created.");
      refreshLookups();
    } catch (error) {
      setUserMessage(error.message || "Could not create user.");
    }
  }

  function startEdit(row) {
    setUserMessage("");
    setResetPassword("");
    setEditingUser({
      id: row.id,
      name: row.name,
      username: row.username || "",
      email: row.email,
      role: row.role,
      department_id: row.department_id || "",
      is_active: row.is_active !== false,
    });
  }

  async function saveUser() {
    if (!editingUser) return;
    setUserMessage("");
    try {
      await api.updateUser(editingUser.id, {
        ...editingUser,
        admin_user_id: currentUser.id,
        department_id: editingUser.department_id ? Number(editingUser.department_id) : null,
      });
      setUserMessage("User details updated.");
      setEditingUser(null);
      refreshLookups();
    } catch (error) {
      setUserMessage(error.message || "Could not update user.");
    }
  }

  async function toggleActive(row) {
    setUserMessage("");
    try {
      await api.updateUser(row.id, { admin_user_id: currentUser.id, is_active: row.is_active === false });
      setUserMessage(row.is_active === false ? "User activated." : "User deactivated.");
      refreshLookups();
    } catch (error) {
      setUserMessage(error.message || "Could not update user status.");
    }
  }

  async function submitPasswordReset() {
    if (!editingUser || !resetPassword) return;
    setUserMessage("");
    try {
      await api.resetUserPassword(editingUser.id, { admin_user_id: currentUser.id, password: resetPassword });
      setResetPassword("");
      setUserMessage("Password reset.");
    } catch (error) {
      setUserMessage(error.message || "Could not reset password.");
    }
  }

  async function deleteUser(row) {
    if (!window.confirm(`Delete ${row.name}? Their previous hiccup records will remain assigned to the admin account.`)) return;
    setUserMessage("");
    try {
      await api.deleteUser(row.id, currentUser.id);
      if (editingUser?.id === row.id) setEditingUser(null);
      setUserMessage("User deleted.");
      refreshLookups();
    } catch (error) {
      setUserMessage(error.message || "Could not delete user.");
    }
  }

  return (
    <>
      <div className="topbar"><h1>Admin Settings</h1></div>
      <section className="grid-2">
        <LookupPanel title="Departments" rows={lookups.departments} value={department} setValue={setDepartment} add={addDepartment} />
        <div className="panel user-management-panel">
          <div className="panel-head">
            <h2>Users</h2>
            {userMessage && <span className="muted">{userMessage}</span>}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{lookups.users.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.username || "-"}</td>
                  <td>{row.email}</td>
                  <td>{row.role}</td>
                  <td>{row.department?.name || "All"}</td>
                  <td><span className={`badge ${row.is_active === false ? "status-Inactive" : "status-Active"}`}>{row.is_active === false ? "Inactive" : "Active"}</span></td>
                  <td>
                    <div className="table-actions">
                      <button className="icon-btn" onClick={() => startEdit(row)} title="Edit user"><Pencil size={15} /></button>
                      <button className="icon-btn" onClick={() => toggleActive(row)} title={row.is_active === false ? "Activate user" : "Deactivate user"} disabled={row.id === currentUser.id}>
                        {row.is_active === false ? <UserCheck size={15} /> : <UserX size={15} />}
                      </button>
                      <button className="icon-btn danger" onClick={() => deleteUser(row)} title="Delete user" disabled={row.id === currentUser.id}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <h2>Add User</h2>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="field"><label>Name</label><input value={user.name} onChange={(e) => setUser({ ...user, name: e.target.value })} /></div>
            <div className="field"><label>Username</label><input value={user.username} onChange={(e) => setUser({ ...user, username: e.target.value })} /></div>
            <div className="field"><label>Email</label><input value={user.email} onChange={(e) => setUser({ ...user, email: e.target.value })} /></div>
            <div className="field"><label>Password</label><input type="password" value={user.password} onChange={(e) => setUser({ ...user, password: e.target.value })} /></div>
            <div className="field"><label>Role</label><select value={user.role} onChange={(e) => setUser({ ...user, role: e.target.value })}><option>Employee</option><option>Department Head</option><option>Admin</option><option>Manager</option></select></div>
            <div className="field"><label>Department</label><select value={user.department_id} onChange={(e) => setUser({ ...user, department_id: e.target.value })}><option value="">All</option>{lookups.departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}</select></div>
          </div>
          <div className="actions">
            <button className="btn primary" onClick={addUser}><Plus size={16} /> Add User</button>
            {userMessage && <span className="muted">{userMessage}</span>}
          </div>
        </div>
        {editingUser && (
          <div className="panel">
            <div className="panel-head">
              <h2>Edit User</h2>
              <button className="icon-btn" onClick={() => setEditingUser(null)} title="Close editor"><X size={16} /></button>
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="field"><label>Name</label><input value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} /></div>
              <div className="field"><label>Username</label><input value={editingUser.username} onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })} /></div>
              <div className="field"><label>Email</label><input value={editingUser.email} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} /></div>
              <div className="field"><label>Role</label><select value={editingUser.role} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}><option>Employee</option><option>Department Head</option><option>Admin</option><option>Manager</option></select></div>
              <div className="field"><label>Department</label><select value={editingUser.department_id} onChange={(e) => setEditingUser({ ...editingUser, department_id: e.target.value })}><option value="">All</option>{lookups.departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}</select></div>
              <div className="field"><label>Status</label><select value={editingUser.is_active ? "active" : "inactive"} onChange={(e) => setEditingUser({ ...editingUser, is_active: e.target.value === "active" })} disabled={editingUser.id === currentUser.id}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            </div>
            <div className="actions">
              <button className="btn primary" onClick={saveUser}><Save size={16} /> Save Details</button>
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: "1fr auto", marginTop: 14 }}>
              <div className="field"><label>New Password</label><input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Minimum 8 characters" /></div>
              <div className="field"><label>&nbsp;</label><button className="btn" onClick={submitPasswordReset}><KeyRound size={16} /> Reset Password</button></div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function LookupPanel({ title, rows, value, setValue, add }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <div className="actions" style={{ marginBottom: 10 }}>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={`New ${title.slice(0, -1).toLowerCase()}`} />
        <button className="btn" onClick={add}><Plus size={16} /> Add</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Name</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><td>{row.id}</td><td>{row.name}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
