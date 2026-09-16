"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Lead = {
  id: string;
  email: string;
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

export function LeadsModal() {
  const [phase, setPhase] = useState<Phase>("closed");
  const [password, setPassword] = useState("");
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
    const ok = await loadLeads();
    if (!ok) setPhase("password");
  }, [loadLeads]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        void openPanel();
      }
      if (e.key === "Escape" && phase !== "closed") {
        void closePanel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPanel, phase]);

  async function closePanel() {
    setPhase("closed");
    setPassword("");
    setError(null);
    await fetch("/api/admin/lock", { method: "POST" });
  }

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
              <input
                id="admin-password"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="warn-note">{error}</p>}
            <div className="btn-row">
              <button type="submit" disabled={busy}>
                {busy ? "Checking…" : "Unlock"}
              </button>
              <button type="button" className="secondary" onClick={closePanel}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="leads-header">
              <h3>Leads ({leads.length})</h3>
              <button type="button" className="secondary" onClick={closePanel}>
                Close
              </button>
            </div>
            <p className="helper-note">
              Everyone who requested a login code, with login counts and timestamps.
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
                        <div className="leads-email">{lead.email}</div>
                        <div className="leads-meta">
                          First seen {formatWhen(lead.createdAt)} ·{" "}
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
