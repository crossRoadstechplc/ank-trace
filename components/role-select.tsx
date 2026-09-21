"use client";

import { useEffect, useMemo, useState } from "react";
import { actorsOfType, installClientLedger, peekClientLedger } from "@/lib/ledger";
import { fetchLedgerSnapshot } from "@/lib/ledger/api-client";
import type { BootstrapResult } from "@/lib/ledger/seed";
import { LoadingScreen } from "@/components/spinner";
import {
  SESSION_ROLE_LABELS,
  clearRoleSession,
  setRoleSession,
  type SessionRole,
} from "@/lib/role-session";

const ROLES: SessionRole[] = ["farmer", "collector", "akrabi", "exporter"];

type Step = "role" | "actor";

export function RoleSelect() {
  const [boot, setBoot] = useState<BootstrapResult | null>(() => peekClientLedger());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<SessionRole | null>(null);
  const [busyLogout, setBusyLogout] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await fetchLedgerSnapshot();
        if (cancelled) return;
        setBoot(installClientLedger(payload.snapshot));
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load ledger.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const candidates = useMemo(() => {
    if (!boot || !role || role === "exporter") return [];
    // actorsOfType already sorts: demo picks first, then user-onboarded.
    return actorsOfType(boot.ledger, role);
  }, [boot, role]);

  function pickRole(r: SessionRole) {
    if (!boot) return;
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
    if (!role || !boot) return;
    const actor = boot.ledger.actors.get(actorId);
    if (!actor) return;
    setRoleSession({ role, legalIdentityRef: actor.legalIdentityRef });
    window.location.href = "/workspace";
  }

  function candidateLabel(actor: (typeof candidates)[number], index: number): string {
    const prefix =
      role === "farmer"
        ? "Farmer"
        : role === "collector"
          ? "Collector"
          : role === "akrabi"
            ? "Aggregator"
            : "Option";
    const base = `${prefix} ${index + 1}`;
    if (actor.metadata?.userOnboarded === "true") {
      const name = String(actor.displayName || "").trim();
      return name ? `${base} · ${name}` : base;
    }
    return base;
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

  if (!boot) {
    return (
      <div className="login-shell">
        <LoadingScreen message={loadError ?? "Loading network…"} />
      </div>
    );
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
          </div>
        </div>
      </header>

      <main className="login-main role-select-main">
        {step === "role" ? (
          <div className="role-card-grid">
            {ROLES.map((id) => (
              <button
                key={id}
                type="button"
                className="role-pick-card"
                onClick={() => pickRole(id)}
              >
                <div className="role-pick-title">{SESSION_ROLE_LABELS[id]}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="login-card role-actor-card">
            <h2 className="section-title">
              Select {role ? SESSION_ROLE_LABELS[role] : "actor"}
            </h2>
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
                    <b>{candidateLabel(a, i)}</b>
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
