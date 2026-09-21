"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useState, type ReactNode } from "react";
import {
  ACTOR_TYPE_LABELS,
  InvariantViolation,
  METADATA_FIELDS,
  canOnboardTypes,
  dashboardKicker,
  type ActorType,
} from "@/lib/ledger";
import { postLedgerActor, type LedgerApiResponse } from "@/lib/ledger/api-client";
import { clearRoleSession, SESSION_ROLE_LABELS } from "@/lib/role-session";
import { BusyLabel } from "@/components/spinner";
import { useLedger } from "./ledger-context";

type AppShellProps = {
  children: ReactNode;
  userName: string;
  companyName: string;
  userContact: string;
};

const NAV = [
  { href: "/workspace", label: "Workspace" },
  { href: "/network", label: "My Network" },
  { href: "/inspector", label: "Ledger inspector" },
] as const;

export function AppShell({ children, userName, companyName, userContact }: AppShellProps) {
  const pathname = usePathname();
  const {
    ledger,
    actingActorId,
    sessionRole,
    actingDisplayName,
    refresh,
    toast,
    onboardOpen,
    setOnboardOpen,
    focusNetworkActor,
  } = useLedger();
  const [busyLogout, setBusyLogout] = useState(false);

  const actor = ledger.actors.get(actingActorId);

  const personLabel = userName || userContact || "Signed in";
  const companyLabel = companyName || null;

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
            <h1>{actingDisplayName}</h1>
            <p>
              Signed in as <b>{personLabel}</b>
              {companyLabel ? (
                <>
                  {" "}
                  · <b>{companyLabel}</b>
                </>
              ) : null}
              . Viewing as {SESSION_ROLE_LABELS[sessionRole]}. Network and lots are limited to this
              role.
            </p>
          </div>
        </div>
      </header>

      <div className="toolbar">
        <div className="shell-inner toolbar-inner">
          <div className="toolbar-left">
            <button
              type="button"
              className="toolbar-back"
              aria-label="Back to Role Selection"
              title="Back to Role Selection"
              onClick={() => {
                clearRoleSession();
                window.location.href = "/select-role";
              }}
            >
              ←
            </button>
            <div className="identity-block">
              <span className="identity-name">{personLabel}</span>
              <span className="identity-sub">
                {companyLabel ? `${companyLabel} · ` : ""}
                {SESSION_ROLE_LABELS[sessionRole]}
                {actor?.legalIdentityRef ? ` · ${actor.legalIdentityRef}` : ""}
              </span>
            </div>
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
            <button type="button" className="secondary" disabled={busyLogout} onClick={signOut}>
              {busyLogout ? "Signing out..." : "Sign out"}
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
          focusNetworkActor={focusNetworkActor}
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
  focusNetworkActor,
}: {
  onClose: () => void;
  actingActorId: string;
  ledger: ReturnType<typeof useLedger>["ledger"];
  refresh: (from?: LedgerApiResponse) => Promise<void>;
  toast: (msg: string, isError?: boolean) => void;
  focusNetworkActor: (actorId: string | null) => void;
}) {
  const actor = ledger.actors.get(actingActorId);
  const allowed = canOnboardTypes(ledger, actingActorId);
  const [actorType, setActorType] = useState<ActorType | "">(allowed[0] ?? "");
  const [name, setName] = useState("");
  const [legalRef, setLegalRef] = useState("");
  const [meta, setMeta] = useState<Record<string, string>>({ region: "Sidama" });
  const [facilityType, setFacilityType] = useState<"washing_station" | "mill">("washing_station");
  const [facilityName, setFacilityName] = useState("");
  const [facilityKebele, setFacilityKebele] = useState("");
  const [facilityCapacity, setFacilityCapacity] = useState("");
  const [facilityOperator, setFacilityOperator] = useState("");
  const [busy, setBusy] = useState(false);

  const fields = actorType ? METADATA_FIELDS[actorType] ?? [] : [];
  const isAddAkrabi = actorType === "akrabi";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!actorType || busy) return;
    if (!name.trim() || !legalRef.trim()) {
      toast("Name and registration reference are both required.", true);
      return;
    }
    setBusy(true);
    try {
      const metadata: Record<string, string> = {};
      for (const [key, val] of Object.entries(meta)) {
        if (val.trim()) metadata[key] = val.trim();
      }
      const res = await postLedgerActor({
        actorType,
        displayName: name.trim(),
        legalIdentityRef: legalRef.trim(),
        sponsorActorId: actingActorId,
        metadata: { ...metadata, userOnboarded: "true" },
        facility:
          isAddAkrabi && facilityName.trim()
            ? {
                actorType: facilityType,
                displayName: facilityName.trim(),
                legalIdentityRef: `${legalRef.trim()}-SITE`,
                metadata: {
                  region: metadata.region || "",
                  zone: metadata.zone || "",
                  woreda: metadata.woreda || "",
                  kebele: facilityKebele.trim(),
                  capacityKgPerDay: facilityCapacity.trim(),
                  operator: facilityOperator.trim(),
                },
              }
            : undefined,
      });
      await refresh(res);
      const a = res.actor;
      if (!a) throw new Error("Onboard succeeded but no actor returned.");
      focusNetworkActor(a.actorId);
      onClose();
      toast(`${a.displayName} added to your network.`);
    } catch (err) {
      const msg =
        err instanceof InvariantViolation
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not onboard.";
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay show" role="dialog" aria-modal="true">
      <div className="modal modal-wide">
        <button
          type="button"
          className="modal-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        {allowed.length === 0 ? (
          <>
            <h3>Onboarding not available</h3>
            <p className="helper-note">
              {actor ? actor.displayName : "This account"} cannot onboard new parties.
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
              {isAddAkrabi
                ? "Add a new aggregator"
                : allowed.length === 1
                  ? `Add a ${ACTOR_TYPE_LABELS[allowed[0]].toLowerCase()}`
                  : "Add to your network"}
            </h3>
            <p className="helper-note">
              {isAddAkrabi
                ? "Adds the aggregator and their processing site. Collectors are added later."
                : actorType === "collector"
                  ? "Adds a collector under your network. Farmers are added by the collector."
                  : `Added by ${actor?.displayName}.`}
            </p>
            {allowed.length > 1 && (
              <div className="field">
                <label htmlFor="oa-type">Type</label>
                <select
                  id="oa-type"
                  value={actorType}
                  onChange={(e) => {
                    setActorType(e.target.value as ActorType);
                    setMeta({ region: "Sidama" });
                  }}
                >
                  {allowed.map((t) => (
                    <option key={t} value={t}>
                      {ACTOR_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {isAddAkrabi && <h3 className="subhead">Aggregator</h3>}
            <div className="field">
              <label htmlFor="oa-name">Name</label>
              <input
                id="oa-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isAddAkrabi ? "Tolera Guyo" : undefined}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="oa-id">
                {isAddAkrabi
                  ? "Registration reference"
                  : actorType === "farmer"
                    ? "Fayda / registration reference"
                    : "Legal identity reference"}
              </label>
              <input
                id="oa-id"
                type="text"
                value={legalRef}
                onChange={(e) => setLegalRef(e.target.value)}
                placeholder={
                  isAddAkrabi
                    ? "REG-AK-1010"
                    : actorType === "farmer"
                      ? "FAYDA-002001"
                      : "Registration / FAYDA / license"
                }
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

            {isAddAkrabi && (
              <>
                <h3 className="subhead" style={{ marginTop: 18 }}>
                  Their processing site
                </h3>
                <div className="field">
                  <label htmlFor="aa-facility-type">Type</label>
                  <select
                    id="aa-facility-type"
                    value={facilityType}
                    onChange={(e) =>
                      setFacilityType(e.target.value as "washing_station" | "mill")
                    }
                  >
                    <option value="washing_station">Washing station</option>
                    <option value="mill">Mill</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="aa-facility-name">Site name</label>
                  <input
                    id="aa-facility-name"
                    type="text"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                    placeholder="Yirgacheffe Washing Station"
                  />
                </div>
                <div className="field">
                  <label htmlFor="aa-facility-kebele">Kebele</label>
                  <input
                    id="aa-facility-kebele"
                    type="text"
                    value={facilityKebele}
                    onChange={(e) => setFacilityKebele(e.target.value)}
                    placeholder="Gersay"
                  />
                </div>
                <div className="field">
                  <label htmlFor="aa-facility-capacity">Capacity (kg/day)</label>
                  <input
                    id="aa-facility-capacity"
                    type="text"
                    value={facilityCapacity}
                    onChange={(e) => setFacilityCapacity(e.target.value)}
                    placeholder="3000"
                  />
                </div>
                <div className="field">
                  <label htmlFor="aa-facility-operator">Operator</label>
                  <input
                    id="aa-facility-operator"
                    type="text"
                    value={facilityOperator}
                    onChange={(e) => setFacilityOperator(e.target.value)}
                    placeholder="Operator name"
                  />
                </div>
              </>
            )}

            <div className="btn-row">
              <button type="submit" disabled={busy}>
                <BusyLabel busy={busy} busyText="Saving…">
                  {isAddAkrabi ? "Add aggregator" : "Add"}
                </BusyLabel>
              </button>
              <button type="button" className="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
