"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ACTOR_TYPE_LABELS,
  METADATA_FIELDS,
  actorDeliveriesTo,
  actorTypeLabel,
  displayActorName,
  fmtKg,
  formatEventTime,
  sponsoredBy,
  stateLabel,
  type Actor,
} from "@/lib/ledger";
import { useLedger } from "./ledger-context";

export function NetworkView() {
  const { ledger, actingActorId, sessionRole, actingDisplayName, lotCode, version } = useLedger();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const root = ledger.actors.get(actingActorId);

  const sections = useMemo(() => {
    if (!root) return [] as Actor[];
    if (sessionRole === "exporter") {
      return sponsoredBy(ledger, actingActorId)
        .filter((a) => a.actorType === "akrabi")
        .sort((a, b) => a.legalIdentityRef.localeCompare(b.legalIdentityRef));
    }
    if (sessionRole === "akrabi") {
      return sponsoredBy(ledger, actingActorId)
        .filter((a) => a.actorType === "collector")
        .sort((a, b) => a.legalIdentityRef.localeCompare(b.legalIdentityRef));
    }
    if (sessionRole === "collector") {
      return [root];
    }
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger, actingActorId, sessionRole, version]);

  const helper =
    sessionRole === "farmer"
      ? "Your farm profile."
      : sessionRole === "collector"
        ? "Farmers you collect from (Farmer 1, Farmer 2…)."
        : sessionRole === "akrabi"
          ? "Collectors you sponsored (Collector 1…). Farmers only through collectors."
          : "Aggregators in your network (Aggregator 1…) and their collectors.";

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

  function sectionChildren(sectionId: string): Actor[] {
    const children = sponsoredBy(ledger, sectionId);
    if (sessionRole === "exporter") {
      // Aggregator section: collectors + processing sites (no direct farmers).
      const collectors = children
        .filter((c) => c.actorType === "collector")
        .sort((a, b) => a.legalIdentityRef.localeCompare(b.legalIdentityRef));
      const stations = children.filter(
        (c) => c.actorType === "washing_station" || c.actorType === "mill",
      );
      return [...collectors, ...stations];
    }
    if (sessionRole === "akrabi") {
      // Collector section: farmers under that collector.
      return children
        .filter((c) => c.actorType === "farmer")
        .sort((a, b) => a.legalIdentityRef.localeCompare(b.legalIdentityRef));
    }
    // Collector viewing self: farmers + any sites (none expected).
    const farmers = children
      .filter((c) => c.actorType === "farmer")
      .sort((a, b) => a.legalIdentityRef.localeCompare(b.legalIdentityRef));
    const stations = children.filter(
      (c) => c.actorType === "washing_station" || c.actorType === "mill",
    );
    return [...stations, ...farmers];
  }

  return (
    <div className="view active">
      <div className="page-head">
        <h2 className="section-title">
          {`${actingDisplayName}'s network`}
        </h2>
        <p className="helper-note">{helper}</p>
      </div>

      {sessionRole === "farmer" ? (
        root ? (
          <div className="lot-grid">
            <NetworkCard
              actor={root}
              label={actingDisplayName}
              onOpen={() => setProfileId(root.actorId)}
            />
          </div>
        ) : (
          <div className="empty-state">Your farm profile is not available.</div>
        )
      ) : sections.length === 0 ? (
        <div className="empty-state">
          {`${actingDisplayName} has not onboarded anyone yet.`}
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
          {sections.map((section) => {
            const children = sectionChildren(section.actorId);
            const allChildren = sponsoredBy(ledger, section.actorId);
            const collectorsUnder = allChildren.filter((c) => c.actorType === "collector");
            const farmers = allChildren.filter((c) => c.actorType === "farmer");
            // For exporter aggregator sections, count farms via collectors.
            const farmsViaCollectors =
              sessionRole === "exporter"
                ? collectorsUnder.reduce(
                    (n, col) =>
                      n +
                      sponsoredBy(ledger, col.actorId).filter((a) => a.actorType === "farmer")
                        .length,
                    0,
                  )
                : farmers.length;
            const stations = allChildren.filter(
              (c) => c.actorType === "washing_station" || c.actorType === "mill",
            );
            const open = expanded.has(section.actorId);
            const meta = section.metadata || {};
            const loc = [meta.woreda, meta.zone].filter(Boolean).join(", ");

            return (
              <div className="net-section" key={section.actorId}>
                <div
                  className="net-head"
                  onClick={() => toggleSection(section.actorId)}
                  role="button"
                  tabIndex={0}
                >
                  <span className={`net-arrow${open ? " open" : ""}`}>▶</span>
                  <div className="net-head-body">
                    <div
                      className="net-head-title"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProfileId(section.actorId);
                      }}
                    >
                      <b>
                        {section.actorId === actingActorId
                          ? actingDisplayName
                          : displayActorName(ledger, section.actorId, sessionRole)}
                      </b>
                    </div>
                    <div className="net-head-sub">
                      {sessionRole === "exporter" || sessionRole === "akrabi" ? null : loc ? (
                        <>
                          {loc}
                          {" · "}
                        </>
                      ) : null}
                      {sessionRole === "exporter" ? (
                        <>
                          <b>{collectorsUnder.length}</b> collector
                          {collectorsUnder.length !== 1 ? "s" : ""}
                          {" · "}
                          <b>{stations.length}</b> processing site
                          {stations.length !== 1 ? "s" : ""}
                          {farmsViaCollectors > 0 ? (
                            <>
                              {" "}
                              · <b>{farmsViaCollectors}</b> farm
                              {farmsViaCollectors !== 1 ? "s" : ""}
                            </>
                          ) : null}
                        </>
                      ) : sessionRole === "akrabi" ? (
                        <>
                          <b>{farmers.length}</b> farmer
                          {farmers.length !== 1 ? "s" : ""}
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
                      label={
                        c.actorType === "farmer" ||
                        c.actorType === "collector" ||
                        c.actorType === "akrabi"
                          ? displayActorName(ledger, c.actorId, sessionRole)
                          : undefined
                      }
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
            setProfileId(id);
          }}
          lotCode={lotCode}
          allowChildren={true}
        />
      )}
    </div>
  );
}

function NetworkCard({
  actor,
  onOpen,
  label,
}: {
  actor: Actor;
  onOpen: () => void;
  label?: string;
}) {
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
        <b>{label ?? actor.displayName}</b>
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
  const { ledger, actingActorId, sessionRole, actingDisplayName } = useLedger();
  const actor = ledger.actors.get(actorId);
  if (!actor) return null;

  const meta = actor.metadata || {};
  const fields = METADATA_FIELDS[actor.actorType] || [];
  const sponsor = actor.sponsorActorId ? ledger.actors.get(actor.sponsorActorId) : null;
  const children = allowChildren
    ? sponsoredBy(ledger, actorId)
        .filter((c) => {
          if (sessionRole === "collector") {
            return c.actorType === "farmer";
          }
          if (sessionRole === "akrabi") {
            return (
              c.actorType === "farmer" ||
              c.actorType === "collector" ||
              c.actorType === "washing_station" ||
              c.actorType === "mill"
            );
          }
          if (sessionRole === "exporter") {
            return (
              c.actorType === "collector" ||
              c.actorType === "washing_station" ||
              c.actorType === "mill"
            );
          }
          return true;
        })
        .sort((a, b) => a.legalIdentityRef.localeCompare(b.legalIdentityRef))
    : [];

  const metaRows =
    sessionRole === "exporter" ||
    sessionRole === "akrabi" ||
    sessionRole === "collector"
      ? fields.filter(([key]) => meta[key] && key !== "phone" && key !== "contactPerson")
      : fields.filter(([key]) => meta[key]);
  const titleName =
    actorId === actingActorId
      ? actingDisplayName
      : displayActorName(ledger, actorId, sessionRole);

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
        <span className="net-card-type">{actorTypeLabel(actor.actorType)}</span>
        <h3 style={{ margin: "8px 0 2px" }}>
          <b>{titleName}</b>
        </h3>
        <p className="helper-note" style={{ margin: "0 0 14px" }}>
          {actor.legalIdentityRef}
          {sponsor && sessionRole !== "exporter" ? (
            <>
              {" "}
              · Onboarded by{" "}
              <b>{displayActorName(ledger, sponsor.actorId, sessionRole)}</b>
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
        {children.length > 0 && (
          <>
            <h3 className="subhead" style={{ marginTop: 18 }}>
              In {titleName}&apos;s network
            </h3>
            {children.map((c) => (
              <div className="lt-row-kv" key={c.actorId}>
                <span className="lt-rk">{ACTOR_TYPE_LABELS[c.actorType]}</span>
                <span
                  className="lt-rv"
                  style={{ cursor: "pointer", textDecoration: "underline" }}
                  onClick={() => onOpenActor(c.actorId)}
                >
                  {c.actorType === "farmer" ||
                  c.actorType === "collector" ||
                  c.actorType === "akrabi"
                    ? displayActorName(ledger, c.actorId, sessionRole)
                    : c.displayName}
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
