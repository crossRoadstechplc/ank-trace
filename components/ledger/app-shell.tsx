"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useMemo, useState, type ReactNode } from "react";
import {
  ACTOR_TYPE_LABELS,
  InvariantViolation,
  METADATA_FIELDS,
  actorTypeLabel,
  canOnboardTypes,
  dashboardKicker,
  primaryWorkspaceAction,
  type ActorType,
} from "@/lib/ledger";
import { clearRoleSession, SESSION_ROLE_LABELS } from "@/lib/role-session";
import { useLedger } from "./ledger-context";

type AppShellProps = {
  children: ReactNode;
  userEmail: string;
};

const NAV = [
  { href: "/workspace", label: "Workspace" },
  { href: "/network", label: "Network" },
  { href: "/inspector", label: "Ledger inspector" },
] as const;

export function AppShell({ children, userEmail }: AppShellProps) {
  const pathname = usePathname();
  const { ledger, actingActorId, sessionRole, refresh, toast } = useLedger();
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [busyLogout, setBusyLogout] = useState(false);

  const actor = ledger.actors.get(actingActorId);
  const primary = primaryWorkspaceAction(sessionRole);
  const allowed = canOnboardTypes(ledger, actingActorId);

  const onboardLabel = useMemo(() => {
    if (primary === "addAkrabi") return "+ Add new akrabi";
    if (primary === "addFarmer") return "+ Add new farmer";
    return null;
  }, [primary]);

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
    <>
      <header className="masthead">
        <div className="shell-inner masthead-inner">
          <div className="brand-lockup">
            <div className="brand">Ankuaru</div>
            <div className="kicker">{dashboardKicker(sessionRole)}</div>
          </div>
          <div className="masthead-copy">
            <h1>{actor ? actor.displayName : "Coffee lot ledger"}</h1>
            <p>
              Signed in as {SESSION_ROLE_LABELS[sessionRole]}. You only see the network and lots
              valid for this role.
            </p>
          </div>
        </div>
      </header>

      <div className="toolbar">
        <div className="shell-inner toolbar-inner">
          <div className="toolbar-left">
            <div className="identity-block">
              <span className="identity-name">{actor?.displayName ?? "—"}</span>
              <span className="identity-sub">
                {SESSION_ROLE_LABELS[sessionRole]}
                {actor?.legalIdentityRef ? ` · ${actor.legalIdentityRef}` : ""}
              </span>
            </div>
            {onboardLabel && allowed.length > 0 && (
              <button type="button" className="link-btn" onClick={() => setOnboardOpen(true)}>
                {onboardLabel}
              </button>
            )}
          </div>
          <nav className="nav-tabs" aria-label="Primary">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-tab${pathname.startsWith(item.href) ? " active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="toolbar-right">
            <span className="app-user">{userEmail}</span>
            <button type="button" className="secondary" disabled={busyLogout} onClick={signOut}>
              {busyLogout ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </div>

      <main className="shell-inner">{children}</main>

      {onboardOpen && (
        <OnboardModal
          onClose={() => setOnboardOpen(false)}
          actingActorId={actingActorId}
          ledger={ledger}
          refresh={refresh}
          toast={toast}
        />
      )}
    </>
  );
}

function OnboardModal({
  onClose,
  actingActorId,
  ledger,
  refresh,
  toast,
}: {
  onClose: () => void;
  actingActorId: string;
  ledger: ReturnType<typeof useLedger>["ledger"];
  refresh: () => void;
  toast: (msg: string, isError?: boolean) => void;
}) {
  const actor = ledger.actors.get(actingActorId);
  const allowed = canOnboardTypes(ledger, actingActorId);
  const [actorType, setActorType] = useState<ActorType | "">(allowed[0] ?? "");
  const [name, setName] = useState("");
  const [legalRef, setLegalRef] = useState("");
  const [meta, setMeta] = useState<Record<string, string>>({});

  const fields = actorType ? METADATA_FIELDS[actorType] ?? [] : [];

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!actorType) return;
    if (!name.trim() || !legalRef.trim()) {
      toast("Name and identity reference are both required.", true);
      return;
    }
    try {
      const metadata: Record<string, string> = {};
      for (const [key, val] of Object.entries(meta)) {
        if (val.trim()) metadata[key] = val.trim();
      }
      const a = ledger.onboardActor(actorType, name.trim(), legalRef.trim(), actingActorId, metadata);
      refresh();
      onClose();
      toast(
        `${a.displayName} added — permanently onboarded by ${actor?.displayName ?? actingActorId}.`,
      );
    } catch (err) {
      const msg =
        err instanceof InvariantViolation
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not onboard.";
      toast(msg, true);
    }
  }

  return (
    <div className="modal-overlay show" role="dialog" aria-modal="true">
      <div className="modal modal-wide">
        {allowed.length === 0 ? (
          <>
            <h3>Onboarding not available</h3>
            <p className="helper-note">
              {actor ? actor.displayName : "This actor"} (
              {actorTypeLabel(actor?.actorType ?? "") || "this role"}) doesn&apos;t onboard new
              actors in this system.
            </p>
            <div className="btn-row">
              <button type="button" className="secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <h3>
              {allowed.length === 1
                ? `Add a ${ACTOR_TYPE_LABELS[allowed[0]].toLowerCase()}`
                : "Add to your network"}
            </h3>
            <p className="helper-note">
              Onboarded by you ({actor?.displayName}) — this relationship is permanent.
            </p>
            <div className="field">
              <label htmlFor="oa-type">Type</label>
              <select
                id="oa-type"
                value={actorType}
                onChange={(e) => {
                  setActorType(e.target.value as ActorType);
                  setMeta({});
                }}
              >
                {allowed.map((t) => (
                  <option key={t} value={t}>
                    {ACTOR_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="oa-name">Display name</label>
              <input
                id="oa-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="oa-id">Legal identity reference</label>
              <input
                id="oa-id"
                type="text"
                value={legalRef}
                onChange={(e) => setLegalRef(e.target.value)}
                placeholder="Registration / FAYDA / license"
                required
              />
            </div>
            {fields.map(([key, label, placeholder]) => (
              <div className="field" key={key}>
                <label htmlFor={`oa-meta-${key}`}>{label}</label>
                <input
                  id={`oa-meta-${key}`}
                  type="text"
                  placeholder={placeholder}
                  value={meta[key] ?? ""}
                  onChange={(e) => setMeta((m) => ({ ...m, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="btn-row">
              <button type="submit">Onboard</button>
              <button type="button" className="secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
