"use client";

import { useMemo, useState } from "react";
import { actorsOfType, getClientLedger } from "@/lib/ledger";
import {
  SESSION_ROLE_LABELS,
  clearRoleSession,
  setRoleSession,
  type SessionRole,
} from "@/lib/role-session";

const ROLES: { id: SessionRole; title: string; blurb: string }[] = [
  {
    id: "farmer",
    title: SESSION_ROLE_LABELS.farmer,
    blurb: "Your farm, lots in your custody, and cherry sent to your aggregator.",
  },
  {
    id: "akrabi",
    title: SESSION_ROLE_LABELS.akrabi,
    blurb: "Farmers you sponsored. Receive, process, and send toward the exporter.",
  },
  {
    id: "exporter",
    title: SESSION_ROLE_LABELS.exporter,
    blurb: "Aggregators you sponsored. Receive green and close at FOB. Farmer names stay hidden.",
  },
];

type Step = "role" | "actor";

export function RoleSelect() {
  const boot = useMemo(() => getClientLedger(), []);
  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<SessionRole | null>(null);
  const [busyLogout, setBusyLogout] = useState(false);

  const candidates = useMemo(() => {
    if (!role || role === "exporter") return [];
    // Stable order for Farmer 1… / Aggregator 1… labels (not alphabetical names).
    return [...actorsOfType(boot.ledger, role)].sort((a, b) =>
      a.legalIdentityRef.localeCompare(b.legalIdentityRef),
    );
  }, [boot.ledger, role]);

  function pickRole(r: SessionRole) {
    if (r === "exporter") {
      const exporters = actorsOfType(boot.ledger, "exporter");
      const exporter = exporters[0];
      if (!exporter) return;
      setRoleSession({ role: r, legalIdentityRef: exporter.legalIdentityRef });
      window.location.href = "/workspace";
      return;
    }
    setRole(r);
    setStep("actor");
  }

  function pickActor(actorId: string) {
    if (!role) return;
    const actor = boot.ledger.actors.get(actorId);
    if (!actor) return;
    setRoleSession({ role, legalIdentityRef: actor.legalIdentityRef });
    window.location.href = "/workspace";
  }

  function candidateLabel(index: number): string {
    if (role === "farmer") return `Farmer ${index + 1}`;
    if (role === "akrabi") return `Aggregator ${index + 1}`;
    return `Option ${index + 1}`;
  }

  async function signOut() {
    setBusyLogout(true);
    try {
      clearRoleSession();
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <div className="login-shell">
      <header className="masthead">
        <div className="auth-inner auth-inner-wide masthead-auth">
          <div className="brand-lockup">
            <div className="brand">Ankuaru</div>
          </div>
          <div className="role-select-actions">
            <button
              type="button"
              className="secondary"
              disabled={busyLogout}
              onClick={() => void signOut()}
            >
              {busyLogout ? "Signing out..." : "Sign out"}
            </button>
          </div>
          <div className="masthead-copy">
            <h1>Select a role</h1>
            <p>
              Farmer and Aggregator each have three demo identities. Exporter uses
              your signed-in name on the rich seed profile.
            </p>
          </div>
        </div>
      </header>

      <main className="login-main role-select-main">
        {step === "role" ? (
          <div className="role-card-grid">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                className="role-pick-card"
                onClick={() => pickRole(r.id)}
              >
                <div className="role-pick-title">{r.title}</div>
                <div className="role-pick-blurb">{r.blurb}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="login-card role-actor-card">
            <h2 className="section-title">
              Select {role ? SESSION_ROLE_LABELS[role] : "actor"}
            </h2>
            <p className="helper-note">Choose an identity to work as.</p>
            {candidates.length === 0 ? (
              <div className="empty-state">No identities for this role.</div>
            ) : (
              <div className="role-actor-list">
                {candidates.map((a, i) => (
                  <button
                    key={a.actorId}
                    type="button"
                    className="role-actor-row"
                    onClick={() => pickActor(a.actorId)}
                  >
                    <b>{candidateLabel(i)}</b>
                  </button>
                ))}
              </div>
            )}
            <div className="btn-row">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setStep("role");
                  setRole(null);
                }}
              >
                Back to roles
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
