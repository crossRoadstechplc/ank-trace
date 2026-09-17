"use client";

import { useState, type ReactNode } from "react";
import {
  displayActorName,
  fmtKg,
  routeLabel,
  stateLabel,
  type Event,
  type Ledger,
  type Lot,
} from "@/lib/ledger";
import type { SessionRole } from "@/lib/role-session";

function parentsOf(ledger: Ledger, lotId: string): string[] {
  return ledger.lineage.filter((e) => e.childLotId === lotId).map((e) => e.parentLotId);
}

function createdEvent(ledger: Ledger, lot: Lot): Event | undefined {
  return ledger.events.find((e) => e.eventId === lot.createdEventId);
}

function collectAllNodeIds(ledger: Ledger, lotId: string, acc: Set<string>): Set<string> {
  acc.add(lotId);
  for (const p of parentsOf(ledger, lotId)) collectAllNodeIds(ledger, p, acc);
  return acc;
}

function countOriginFarms(ledger: Ledger, lotId: string): number {
  const farmers = new Set<string>();
  const walk = (id: string) => {
    const parents = parentsOf(ledger, id);
    if (parents.length === 0) {
      const lot = ledger.lots.get(id);
      if (lot) Object.keys(lot.provenance).forEach((f) => farmers.add(f));
    } else parents.forEach(walk);
  };
  walk(lotId);
  return farmers.size;
}

export function LineageTracePanel({
  lots,
  ledger,
  lotCode,
  traceLotId,
  setTraceLotId,
  sessionRole,
}: {
  lots: Lot[];
  ledger: Ledger;
  lotCode: (id: string) => string;
  traceLotId: string;
  setTraceLotId: (id: string) => void;
  sessionRole: SessionRole;
}) {
  const [accordion, setAccordion] = useState<"" | "trace" | "forward">("");
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => new Set());
  const [moreOpen, setMoreOpen] = useState<Set<string>>(() => new Set());

  function resetForLot(lotId: string) {
    setAccordion("");
    setBreakdownOpen(false);
    setExpandedNodes(new Set());
    setMoreOpen(new Set());
    setTraceLotId(lotId);
  }

  const lot = traceLotId ? ledger.lots.get(traceLotId) : undefined;
  const farms = lot ? countOriginFarms(ledger, lot.lotId) : 0;
  const forward = lot ? ledger.forwardOneHop(lot.lotId) : [];
  const parents = lot ? parentsOf(ledger, lot.lotId) : [];

  function toggleAccordion(id: "trace" | "forward") {
    setAccordion((cur) => (cur === id ? "" : id));
  }

  function openBreakdown() {
    if (!lot) return;
    setBreakdownOpen(true);
    setAccordion("trace");
    setExpandedNodes(collectAllNodeIds(ledger, lot.lotId, new Set()));
  }

  function expandAll() {
    if (!lot) return;
    setExpandedNodes(collectAllNodeIds(ledger, lot.lotId, new Set()));
  }

  function collapseToRoot() {
    if (!lot) return;
    setExpandedNodes(new Set([lot.lotId]));
  }

  function toggleNode(id: string) {
    if (parentsOf(ledger, id).length === 0) return;
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleMore(id: string) {
    setMoreOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="tabpanel active">
      <h2 className="section-title">Lineage trace</h2>
      <p className="helper-note">
        Walk backward from any lot to farmer origin. The seeded demo cascades cherry through
        aggregation and processing with exact weight accounting, ending at FOB.
      </p>
      <div className="field">
        <label htmlFor="trace-lot">Select a lot</label>
        <select
          id="trace-lot"
          value={traceLotId}
          onChange={(e) => resetForLot(e.target.value)}
        >
          {lots.length === 0 ? (
            <option value="">No lots yet</option>
          ) : (
            lots.map((l) => (
              <option key={l.lotId} value={l.lotId}>
                {lotCode(l.lotId)} · {stateLabel(l.processingState)}
                {l.status !== "active" ? " · closed" : ""}
              </option>
            ))
          )}
        </select>
      </div>

      {lot && (
        <div className="lt-panel" style={{ marginTop: 14, maxWidth: 680 }}>
          <div className="lt-header">
            <div className="lt-uid">{lotCode(lot.lotId)}</div>
            <h3>{stateLabel(lot.processingState)}</h3>
            <div className="lt-meta">
              {routeLabel(lot.processingRoute)} · <b>{fmtKg(lot.canonicalMassKg)} kg</b> ·{" "}
              {lot.status === "active" ? "Active" : "Closed"}
            </div>
          </div>

          <LtSection
            title="Traceability"
            summary={`${farms} farm${farms !== 1 ? "s" : ""}`}
            open={accordion === "trace"}
            onToggle={() => toggleAccordion("trace")}
          >
            {breakdownOpen ? (
              <>
                <div className="lt-tree-tools">
                  <button type="button" className="secondary" onClick={expandAll}>
                    Expand all
                  </button>
                  <button type="button" className="secondary" onClick={collapseToRoot}>
                    Collapse to this lot
                  </button>
                </div>
                <TraceNode
                  lotId={lot.lotId}
                  isRoot
                  ledger={ledger}
                  lotCode={lotCode}
                  sessionRole={sessionRole}
                  expandedNodes={expandedNodes}
                  moreOpen={moreOpen}
                  onToggleNode={toggleNode}
                  onToggleMore={toggleMore}
                />
              </>
            ) : (
              <TraceSummary
                lot={lot}
                ledger={ledger}
                lotCode={lotCode}
                sessionRole={sessionRole}
                farms={farms}
                parentCount={parents.length}
                onViewBreakdown={openBreakdown}
              />
            )}
          </LtSection>

          <LtSection
            title="Forward visibility"
            summary={
              forward.length
                ? `${forward.length} next hop${forward.length !== 1 ? "s" : ""}`
                : "End of chain"
            }
            open={accordion === "forward"}
            onToggle={() => toggleAccordion("forward")}
          >
            <div className="trace-chain">
              <span
                className="trace-node"
                style={{ borderColor: "var(--ink)", color: "var(--ink)", fontWeight: 600 }}
              >
                {lotCode(lot.lotId)}
              </span>
              {forward.length > 0 ? (
                <>
                  <span className="trace-arrow">→</span>
                  {forward.map((f) => (
                    <span className="trace-node" key={f}>
                      {lotCode(f)}
                    </span>
                  ))}
                </>
              ) : (
                <span style={{ color: "var(--ink-soft)", fontSize: 12.5 }}>
                  No downstream lot — this is the end of the recorded chain.
                </span>
              )}
            </div>
            <p className="helper-note" style={{ margin: "10px 0 0" }}>
              Forward visibility is capped at one hop. Open a child lot above to keep walking
              downstream.
            </p>
          </LtSection>
        </div>
      )}
    </div>
  );
}

function LtSection({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="lt-section">
      <div className="lt-sec-head" onClick={onToggle} role="button" tabIndex={0}>
        <div className="lt-sec-title">{title}</div>
        <div className="lt-sec-summary">{summary}</div>
        <div className={`lt-sec-arrow${open ? " open" : ""}`}>▶</div>
      </div>
      <div className={`lt-sec-body${open ? " open" : ""}`}>{open ? children : null}</div>
    </div>
  );
}

function TraceSummary({
  lot,
  ledger,
  lotCode,
  sessionRole,
  farms,
  parentCount,
  onViewBreakdown,
}: {
  lot: Lot;
  ledger: Ledger;
  lotCode: (id: string) => string;
  sessionRole: SessionRole;
  farms: number;
  parentCount: number;
  onViewBreakdown: () => void;
}) {
  return (
    <>
      <div className="lt-row-kv">
        <span className="lt-rk">Lot</span>
        <span className="lt-rv">{lotCode(lot.lotId)}</span>
      </div>
      <div className="lt-row-kv">
        <span className="lt-rk">State</span>
        <span className="lt-rv">
          {stateLabel(lot.processingState)} · {routeLabel(lot.processingRoute)}
        </span>
      </div>
      <div className="lt-row-kv">
        <span className="lt-rk">Mass</span>
        <span className="lt-rv">{fmtKg(lot.canonicalMassKg)} kg</span>
      </div>
      <div className="lt-row-kv">
        <span className="lt-rk">Owner</span>
        <span className="lt-rv">{displayActorName(ledger, lot.ownerActorId, sessionRole)}</span>
      </div>
      <div className="lt-row-kv">
        <span className="lt-rk">Custodian</span>
        <span className="lt-rv">{displayActorName(ledger, lot.custodianActorId, sessionRole)}</span>
      </div>
      <div className="lt-gate">
        This lot traces to{" "}
        <b>
          {farms} farmer harvest batch{farms !== 1 ? "es" : ""}
        </b>
        {parentCount
          ? ` via ${parentCount} immediate upstream lot${parentCount !== 1 ? "s" : ""}`
          : " (this is an origin parcel)"}
        .
        <br />
        <button type="button" className="secondary" onClick={onViewBreakdown}>
          View Breakdown
        </button>
      </div>
    </>
  );
}

function TraceNode({
  lotId,
  isRoot,
  ledger,
  lotCode,
  sessionRole,
  expandedNodes,
  moreOpen,
  onToggleNode,
  onToggleMore,
}: {
  lotId: string;
  isRoot?: boolean;
  ledger: Ledger;
  lotCode: (id: string) => string;
  sessionRole: SessionRole;
  expandedNodes: Set<string>;
  moreOpen: Set<string>;
  onToggleNode: (id: string) => void;
  onToggleMore: (id: string) => void;
}) {
  const lot = ledger.lots.get(lotId);
  if (!lot) return null;

  const parents = parentsOf(ledger, lotId);
  const isLeaf = parents.length === 0;
  const expanded = expandedNodes.has(lotId);
  const showMore = moreOpen.has(lotId);
  const ev = createdEvent(ledger, lot);

  let title: string;
  let subtitle: string;
  if (isLeaf) {
    const farmerId = Object.keys(lot.provenance)[0];
    title = farmerId ? displayActorName(ledger, farmerId, sessionRole) : "Origin";
    subtitle = `Harvest parcel · ${lot.originLocationId || lot.locationId} · ${lot.cropYear}`;
  } else if (ev?.eventType === "disaggregate") {
    title = stateLabel(lot.processingState);
    subtitle = `Split from a larger lot · ${routeLabel(lot.processingRoute)}`;
  } else if (ev?.eventType === "aggregate") {
    title = `Aggregated ${stateLabel(lot.processingState).toLowerCase()}`;
    subtitle = `Combined from ${parents.length} harvest lots · ${routeLabel(lot.processingRoute)}`;
  } else if (ev?.eventType === "process") {
    const inputTotal = parents.reduce(
      (a, p) => a + (ledger.lots.get(p)?.canonicalMassKg ?? 0),
      0,
    );
    const yieldPct =
      inputTotal > 0 ? ((lot.canonicalMassKg / inputTotal) * 100).toFixed(1) : "—";
    title = stateLabel(lot.processingState);
    subtitle = `Processed here · yield ${yieldPct}% · ${routeLabel(lot.processingRoute)}`;
  } else {
    title = stateLabel(lot.processingState);
    subtitle = routeLabel(lot.processingRoute);
  }

  const badgeClass = isLeaf ? "trace-badge-origin" : `trace-badge-${lot.processingState}`;

  return (
    <div className="lt-node">
      <div
        className={`lt-row${isRoot ? " is-root" : ""}${expanded && !isLeaf ? " exp" : ""}`}
        onClick={() => onToggleNode(lotId)}
        role="button"
        tabIndex={0}
      >
        {isLeaf ? (
          <span className="lt-leaf" title="Farmer origin" />
        ) : (
          <span
            className={`lt-arr${expanded ? "" : " coll"}`}
            title={expanded ? "Collapse upstream lots" : "Expand upstream lots"}
          >
            ▼
          </span>
        )}
        <div className="lt-nbody">
          <div className="lt-n1">
            <span className={`trace-badge ${badgeClass}`}>{lotCode(lotId)}</span>
            <span className="trace-mass">{fmtKg(lot.canonicalMassKg)} kg</span>
          </div>
          <div className="lt-n2">{title}</div>
          <div className="lt-n3">{subtitle}</div>
          <button
            type="button"
            className="lt-more"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMore(lotId);
            }}
          >
            {showMore ? "▴ Hide" : "▾ More"}
          </button>
          {showMore ? (
            <TraceMorePanel
              lot={lot}
              ledger={ledger}
              lotCode={lotCode}
              sessionRole={sessionRole}
              parents={parents}
              ev={ev}
            />
          ) : null}
        </div>
      </div>
      {!isLeaf && expanded ? (
        <div className="lt-ch">
          {parents.map((p) => (
            <TraceNode
              key={p}
              lotId={p}
              ledger={ledger}
              lotCode={lotCode}
              sessionRole={sessionRole}
              expandedNodes={expandedNodes}
              moreOpen={moreOpen}
              onToggleNode={onToggleNode}
              onToggleMore={onToggleMore}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TraceMorePanel({
  lot,
  ledger,
  lotCode,
  sessionRole,
  parents,
  ev,
}: {
  lot: Lot;
  ledger: Ledger;
  lotCode: (id: string) => string;
  sessionRole: SessionRole;
  parents: string[];
  ev: Event | undefined;
}) {
  const rows: { k: string; v: ReactNode }[] = [
    { k: "Owner", v: <b>{displayActorName(ledger, lot.ownerActorId, sessionRole)}</b> },
    { k: "Custodian", v: <b>{displayActorName(ledger, lot.custodianActorId, sessionRole)}</b> },
    { k: "Origin plot", v: lot.originLocationId || lot.locationId },
    { k: "Current location", v: lot.locationId },
    { k: "Crop year", v: lot.cropYear },
    { k: "Route", v: routeLabel(lot.processingRoute) },
    {
      k: "Origin basis",
      v: lot.originStatus === "farmer_verified" ? "Farmer verified" : "Recorded by counterparty",
    },
    { k: "Status", v: lot.status === "active" ? "Active" : "Closed" },
  ];

  if (parents.length) {
    rows.push({ k: "Parent lots", v: parents.map(lotCode).join(", ") });
  }

  if (ev?.eventType === "process") {
    const input = parents.reduce((a, p) => a + (ledger.lots.get(p)?.canonicalMassKg ?? 0), 0);
    const outputMassKg = (ev.payload.outputMassKg as number) || 0;
    const rejectKg = (ev.payload.rejectKg as number) || 0;
    const lossKg = (ev.payload.lossKg as number) || 0;
    rows.push({ k: "Input", v: <b>{fmtKg(input)} kg</b> });
    rows.push({ k: "Product", v: <b>{fmtKg(outputMassKg)} kg</b> });
    rows.push({ k: "Reject", v: <b>{fmtKg(rejectKg)} kg</b> });
    rows.push({
      k: "Weight loss",
      v: (
        <>
          <b>{fmtKg(lossKg)} kg</b>
          {ev.payload.lossCategory ? ` · ${String(ev.payload.lossCategory)}` : ""}
        </>
      ),
    });
    rows.push({
      k: "Balance",
      v: `${fmtKg(input)} = ${fmtKg(outputMassKg)} + ${fmtKg(rejectKg)} + ${fmtKg(lossKg)}`,
    });
  }

  if (ev?.eventType === "aggregate") {
    rows.push({ k: "Combined from", v: <b>{parents.length} lots</b> });
    const prov =
      sessionRole === "exporter"
        ? `${Object.keys(lot.provenance).length} identities protected`
        : Object.entries(lot.provenance)
            .map(
              ([id, p]) =>
                `${displayActorName(ledger, id, sessionRole)} ${(p * 100).toFixed(1)}%`,
            )
            .join(" · ");
    rows.push({ k: "Provenance", v: prov });
  }

  rows.push({ k: "Event", v: lot.createdEventId });

  return (
    <div className="lt-dpanel">
      {rows.map((r) => (
        <div key={r.k}>
          <span className="lt-dk">{r.k}</span>
          {r.v}
        </div>
      ))}
    </div>
  );
}
