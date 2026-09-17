"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ACTOR_TYPE_LABELS,
  METADATA_FIELDS,
  actorDeliveriesTo,
  actorTypeLabel,
  fmtKg,
  formatEventTime,
  sponsoredBy,
  stateLabel,
  type Actor,
} from "@/lib/ledger";
import { useLedger } from "./ledger-context";

export function NetworkView() {
  const { ledger, actingActorId, sessionRole, lotCode, version } = useLedger();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const root = ledger.actors.get(actingActorId);

  const sections = useMemo(() => {
    if (!root) return [] as Actor[];
    if (sessionRole === "exporter") {
      return sponsoredBy(ledger, actingActorId).filter((a) => a.actorType === "akrabi");
    }
    if (sessionRole === "akrabi") {
      return [root];
    }
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger, actingActorId, sessionRole, version]);

  const helper =
    sessionRole === "farmer"
      ? "Your farm profile."
      : sessionRole === "akrabi"
        ? "Farmers and processing sites you sponsored."
        : "Processing sites under each aggregator. Farmer names stay hidden.";

  function toggleSection(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(sections.map((a) => a.actorId)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  function sectionChildren(akrabiId: string): Actor[] {
    const children = sponsoredBy(ledger, akrabiId);
    const stations = children.filter(
      (c) => c.actorType === "washing_station" || c.actorType === "mill",
    );
    const farmers = children.filter((c) => c.actorType === "farmer");
    // Exporters never see farmer cards in the cascade.
    if (sessionRole === "exporter") return stations;
    return [...stations, ...farmers];
  }

  return (
    <div className="view active">
      <div className="page-head">
        <h2 className="section-title">
          {root ? `${root.displayName}'s network` : "Network"}
        </h2>
        <p className="helper-note">{helper}</p>
      </div>

      {sessionRole === "farmer" ? (
        root ? (
          <div className="lot-grid">
            <NetworkCard actor={root} onOpen={() => setProfileId(root.actorId)} />
          </div>
        ) : (
          <div className="empty-state">Your farm profile is not available.</div>
        )
      ) : sections.length === 0 ? (
        <div className="empty-state">
          {`${root ? root.displayName : "This account"} has not onboarded anyone yet.`}
        </div>
      ) : (
        <>
          <div className="net-tools">
            <button type="button" className="secondary" onClick={expandAll}>
              Expand all
            </button>
            <button type="button" className="secondary" onClick={collapseAll}>
              Collapse all
            </button>
          </div>
          {sections.map((akrabi) => {
            const children = sectionChildren(akrabi.actorId);
            const allChildren = sponsoredBy(ledger, akrabi.actorId);
            const farmers = allChildren.filter((c) => c.actorType === "farmer");
            const stations = allChildren.filter(
              (c) => c.actorType === "washing_station" || c.actorType === "mill",
            );
            const open = expanded.has(akrabi.actorId);
            const meta = akrabi.metadata || {};
            const loc = [meta.woreda, meta.zone].filter(Boolean).join(", ");

            return (
              <div className="net-section" key={akrabi.actorId}>
                <div
                  className="net-head"
                  onClick={() => toggleSection(akrabi.actorId)}
                  role="button"
                  tabIndex={0}
                >
                  <span className={`net-arrow${open ? " open" : ""}`}>▶</span>
                  <div className="net-head-body">
                    <div
                      className="net-head-title"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProfileId(akrabi.actorId);
                      }}
                    >
                      <b>{akrabi.displayName}</b>
                    </div>
                    <div className="net-head-sub">
                      {loc}
                      {loc ? " · " : ""}
                      {sessionRole === "exporter" ? (
                        <>
                          <b>{stations.length}</b> processing site
                          {stations.length !== 1 ? "s" : ""}
                          {farmers.length > 0 ? (
                            <>
                              {" "}
                              · <b>{farmers.length}</b> farm
                              {farmers.length !== 1 ? "s" : ""} (identities protected)
                            </>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <b>{farmers.length}</b> farmer
                          {farmers.length !== 1 ? "s" : ""}
                          {stations.length ? (
                            <>
                              {" "}
                              · <b>{stations.length}</b> processing site
                              {stations.length !== 1 ? "s" : ""}
                            </>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className={`net-body${open ? " open" : ""}`}>
                  {children.map((c) => (
                    <NetworkCard
                      key={c.actorId}
                      actor={c}
                      onOpen={() => setProfileId(c.actorId)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {profileId && (
        <ActorProfileModal
          actorId={profileId}
          onClose={() => setProfileId(null)}
          onOpenActor={(id) => {
            const target = ledger.actors.get(id);
            if (sessionRole === "exporter" && target?.actorType === "farmer") return;
            setProfileId(id);
          }}
          lotCode={lotCode}
          allowChildren={sessionRole !== "exporter"}
        />
      )}
    </div>
  );
}

function NetworkCard({ actor, onOpen }: { actor: Actor; onOpen: () => void }) {
  const meta = actor.metadata || {};
  const typeLabel = ACTOR_TYPE_LABELS[actor.actorType] || actor.actorType;
  const subBits: ReactNode[] = [];
  if (actor.actorType === "farmer") {
    if (meta.kebele) subBits.push(String(meta.kebele));
    if (meta.farmSizeHa) subBits.push(<b key="ha">{String(meta.farmSizeHa)} ha</b>);
    if (meta.variety) subBits.push(String(meta.variety));
  } else {
    if (meta.kebele) subBits.push(String(meta.kebele));
    if (meta.capacityKgPerDay)
      subBits.push(<b key="cap">{fmtKg(meta.capacityKgPerDay)} kg/day</b>);
  }

  return (
    <div className="net-card" onClick={onOpen} role="button" tabIndex={0}>
      <span className="net-card-type">{typeLabel}</span>
      <div className="net-card-title">
        <b>{actor.displayName}</b>
      </div>
      <div className="net-card-sub">
        {subBits.map((bit, i) => (
          <span key={i}>
            {i > 0 ? " · " : ""}
            {bit}
          </span>
        ))}
      </div>
    </div>
  );
}

function ActorProfileModal({
  actorId,
  onClose,
  onOpenActor,
  lotCode,
  allowChildren,
}: {
  actorId: string;
  onClose: () => void;
  onOpenActor: (id: string) => void;
  lotCode: (id: string) => string;
  allowChildren: boolean;
}) {
  const { ledger, actingActorId, sessionRole } = useLedger();
  const actor = ledger.actors.get(actorId);
  if (!actor) return null;

  if (sessionRole === "exporter" && actor.actorType === "farmer") {
    return (
      <div className="modal-overlay show" role="dialog" aria-modal="true">
        <div className="modal">
          <h3>Hidden</h3>
          <p className="helper-note">Farmer names are not shown to exporters.</p>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const meta = actor.metadata || {};
  const fields = METADATA_FIELDS[actor.actorType] || [];
  const sponsor = actor.sponsorActorId ? ledger.actors.get(actor.sponsorActorId) : null;
  const children = allowChildren
    ? sponsoredBy(ledger, actorId).filter((c) =>
        sessionRole === "akrabi" ? c.actorType === "farmer" || c.actorType === "washing_station" || c.actorType === "mill" : true,
      )
    : [];

  const metaRows = fields.filter(([key]) => meta[key]);

  return (
    <div className="modal-overlay show" role="dialog" aria-modal="true">
      <div className="modal modal-wide">
        <span className="net-card-type">{actorTypeLabel(actor.actorType)}</span>
        <h3 style={{ margin: "8px 0 2px" }}>
          <b>{actor.displayName}</b>
        </h3>
        <p className="helper-note" style={{ margin: "0 0 14px" }}>
          {actor.legalIdentityRef}
          {sponsor && sessionRole !== "exporter" ? (
            <>
              {" "}
              · Onboarded by <b>{sponsor.displayName}</b>
            </>
          ) : null}
          {sponsor && sessionRole === "exporter" && actor.actorType === "akrabi" ? (
            <> · In your sponsored network</>
          ) : null}
        </p>
        {metaRows.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            {metaRows.map(([key, label]) => (
              <div className="lt-row-kv" key={key}>
                <span className="lt-rk">{label}</span>
                <span className="lt-rv">{String(meta[key])}</span>
              </div>
            ))}
          </div>
        )}
        {actingActorId !== actorId && (
          <DeliveryHistory actorId={actorId} lotCode={lotCode} />
        )}
        {sessionRole === "exporter" && actor.actorType === "akrabi" && (
          <p className="helper-note" style={{ marginTop: 14 }}>
            Farmer names under this aggregator are hidden.
          </p>
        )}
        {children.length > 0 && (
          <>
            <h3 className="subhead" style={{ marginTop: 18 }}>
              Onboarded by {actor.displayName}
            </h3>
            {children.map((c) => (
              <div className="lt-row-kv" key={c.actorId}>
                <span className="lt-rk">{ACTOR_TYPE_LABELS[c.actorType]}</span>
                <span
                  className="lt-rv"
                  style={{ cursor: "pointer", textDecoration: "underline" }}
                  onClick={() => onOpenActor(c.actorId)}
                >
                  {c.displayName}
                </span>
              </div>
            ))}
          </>
        )}
        <div className="btn-row" style={{ marginTop: 18 }}>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DeliveryHistory({
  actorId,
  lotCode,
}: {
  actorId: string;
  lotCode: (id: string) => string;
}) {
  const { ledger, actingActorId } = useLedger();
  const rows = actorDeliveriesTo(ledger, actorId, actingActorId);

  if (rows.length === 0) return null;

  return (
    <>
      <h3 className="subhead" style={{ marginTop: 18 }}>
        Historical supplies to you
      </h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Lot</th>
              <th>Form</th>
              <th>Weight</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.lot.lotId}-${i}`}>
                <td>{lotCode(r.lot.lotId)}</td>
                <td>{stateLabel(r.lot.processingState)}</td>
                <td>
                  <b>{fmtKg(r.receivedKg)} kg</b>
                </td>
                <td className="mono-small">{formatEventTime(r.time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
