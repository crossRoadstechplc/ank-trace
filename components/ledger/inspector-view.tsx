"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ACTOR_TYPE_LABELS,
  REASON_LABELS,
  displayActorName,
  fmtKg,
  formatEventTime,
  routeLabel,
  stateLabel,
  type Event,
  type Ledger,
  type Lot,
} from "@/lib/ledger";
import type { SessionRole } from "@/lib/role-session";
import { useLedger } from "./ledger-context";
import { LineageTracePanel } from "./lineage-trace-panel";

type Tab = "lots" | "events" | "trace" | "tests";

/** Lots the actor owns, holds, or has sent/received. */
function lotsVisibleToActor(ledger: Ledger, actorId: string): Lot[] {
  const movementLotIds = new Set<string>();
  for (const m of ledger.movements.values()) {
    if (m.fromActorId === actorId || m.toActorId === actorId) {
      movementLotIds.add(m.lotId);
    }
  }
  return [...ledger.lots.values()].filter(
    (l) =>
      l.ownerActorId === actorId ||
      l.custodianActorId === actorId ||
      movementLotIds.has(l.lotId),
  );
}

/** Events the actor executed, sponsored, or (as farmer) originated. */
function eventsVisibleToActor(ledger: Ledger, actorId: string): Event[] {
  return ledger.events.filter(
    (ev) =>
      ev.executingPersonId === actorId ||
      ev.onBehalfOfActorId === actorId ||
      (ev.payload.farmerActorId as string | undefined) === actorId,
  );
}

export function InspectorView() {
  const { ledger, actingActorId, sessionRole, lotCode, preferredTraceLotId, version } =
    useLedger();
  const [tab, setTab] = useState<Tab>("lots");

  const lots = useMemo(
    () => lotsVisibleToActor(ledger, actingActorId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ledger, actingActorId, version],
  );
  const scopedEvents = useMemo(
    () => eventsVisibleToActor(ledger, actingActorId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ledger, actingActorId, version],
  );
  const active = lots.filter((l) => l.status === "active");
  const inactive = lots.filter((l) => l.status !== "active");

  const [traceLotId, setTraceLotId] = useState<string>(
    preferredTraceLotId ?? lots[0]?.lotId ?? "",
  );

  return (
    <div className="view active">
      <div className="summary-bar">
        <div className="summary-cell">
          <div className="num">{active.length}</div>
          <div className="label">Active lots</div>
        </div>
        <div className="summary-cell">
          <div className="num">{inactive.length}</div>
          <div className="label">Closed lots</div>
        </div>
        <div className="summary-cell">
          <div className="num">{scopedEvents.length}</div>
          <div className="label">Ledger events</div>
        </div>
        <div className="summary-cell">
          <div className="num">{ledger.discrepancies.length}</div>
          <div className="label">Open discrepancies</div>
        </div>
      </div>

      <div className="tabs">
        {(
          [
            ["lots", "All lots"],
            ["events", "Activity"],
            ["trace", "Lineage trace"],
            ["tests", "Integrity checks"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab${tab === id ? " active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "lots" && (
        <LotsTab lots={lots} ledger={ledger} lotCode={lotCode} sessionRole={sessionRole} />
      )}
      {tab === "events" && (
        <EventsTab
          ledger={ledger}
          lotCode={lotCode}
          version={version}
          actingActorId={actingActorId}
          sessionRole={sessionRole}
        />
      )}
      {tab === "trace" && (
        <LineageTracePanel
          lots={lots}
          ledger={ledger}
          lotCode={lotCode}
          traceLotId={traceLotId}
          setTraceLotId={setTraceLotId}
          sessionRole={sessionRole}
        />
      )}
      {tab === "tests" && <IntegrityTab ledger={ledger} lotCode={lotCode} version={version} />}
    </div>
  );
}

function LotsTab({
  lots,
  ledger,
  lotCode,
  sessionRole,
}: {
  lots: Lot[];
  ledger: Ledger;
  lotCode: (id: string) => string;
  sessionRole: SessionRole;
}) {
  return (
    <div className="tabpanel active">
      <div className="page-head">
        <h2 className="section-title">Lots</h2>
      </div>
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>State</th>
            <th>Route</th>
            <th>Status</th>
            <th>Weight (kg)</th>
            <th>Owner</th>
            <th>Custodian</th>
            <th>Origin</th>
          </tr>
        </thead>
        <tbody>
          {lots.length === 0 ? (
            <tr>
              <td colSpan={8} className="empty-state">
                No lots yet.
              </td>
            </tr>
          ) : (
            lots.map((l) => (
              <tr key={l.lotId}>
                <td>{lotCode(l.lotId)}</td>
                <td>{stateLabel(l.processingState)}</td>
                <td>{routeLabel(l.processingRoute)}</td>
                <td>
                  {l.inTransit ? (
                    <span className="badge transit">in transit</span>
                  ) : l.status === "active" ? (
                    <span className="badge active">active</span>
                  ) : (
                    <span className="badge inactive">inactive</span>
                  )}
                </td>
                <td>{l.canonicalMassKg}</td>
                <td className="mono-small">
                  {displayActorName(ledger, l.ownerActorId, sessionRole)}
                </td>
                <td className="mono-small">
                  {displayActorName(ledger, l.custodianActorId, sessionRole)}
                </td>
                <td className="mono-small">{l.originStatus}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
      <h2 className="section-title" style={{ marginTop: 28 }}>
        Open discrepancies
      </h2>
      {ledger.discrepancies.length === 0 ? (
        <div className="empty-state">No open discrepancies.</div>
      ) : (
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Movement</th>
              <th>Lot</th>
              <th>Sender (kg)</th>
              <th>Receiver (kg)</th>
              <th>Delta</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ledger.discrepancies.map((d) => (
              <tr key={d.discrepancyId}>
                <td>{d.movementId}</td>
                <td>{lotCode(d.lotId)}</td>
                <td>{d.senderKg}</td>
                <td>{d.receiverKg}</td>
                <td style={{ color: "var(--warn)", fontWeight: 600 }}>
                  {d.deltaKg > 0 ? "+" : ""}
                  {d.deltaKg}
                </td>
                <td>{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

function EventsTab({
  ledger,
  lotCode,
  version,
  actingActorId,
  sessionRole,
}: {
  ledger: Ledger;
  lotCode: (id: string) => string;
  version: number;
  actingActorId: string;
  sessionRole: SessionRole;
}) {
  const events = useMemo(
    () => [...eventsVisibleToActor(ledger, actingActorId)].reverse(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ledger, actingActorId, version],
  );

  return (
    <div className="tabpanel active">
      <div className="page-head">
        <h2 className="section-title">Activity</h2>
        <p className="helper-note">
          Newest first. Recorded entries are not edited.
        </p>
      </div>
      {events.length === 0 ? (
        <div className="empty-state">No activity yet.</div>
      ) : (
        events.map((ev) => (
          <div className="activity-row" key={ev.eventId}>
            <div className="activity-time">{formatEventTime(ev.eventTime)}</div>
            <div className="activity-text">
              {describeEvent(ledger, lotCode, ev, sessionRole)}
              {ev.correctsEventId ? (
                <span className="activity-corrects"> (corrects an earlier entry)</span>
              ) : null}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function IntegrityTab({
  ledger,
  lotCode,
  version,
}: {
  ledger: Ledger;
  lotCode: (id: string) => string;
  version: number;
}) {
  const [checks, setChecks] = useState<{ status: string; title: string; text: string }[] | null>(
    null,
  );
  const iconFor = (s: string) => (s === "good" ? "✓" : s === "attention" ? "!" : "✕");

  // Clear results when ledger changes so user re-runs Check now
  useEffect(() => {
    setChecks(null);
  }, [version]);

  return (
    <div className="tabpanel active">
      <div className="page-head">
        <h2 className="section-title">Integrity checks</h2>
        <p className="helper-note">
          Checks origin trace, weight conservation, and open shipment discrepancies.
        </p>
        <button
          type="button"
          className="secondary"
          style={{ marginTop: 10 }}
          onClick={() => setChecks(runIntegrityChecks(ledger, lotCode))}
        >
          Check now
        </button>
      </div>
      {checks &&
        checks.map((c) => (
          <div key={c.title} className={`chk-item chk-${c.status}`}>
            <div className="chk-icon">{iconFor(c.status)}</div>
            <div>
              <div className="chk-title">{c.title}</div>
              <div className="chk-text">{c.text}</div>
            </div>
          </div>
        ))}
    </div>
  );
}

function runIntegrityChecks(ledger: Ledger, lotCode: (id: string) => string) {
  const checks: { status: string; title: string; text: string }[] = [];

  {
    const activeLots = [...ledger.lots.values()].filter((l) => l.status === "active");
    const roots = new Set<string>();
    activeLots.forEach((l) => ledger.traceBackward(l.lotId).forEach((r) => roots.add(r)));
    const rootLots = [...roots].map((id) => ledger.lots.get(id)!).filter(Boolean);
    const verified = rootLots.filter((l) => l.originStatus === "farmer_verified").length;
    const pending = rootLots.length - verified;
    checks.push({
      status: pending === 0 ? "good" : "attention",
      title: "Traceability",
      text:
        activeLots.length === 0
          ? "There is no active inventory yet."
          : `All ${activeLots.length} active lot${activeLots.length !== 1 ? "s" : ""} trace fully back to a named farmer, across ${rootLots.length} origin${rootLots.length !== 1 ? "s" : ""}. ${verified} ${verified !== 1 ? "are" : "is"} verified directly by the farmer.` +
            (pending > 0
              ? ` ${pending} ${pending !== 1 ? "are" : "is"} recorded by a counterparty and still awaiting farmer confirmation.`
              : ""),
    });
  }

  {
    const totalMinted = ledger.events
      .filter((e) => e.eventType === "origin_lot_created")
      .reduce((a, e) => a + (e.payload.massKg as number), 0);
    const totalRejectLoss = ledger.events
      .filter((e) => e.eventType === "process")
      .reduce(
        (a, e) => a + ((e.payload.rejectKg as number) || 0) + ((e.payload.lossKg as number) || 0),
        0,
      );
    const totalActiveNow = [...ledger.lots.values()]
      .filter((l) => l.status === "active")
      .reduce((a, l) => a + l.canonicalMassKg, 0);
    const totalClosed = [...ledger.lots.values()]
      .filter((l) => {
        if (l.status !== "inactive" || !l.inactiveEventId) return false;
        const ev = ledger.events.find((e) => e.eventId === l.inactiveEventId);
        return ev && ev.eventType === "terminal_disposition";
      })
      .reduce((a, l) => a + l.canonicalMassKg, 0);
    const totalAccounted = totalActiveNow + totalClosed + totalRejectLoss;
    const diff = Math.round((totalMinted - totalAccounted) * 100) / 100;
    checks.push({
      status: Math.abs(diff) < 0.01 ? "good" : "problem",
      title: "Weight balance",
      text:
        totalMinted === 0
          ? "No coffee has entered the ledger yet."
          : `${fmtKg(totalMinted)}kg has entered the ledger from harvest. ${fmtKg(totalActiveNow)}kg is currently held across active lots, ${fmtKg(totalClosed)}kg has been closed out (exported, sold, or destroyed), and ${fmtKg(totalRejectLoss)}kg was recorded as reject or weight loss.` +
            (Math.abs(diff) < 0.01
              ? " Weights balance."
              : ` ${fmtKg(Math.abs(diff))}kg is unaccounted for and needs investigation.`),
    });
  }

  {
    const open = ledger.discrepancies.filter((d) => d.status === "open");
    checks.push({
      status: open.length === 0 ? "good" : "problem",
      title: "Shipment discrepancies",
      text:
        open.length === 0
          ? "No shipment has an unresolved difference between what was sent and what was received."
          : `${open.length} shipment${open.length !== 1 ? "s have" : " has"} a difference between what was sent and what was received: ` +
            open
              .map(
                (d) =>
                  `${lotCode(d.lotId)} (${d.deltaKg > 0 ? "+" : ""}${fmtKg(d.deltaKg)}kg)`,
              )
              .join(", ") +
            ".",
    });
  }

  return checks;
}

function describeEvent(
  ledger: Ledger,
  lotCode: (id: string) => string,
  ev: Event,
  sessionRole: SessionRole = "farmer",
): string {
  const p = ev.payload;
  const name = (id: string) => displayActorName(ledger, id, sessionRole);
  switch (ev.eventType) {
    case "actor_onboarded": {
      const typeLabel = (
        ACTOR_TYPE_LABELS[p.actorType as keyof typeof ACTOR_TYPE_LABELS] || String(p.actorType)
      ).toLowerCase();
      const sponsor = p.sponsorActorId
        ? `, onboarded by ${name(p.sponsorActorId as string)}`
        : "";
      return `${name(p.actorId as string)} was added as a${/^[aeiou]/i.test(typeLabel) ? "n" : ""} ${typeLabel}${sponsor}.`;
    }
    case "origin_lot_created": {
      const lot = [...ledger.lots.values()].find((l) => l.createdEventId === ev.eventId);
      if (!lot) return "A new lot was recorded from harvest.";
      return `${lotCode(lot.lotId)} was recorded: ${fmtKg(lot.canonicalMassKg)}kg of ${stateLabel(lot.processingState)} from ${name(p.farmerActorId as string)}.`;
    }
    case "movement_send": {
      const mv = ledger.movements.get(p.movementId as string);
      return `${lotCode(p.lotId as string)} was sent to ${mv ? name(mv.toActorId) : "another party"} (${fmtKg(p.senderDeclaredKg as number)}kg declared).`;
    }
    case "movement_receive": {
      const mv = ledger.movements.get(p.movementId as string);
      if (!mv) return "A shipment was confirmed on receipt.";
      const base = `${lotCode(mv.lotId)} was received by ${name(mv.toActorId)} (${fmtKg(p.receiverDeclaredKg as number)}kg confirmed)`;
      return (p.discrepancyKg as number) !== 0
        ? `${base}, ${(p.discrepancyKg as number) > 0 ? "more" : "less"} than declared by ${fmtKg(Math.abs(p.discrepancyKg as number))}kg. Flagged as a discrepancy.`
        : `${base}, matching what was sent.`;
    }
    case "ownership_transfer":
      return `${lotCode(p.lotId as string)} changed ownership to ${name(p.newOwnerActorId as string)}. Custody and location were not affected.`;
    case "disaggregate": {
      const children = [...ledger.lots.values()].filter((l) => l.createdEventId === ev.eventId);
      return `${lotCode(p.parentLotId as string)} was split into ${children.map((c) => `${lotCode(c.lotId)} (${fmtKg(c.canonicalMassKg)}kg)`).join(" and ")}.`;
    }
    case "aggregate": {
      const child = [...ledger.lots.values()].find((l) => l.createdEventId === ev.eventId);
      return `${(p.parentLotIds as string[]).map(lotCode).join(", ")} were combined into ${lotCode(child ? child.lotId : "")} (${fmtKg(p.totalMassKg as number)}kg total).`;
    }
    case "process": {
      const out = [...ledger.lots.values()].find((l) => l.createdEventId === ev.eventId);
      const extras =
        (p.rejectKg as number) || (p.lossKg as number)
          ? ` (${fmtKg(p.rejectKg as number)}kg reject, ${fmtKg(p.lossKg as number)}kg loss)`
          : "";
      return `${(p.inputLotIds as string[]).map(lotCode).join(", ")} became ${lotCode(out ? out.lotId : "")}: ${fmtKg(p.outputMassKg as number)}kg of ${stateLabel(p.outputState as string)}${extras}.`;
    }
    case "terminal_disposition":
      return `${lotCode(p.lotId as string)} was closed (${REASON_LABELS[p.reason as keyof typeof REASON_LABELS] || String(p.reason)}). It is out of active inventory.`;
    case "correction":
      return `A correction was recorded: ${String(p.reason)}.`;
    default:
      return String((ev as Event).eventType).replace(/_/g, " ");
  }
}
