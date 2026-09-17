"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Lead = {
  id: string;
  name: string | null;
  companyName: string | null;
  contact: string;
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
  logins: {
    id: string;
    loggedInAt: string;
    ip: string | null;
    userAgent: string | null;
  }[];
};

type Phase = "closed" | "password" | "leads";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9.3 3.1 11 7.5a12.3 12.3 0 01-4.2 5.1M6.1 6.1A12.4 12.4 0 001 12.5C2.7 16.9 7 20 12 20c1.7 0 3.3-.4 4.7-1"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M1 12.5C2.7 8.1 7 5 12 5s9.3 3.1 11 7.5C21.3 16.9 17 20 12 20S2.7 16.9 1 12.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function LeadsModal() {
  const [phase, setPhase] = useState<Phase>("closed");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    const res = await fetch("/api/admin/leads");
    if (res.status === 401) {
      setPhase("password");
      return false;
    }
    if (!res.ok) {
      setError("Could not load leads.");
      setPhase("password");
      return false;
    }
    const data = await res.json();
    setLeads(data.leads || []);
    setPhase("leads");
    return true;
  }, []);

  const openPanel = useCallback(async () => {
    setError(null);
    setPassword("");
    setShowPassword(false);
    const ok = await loadLeads();
    if (!ok) setPhase("password");
  }, [loadLeads]);

  const closePanel = useCallback(async () => {
    setPhase("closed");
    setPassword("");
    setShowPassword(false);
    setError(null);
    await fetch("/api/admin/lock", { method: "POST" });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat) return;
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === "KeyA") {
        e.preventDefault();
        void openPanel();
        return;
      }
      if (e.key === "Escape" && phase !== "closed") {
        void closePanel();
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [openPanel, closePanel, phase]);

  async function unlock(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Incorrect password.");
        return;
      }
      await loadLeads();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "closed") return null;

  return (
    <div className="modal-overlay show" role="dialog" aria-modal="true">
      <div className="modal modal-wide leads-modal">
        {phase === "password" ? (
          <form onSubmit={unlock}>
            <h3>Admin access</h3>
            <p className="helper-note">Enter the admin password to view leads.</p>
            <div className="field">
              <label htmlFor="admin-password">Password</label>
              <div className="password-field">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>
            {error && <p className="warn-note">{error}</p>}
            <div className="btn-row">
              <button type="submit" disabled={busy}>
                {busy ? "Checking..." : "Unlock"}
              </button>
              <button type="button" className="secondary" onClick={() => void closePanel()}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="leads-header">
              <h3>Leads ({leads.length})</h3>
              <button type="button" className="secondary" onClick={() => void closePanel()}>
                Close
              </button>
            </div>
            <p className="helper-note">
            Login requests, counts, and timestamps.
            </p>
            {leads.length === 0 ? (
              <div className="empty-state">No leads yet.</div>
            ) : (
              <div className="leads-list">
                {leads.map((lead) => (
                  <div key={lead.id} className="leads-row">
                    <button
                      type="button"
                      className="leads-row-head"
                      onClick={() =>
                        setExpanded((id) => (id === lead.id ? null : lead.id))
                      }
                    >
                      <div>
                        <div className="leads-email">
                          {lead.name || "Unnamed"}
                          {lead.companyName ? (
                            <span className="leads-company"> · {lead.companyName}</span>
                          ) : null}
                        </div>
                        <div className="leads-meta">
                          {lead.contact} · First seen {formatWhen(lead.createdAt)} ·{" "}
                          <b>{lead.loginCount}</b> login
                          {lead.loginCount === 1 ? "" : "s"}
                          {lead.lastLoginAt
                            ? ` · last ${formatWhen(lead.lastLoginAt)}`
                            : " · never verified"}
                        </div>
                      </div>
                      <span className="leads-chevron">
                        {expanded === lead.id ? "▾" : "▸"}
                      </span>
                    </button>
                    {expanded === lead.id && (
                      <div className="leads-history">
                        {lead.logins.length === 0 ? (
                          <p className="helper-note">No successful logins yet.</p>
                        ) : (
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>When</th>
                                  <th>IP</th>
                                  <th>User agent</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lead.logins.map((login) => (
                                  <tr key={login.id}>
                                    <td>{formatWhen(login.loggedInAt)}</td>
                                    <td className="mono-small">{login.ip || "—"}</td>
                                    <td className="mono-small">
                                      {login.userAgent || "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
