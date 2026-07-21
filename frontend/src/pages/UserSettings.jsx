import { useState } from "react";
import { KeyRound, Save } from "lucide-react";
import { api } from "../api";

export function UserSettings({ currentUser, refreshLookups }) {
  const [profile, setProfile] = useState({ name: currentUser.name, email: currentUser.email, password: "" });
  const [message, setMessage] = useState("");

  async function saveProfile() {
    setMessage("");
    try {
      const updated = await api.updateProfile(currentUser.id, {
        current_user_id: currentUser.id,
        name: profile.name,
        email: profile.email,
        password: profile.password,
      });
      localStorage.setItem("hiccup_user_id", String(updated.id));
      setProfile({ name: updated.name, email: updated.email, password: "" });
      setMessage("Profile updated.");
      refreshLookups();
    } catch (error) {
      setMessage(error.message || "Could not update profile.");
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>User Settings</h1>
          <p className="page-subtitle">Your login and profile details</p>
        </div>
      </div>
      <section className="grid-2">
        <div className="panel">
          <h2>Profile Details</h2>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="field"><label>Name</label><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></div>
            <div className="field"><label>Email</label><input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></div>
            <div className="field"><label>Username</label><input value={currentUser.username || ""} disabled /></div>
            <div className="field"><label>Role</label><input value={currentUser.role} disabled /></div>
            <div className="field"><label>Department</label><input value={currentUser.department?.name || "All departments"} disabled /></div>
            <div className="field"><label>Status</label><input value={currentUser.is_active === false ? "Inactive" : "Active"} disabled /></div>
          </div>
          <div className="actions">
            <button className="btn primary" onClick={saveProfile}><Save size={16} /> Save Details</button>
            {message && <span className="muted">{message}</span>}
          </div>
        </div>
        <div className="panel">
          <h2>Change Password</h2>
          <div className="field">
            <label>New Password</label>
            <input type="password" value={profile.password} onChange={(event) => setProfile({ ...profile, password: event.target.value })} placeholder="Minimum 8 characters" />
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <button className="btn" onClick={saveProfile}><KeyRound size={16} /> Update Password</button>
          </div>
        </div>
      </section>
    </>
  );
}
