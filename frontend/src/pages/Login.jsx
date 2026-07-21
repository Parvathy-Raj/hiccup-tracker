import { useState } from "react";
import { LogIn } from "lucide-react";
import { api } from "../api";
import kineticsLogo from "../assets/kinetics-logo.png";

export function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const user = await api.login({ identifier, password });
      onLogin(user);
    } catch {
      setError("Invalid email or password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <aside className="login-brand-panel">
          <div className="login-logo">
            <img src={kineticsLogo} alt="Kinetics Group" />
          </div>
          <div>
            <span className="login-kicker">Internal Operations</span>
            <h1>Hiccup Tracker</h1>
            <p>Centralized reporting for department issues, actions, and monthly management summaries.</p>
          </div>
        </aside>
        <div className="login-form-panel">
          <div className="login-heading">
            <h2>Sign in</h2>
            <p>Use your company email and password.</p>
          </div>
          <form className="login-form" onSubmit={submit}>
            <div className="field">
              <label htmlFor="login-identifier">Email</label>
              <input id="login-identifier" type="email" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="admin@kienticsgroup.com" autoComplete="username" required />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" autoComplete="current-password" required />
            </div>
            <button className="btn primary login-submit" disabled={isSubmitting}>
              <LogIn size={16} /> {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
            {error && <div className="login-error">{error}</div>}
          </form>
        </div>
      </section>
    </main>
  );
}
