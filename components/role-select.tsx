"use client";

import { useMemo, useState } from "react";
import { actorsOfType, getClientLedger } from "@/lib/ledger";
import {
  SESSION_ROLE_LABELS,
  setRoleSession,
  type SessionRole,
} from "@/lib/role-session";

const ROLES: { id: SessionRole; title: string; blurb: string }[] = [
  {
    id: "farmer",
    title: SESSION_ROLE_LABELS.farmer,
    blurb: "See only your own farm, lots in your custody, and send cherry to your aggregator.",
  },
  {
    id: "akrabi",
    title: SESSION_ROLE_LABELS.akrabi,
    blurb: "See only farmers you sponsored. Receive, process, and send toward the exporter.",
  },
  {
    id: "exporter",
    title: SESSION_ROLE_LABELS.exporter,
    blurb: "See only aggregators you sponsored — not their farmers. Receive green and close at FOB.",
  },
];

type Step = "role" | "actor";

export function RoleSelect() {
  const boot = useMemo(() => getClientLedger(), []);
  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<SessionRole | null>(null);

  const candidates = useMemo(() => {
    if (!role || role === "exporter") return [];
    return actorsOfType(boot.ledger, role);
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

  return (
    <div className="login-shell">
      <header className="masthead">
        <div className="shell-inner masthead-inner">
          <div className="brand-lockup">
            <div className="brand">Ankuaru</div>
            <div className="kicker">Choose your role</div>
          </div>
          <div className="masthead-copy">
            <h1>How do you want to enter the ledger?</h1>
            <p>
              This choice is for this browser session only. Three seeded demo identities are
              available for Farmer and Aggregator.
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
            <p className="helper-note">
              Pick who you are acting as in the seeded demo network.
            </p>
            {candidates.length === 0 ? (
              <div className="empty-state">No seeded actors for this role.</div>
            ) : (
              <div className="role-actor-list">
                {candidates.map((a) => (
                  <button
                    key={a.actorId}
                    type="button"
                    className="role-actor-row"
                    onClick={() => pickActor(a.actorId)}
                  >
                    <b>{a.displayName}</b>
                    <span className="mono-small">{a.legalIdentityRef}</span>
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
