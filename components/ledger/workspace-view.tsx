"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  InvariantViolation,
  LOSS_ELIGIBLE_STATES,
  REASON_LABELS,
  actorLabel,
  allowedSendTargets,
  displayActorName,
  primaryWorkspaceAction,
  routeLabel,
  stateLabel,
  type Lot,
  type ProcessingRoute,
  type ProcessingState,
  type TerminalReason,
} from "@/lib/ledger";
import { useLedger } from "./ledger-context";

type Action =
  | null
  | "send"
  | "split"
  | "combine"
  | "process"
  | "transfer"
  | "close"
  | "newLot"
  | "confirmReceipt";

function catchInv(err: unknown, toast: (m: string, e?: boolean) => void) {
  const msg =
    err instanceof InvariantViolation
      ? err.message
      : err instanceof Error
        ? err.message
        : "Something went wrong.";
  toast(msg, true);
}

export function WorkspaceView() {
  const {
    ledger,
    actingActorId,
    sessionRole,
    selectedLotId,
    setSelectedLotId,
    lotCode,
    refresh,
    toast,
    version,
  } = useLedger();

  const [action, setAction] = useState<Action>(null);
  const [movementId, setMovementId] = useState<string | null>(null);

  // Reset ephemeral action when actor changes
  useEffect(() => {
    setAction(null);
    setMovementId(null);
  }, [actingActorId]);

  const actor = ledger.actors.get(actingActorId);
  const primary = primaryWorkspaceAction(sessionRole);
  const incoming = useMemo(
    () =>
      [...ledger.movements.values()].filter(
        (m) => m.state === "pending" && m.toActorId === actingActorId,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ledger, actingActorId, version],
  );
  const held = useMemo(
    () => ledger.currentInventory(actingActorId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ledger, actingActorId, version],
  );

  function selectLot(id: string) {
    setSelectedLotId(id);
    setAction(null);
    setMovementId(null);
  }

  function openNewLot() {
    setSelectedLotId(null);
    setMovementId(null);
    setAction("newLot");
  }

  function openConfirm(mid: string) {
    setSelectedLotId(null);
    setMovementId(mid);
    setAction("confirmReceipt");
  }

  function cancelAction() {
    setAction(null);
    setMovementId(null);
    refresh();
  }

  function backToDetail() {
    setAction(null);
  }

  function deselectLot() {
    setSelectedLotId(null);
    setAction(null);
  }

  const selected = selectedLotId ? ledger.lots.get(selectedLotId) : undefined;

  return (
    <div className="view active">
      <div className="primary-action">
        {primary === "newLot" && (
          <button type="button" onClick={openNewLot}>
            + Start a new lot from harvest
          </button>
        )}
        {primary === "addFarmer" && (
          <p className="helper-note" style={{ margin: 0 }}>
            Use <b>+ Add new farmer</b> in the toolbar to grow your sponsored network.
          </p>
        )}
        {primary === "addAkrabi" && (
          <p className="helper-note" style={{ margin: 0 }}>
            Use <b>+ Add new akrabi</b> in the toolbar to grow your sponsored aggregators.
          </p>
        )}
      </div>

      <div className="incoming-block">
        {incoming.length > 0 && (
          <>
            <h3 className="subhead">Incoming — needs your confirmation</h3>
            {incoming.map((m) => {
              const lot = ledger.lots.get(m.lotId);
              return (
                <div className="incoming-card" key={m.movementId}>
                  <div className="meta">
                    <div className="lotcode">
                      {lotCode(m.lotId)}
                      {lot ? ` · ${stateLabel(lot.processingState)}` : ""}
                    </div>
                    <div className="sub">
                      from {displayActorName(ledger, m.fromActorId, sessionRole)} · sender declared{" "}
                      {m.senderDeclaredKg}kg
                    </div>
                  </div>
                  <button type="button" onClick={() => openConfirm(m.movementId)}>
                    Confirm receipt
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="page-head">
        <h2 className="section-title">
          {actor ? `Lots ${actor.displayName} is holding` : "Lots you're holding"}
        </h2>
      </div>

      <div className="lot-list">
        {held.length === 0 ? (
          <div className="empty-state">No active lots in this actor&apos;s custody right now.</div>
        ) : (
          <>
            <div className="lot-list-header">
              <span>Code</span>
              <span>Form</span>
              <span>Owner</span>
              <span>Weight</span>
              <span>Status</span>
            </div>
            {held.map((l) => (
              <div
                key={l.lotId}
                className={`lot-list-row${l.lotId === selectedLotId ? " selected" : ""}`}
                onClick={() => selectLot(l.lotId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") selectLot(l.lotId);
                }}
              >
                <span className="llr-code">{lotCode(l.lotId)}</span>
                <span className="llr-form">
                  {stateLabel(l.processingState)} · {routeLabel(l.processingRoute)}
                </span>
                <span className="llr-owner">
                  {displayActorName(ledger, l.ownerActorId, sessionRole)}
                </span>
                <span className="llr-weight">{l.canonicalMassKg} kg</span>
                <span className={`badge ${l.inTransit ? "transit" : "active"}`}>
                  {l.inTransit ? "in transit" : "active"}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      <div>
        {action === "newLot" && (
          <NewLotForm
            onCancel={cancelAction}
            actingActorId={actingActorId}
            ledger={ledger}
            lotCode={lotCode}
            refresh={refresh}
            toast={toast}
            setSelectedLotId={setSelectedLotId}
            setAction={setAction}
          />
        )}
        {action === "confirmReceipt" && movementId && (
          <ConfirmReceiptForm
            movementId={movementId}
            onCancel={cancelAction}
            ledger={ledger}
            lotCode={lotCode}
            refresh={refresh}
            toast={toast}
            setAction={setAction}
            setMovementId={setMovementId}
          />
        )}
        {!action && selected && (
          <LotDetail
            lot={selected}
            lotCode={lotCode}
            ledger={ledger}
            onBack={deselectLot}
            onAction={(a) => setAction(a)}
          />
        )}
        {action &&
          selected &&
          action !== "newLot" &&
          action !== "confirmReceipt" && (
            <ActionForm
              action={action}
              lot={selected}
              actingActorId={actingActorId}
              ledger={ledger}
              lotCode={lotCode}
              refresh={refresh}
              toast={toast}
              onBack={backToDetail}
              clearSelection={() => {
                setSelectedLotId(null);
                setAction(null);
              }}
              keepSelection={() => setAction(null)}
            />
          )}
      </div>
    </div>
  );
}

function LotDetail({
  lot,
  lotCode,
  ledger,
  onBack,
  onAction,
}: {
  lot: Lot;
  lotCode: (id: string) => string;
  ledger: ReturnType<typeof useLedger>["ledger"];
  onBack: () => void;
  onAction: (a: Action) => void;
}) {
  return (
    <div className="detail-panel">
      <span className="back-link" onClick={onBack} role="button" tabIndex={0}>
        ← back to lots
      </span>
      <div className="detail-header">
        <h3>
          {lotCode(lot.lotId)} — {stateLabel(lot.processingState)}
        </h3>
        <span className="lotcode">{lot.lotId}</span>
      </div>
      <div className="detail-facts">
        <div>
          <div className="fact-label">Mass</div>
          <div className="fact-value">{lot.canonicalMassKg}kg</div>
        </div>
        <div>
          <div className="fact-label">Route</div>
          <div className="fact-value">{routeLabel(lot.processingRoute)}</div>
        </div>
        <div>
          <div className="fact-label">Crop year</div>
          <div className="fact-value">{lot.cropYear}</div>
        </div>
        <div>
          <div className="fact-label">Owner</div>
          <div className="fact-value">{actorLabel(ledger, lot.ownerActorId)}</div>
        </div>
        <div>
          <div className="fact-label">Custodian</div>
          <div className="fact-value">{actorLabel(ledger, lot.custodianActorId)}</div>
        </div>
        <div>
          <div className="fact-label">Origin basis</div>
          <div className="fact-value">
            {lot.originStatus === "farmer_verified"
              ? "Farmer verified"
              : "Recorded by counterparty"}
          </div>
        </div>
      </div>
      {lot.inTransit ? (
        <p className="warn-note">
          This lot has a shipment in progress. No action can be taken until the receiving party
          confirms it.
        </p>
      ) : (
        <div className="action-grid">
          {(
            [
              ["send", "Send to someone else", "Hand this lot to another actor"],
              ["split", "Split this lot", "Divide it into two or more lots"],
              ["combine", "Combine with another lot", "Merge with compatible lots you hold"],
              ["process", "Process it", "Record a transformation, e.g. drying or milling"],
              ["transfer", "Transfer ownership", "Change who owns it, without moving it"],
              ["close", "Close this lot", "Export, domestic sale, or loss — final"],
            ] as const
          ).map(([key, title, sub]) => (
            <button key={key} type="button" className="action-btn" onClick={() => onAction(key)}>
              <div className="a-title">{title}</div>
              <div className="a-sub">{sub}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewLotForm({
  onCancel,
  actingActorId,
  ledger,
  lotCode,
  refresh,
  toast,
  setSelectedLotId,
  setAction,
}: {
  onCancel: () => void;
  actingActorId: string;
  ledger: ReturnType<typeof useLedger>["ledger"];
  lotCode: (id: string) => string;
  refresh: () => void;
  toast: (m: string, e?: boolean) => void;
  setSelectedLotId: (id: string | null) => void;
  setAction: (a: Action) => void;
}) {
  const actors = [...ledger.actors.values()];
  const [farmerId, setFarmerId] = useState(
    actors.find((a) => a.actorType === "farmer")?.actorId ?? actors[0]?.actorId ?? "",
  );
  const [massKg, setMassKg] = useState("500");
  const [processingState, setProcessingState] = useState<ProcessingState>("cherry");
  const [processingRoute, setProcessingRoute] = useState<ProcessingRoute>("washed");
  const [cropYear, setCropYear] = useState("2025-2026");

  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const lot = ledger.createOriginLot({
        farmerActorId: farmerId,
        recordedByActorId: actingActorId,
        executingPersonId: actingActorId,
        massKg: parseFloat(massKg),
        processingState,
        processingRoute,
        locationId: "field entry",
        cropYear: cropYear.trim(),
      });
      setAction(null);
      setSelectedLotId(null);
      refresh();
      toast(
        `${lotCode(lot.lotId)} created — ${lot.canonicalMassKg}kg ${stateLabel(lot.processingState)}.`,
      );
    } catch (err) {
      catchInv(err, toast);
    }
  }

  return (
    <div className="detail-panel">
      <span className="back-link" onClick={onCancel} role="button" tabIndex={0}>
        ← cancel
      </span>
      <h3 style={{ fontFamily: "var(--font)", fontSize: 20, margin: "0 0 16px" }}>
        Start a new lot from harvest
      </h3>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="nl-farmer">Which farmer is this coffee from?</label>
          <select id="nl-farmer" value={farmerId} onChange={(e) => setFarmerId(e.target.value)}>
            {actors.map((a) => (
              <option key={a.actorId} value={a.actorId}>
                {a.displayName} ({a.actorType})
              </option>
            ))}
          </select>
        </div>
        <p className="helper-note">
          {farmerId === actingActorId
            ? "You are the farmer, so this will be marked farmer-verified."
            : `You are recording this on behalf of ${actorLabel(ledger, farmerId)} — it will be marked as recorded by a counterparty, not farmer-verified, until confirmed.`}
        </p>
        <div className="field">
          <label htmlFor="nl-mass">Mass (kg)</label>
          <input
            id="nl-mass"
            type="number"
            value={massKg}
            min={0.01}
            step={0.01}
            onChange={(e) => setMassKg(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="nl-state">Form it&apos;s in</label>
          <select
            id="nl-state"
            value={processingState}
            onChange={(e) => setProcessingState(e.target.value as ProcessingState)}
          >
            <option value="cherry">Cherry</option>
            <option value="dried_cherry">Dried cherry</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="nl-route">Route</label>
          <select
            id="nl-route"
            value={processingRoute}
            onChange={(e) => setProcessingRoute(e.target.value as ProcessingRoute)}
          >
            <option value="washed">Washed</option>
            <option value="natural">Natural</option>
            <option value="unknown_at_origin">Not decided yet</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="nl-crop">Crop year</label>
          <input
            id="nl-crop"
            type="text"
            value={cropYear}
            onChange={(e) => setCropYear(e.target.value)}
          />
        </div>
        <button type="submit">Create lot</button>
      </form>
    </div>
  );
}

function ConfirmReceiptForm({
  movementId,
  onCancel,
  ledger,
  lotCode,
  refresh,
  toast,
  setAction,
  setMovementId,
}: {
  movementId: string;
  onCancel: () => void;
  ledger: ReturnType<typeof useLedger>["ledger"];
  lotCode: (id: string) => string;
  refresh: () => void;
  toast: (m: string, e?: boolean) => void;
  setAction: (a: Action) => void;
  setMovementId: (id: string | null) => void;
}) {
  const mv = ledger.movements.get(movementId);
  const lot = mv ? ledger.lots.get(mv.lotId) : undefined;
  const [mass, setMass] = useState(String(mv?.senderDeclaredKg ?? 0));

  if (!mv || !lot) {
    return (
      <div className="detail-panel">
        <p className="warn-note">Movement not found.</p>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const receiverDeclaredKg = parseFloat(mass);
      const result = ledger.movementReceive({
        movementId,
        receiverDeclaredKg,
        executingPersonId: mv!.toActorId,
      });
      setAction(null);
      setMovementId(null);
      refresh();
      if (result.state === "received_clean") toast("Receipt confirmed — matches exactly.");
      else
        toast(
          `Receipt confirmed with a ${(receiverDeclaredKg - mv!.senderDeclaredKg).toFixed(2)}kg discrepancy — logged, both figures kept.`,
        );
    } catch (err) {
      catchInv(err, toast);
    }
  }

  return (
    <div className="detail-panel">
      <span className="back-link" onClick={onCancel} role="button" tabIndex={0}>
        ← cancel
      </span>
      <h3 style={{ fontFamily: "var(--font)", fontSize: 20, margin: "0 0 16px" }}>
        Confirm receipt of {lotCode(lot.lotId)}
      </h3>
      <p className="helper-note">
        From {actorLabel(ledger, mv.fromActorId)}, declared as {mv.senderDeclaredKg}kg.
      </p>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="mr-mass">What did you actually receive (kg)?</label>
          <input
            id="mr-mass"
            type="number"
            step={0.01}
            value={mass}
            onChange={(e) => setMass(e.target.value)}
          />
        </div>
        <button type="submit">Confirm receipt</button>
      </form>
    </div>
  );
}

function ActionForm({
  action,
  lot,
  actingActorId,
  ledger,
  lotCode,
  refresh,
  toast,
  onBack,
  clearSelection,
  keepSelection,
}: {
  action: Exclude<Action, null | "newLot" | "confirmReceipt">;
  lot: Lot;
  actingActorId: string;
  ledger: ReturnType<typeof useLedger>["ledger"];
  lotCode: (id: string) => string;
  refresh: () => void;
  toast: (m: string, e?: boolean) => void;
  onBack: () => void;
  clearSelection: () => void;
  keepSelection: () => void;
}) {
  if (action === "send")
    return (
      <SendForm
        lot={lot}
        actingActorId={actingActorId}
        ledger={ledger}
        lotCode={lotCode}
        refresh={refresh}
        toast={toast}
        onBack={onBack}
        clearSelection={clearSelection}
      />
    );
  if (action === "split")
    return (
      <SplitForm
        lot={lot}
        ledger={ledger}
        lotCode={lotCode}
        refresh={refresh}
        toast={toast}
        onBack={onBack}
        clearSelection={clearSelection}
      />
    );
  if (action === "combine")
    return (
      <CombineForm
        lot={lot}
        actingActorId={actingActorId}
        ledger={ledger}
        lotCode={lotCode}
        refresh={refresh}
        toast={toast}
        onBack={onBack}
        clearSelection={clearSelection}
      />
    );
  if (action === "process")
    return (
      <ProcessForm
        lot={lot}
        actingActorId={actingActorId}
        ledger={ledger}
        lotCode={lotCode}
        refresh={refresh}
        toast={toast}
        onBack={onBack}
        clearSelection={clearSelection}
      />
    );
  if (action === "transfer")
    return (
      <TransferForm
        lot={lot}
        ledger={ledger}
        lotCode={lotCode}
        refresh={refresh}
        toast={toast}
        onBack={onBack}
        keepSelection={keepSelection}
      />
    );
  return (
    <CloseForm
      lot={lot}
      ledger={ledger}
      lotCode={lotCode}
      refresh={refresh}
      toast={toast}
      onBack={onBack}
      clearSelection={clearSelection}
    />
  );
}

function SendForm({
  lot,
  actingActorId,
  ledger,
  lotCode,
  refresh,
  toast,
  onBack,
  clearSelection,
}: {
  lot: Lot;
  actingActorId: string;
  ledger: ReturnType<typeof useLedger>["ledger"];
  lotCode: (id: string) => string;
  refresh: () => void;
  toast: (m: string, e?: boolean) => void;
  onBack: () => void;
  clearSelection: () => void;
}) {
  const others = allowedSendTargets(ledger, actingActorId);
  const [toId, setToId] = useState(others[0]?.actorId ?? "");
  const [mass, setMass] = useState(String(lot.canonicalMassKg));
  const [loc, setLoc] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!toId) {
      toast("No allowed recipients for this role.", true);
      return;
    }
    try {
      ledger.movementSend({
        lotId: lot.lotId,
        fromActorId: lot.custodianActorId,
        toActorId: toId,
        senderDeclaredKg: parseFloat(mass),
        executingPersonId: lot.custodianActorId,
        destinationLocationId: loc.trim() || "unspecified location",
      });
      clearSelection();
      refresh();
      toast(
        `${lotCode(lot.lotId)} sent to ${actorLabel(ledger, toId)} — awaiting their confirmation.`,
      );
    } catch (err) {
      catchInv(err, toast);
    }
  }

  return (
    <div className="detail-panel">
      <span className="back-link" onClick={onBack} role="button" tabIndex={0}>
        ← back to {lotCode(lot.lotId)}
      </span>
      <h3 style={{ fontFamily: "var(--font)", fontSize: 20, margin: "0 0 16px" }}>
        Send {lotCode(lot.lotId)} to someone else
      </h3>
      {others.length === 0 ? (
        <p className="warn-note">No allowed recipients for this role.</p>
      ) : (
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="ms-to">Send to</label>
          <select id="ms-to" value={toId} onChange={(e) => setToId(e.target.value)}>
            {others.map((a) => (
              <option key={a.actorId} value={a.actorId}>
                {a.displayName} ({a.actorType})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ms-mass">Mass you&apos;re declaring (kg)</label>
          <input
            id="ms-mass"
            type="number"
            step={0.01}
            value={mass}
            onChange={(e) => setMass(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ms-loc">Destination</label>
          <input
            id="ms-loc"
            type="text"
            placeholder="e.g. Akrabi store, Jimma"
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
          />
        </div>
        <p className="helper-note">
          The receiver will confirm the mass on arrival. If it doesn&apos;t match, that&apos;s logged
          as a discrepancy — not a problem you need to fix here.
        </p>
        <button type="submit">Send</button>
      </form>
      )}
    </div>
  );
}

function SplitForm({
  lot,
  ledger,
  lotCode,
  refresh,
  toast,
  onBack,
  clearSelection,
}: {
  lot: Lot;
  ledger: ReturnType<typeof useLedger>["ledger"];
  lotCode: (id: string) => string;
  refresh: () => void;
  toast: (m: string, e?: boolean) => void;
  onBack: () => void;
  clearSelection: () => void;
}) {
  const half = lot.canonicalMassKg / 2;
  const [rows, setRows] = useState<number[]>([half, half]);
  const sum = rows.reduce((a, b) => a + (Number(b) || 0), 0);
  const remainder = Math.round((lot.canonicalMassKg - sum) * 100) / 100;

  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const children = ledger.disaggregate({
        parentLotId: lot.lotId,
        childMassesKg: rows.map(Number),
        executingPersonId: lot.custodianActorId,
        actingActorId: lot.custodianActorId,
      });
      clearSelection();
      refresh();
      toast(`Split into ${children.map((c) => lotCode(c.lotId)).join(", ")}.`);
    } catch (err) {
      catchInv(err, toast);
    }
  }

  return (
    <div className="detail-panel">
      <span className="back-link" onClick={onBack} role="button" tabIndex={0}>
        ← back to {lotCode(lot.lotId)}
      </span>
      <h3 style={{ fontFamily: "var(--font)", fontSize: 20, margin: "0 0 6px" }}>
        Split {lotCode(lot.lotId)}
      </h3>
      <p className="helper-note">
        Total to divide: {lot.canonicalMassKg}kg. Add as many rows as you need — they must add up to
        exactly {lot.canonicalMassKg}kg.
      </p>
      <form onSubmit={submit}>
        {rows.map((v, i) => (
          <div className="alloc-row" key={i}>
            <input
              type="number"
              step={0.01}
              value={v}
              onChange={(e) => {
                const next = [...rows];
                next[i] = parseFloat(e.target.value) || 0;
                setRows(next);
              }}
            />
            {rows.length > 2 && (
              <button
                type="button"
                className="remove-row"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
              >
                remove
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          style={{ marginBottom: 10 }}
          onClick={() => {
            const s = rows.reduce((a, b) => a + (Number(b) || 0), 0);
            setRows([...rows, Math.max(0, Math.round((lot.canonicalMassKg - s) * 100) / 100)]);
          }}
        >
          + add another lot
        </button>
        <div className={`remainder ${remainder === 0 ? "zero" : "nonzero"}`}>
          {remainder === 0
            ? "Fully allocated — ready to split."
            : `Remaining to allocate: ${remainder}kg`}
        </div>
        <button type="submit" disabled={remainder !== 0}>
          Split lot
        </button>
      </form>
    </div>
  );
}

function CombineForm({
  lot,
  actingActorId,
  ledger,
  lotCode,
  refresh,
  toast,
  onBack,
  clearSelection,
}: {
  lot: Lot;
  actingActorId: string;
  ledger: ReturnType<typeof useLedger>["ledger"];
  lotCode: (id: string) => string;
  refresh: () => void;
  toast: (m: string, e?: boolean) => void;
  onBack: () => void;
  clearSelection: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const candidates = ledger.currentInventory(actingActorId).filter((l) => l.lotId !== lot.lotId);
  const running =
    lot.canonicalMassKg +
    [...selected].reduce((a, id) => a + (ledger.lots.get(id)?.canonicalMassKg ?? 0), 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const parentLotIds = [lot.lotId, ...selected];
      const child = ledger.aggregate({
        parentLotIds,
        executingPersonId: lot.custodianActorId,
        actingActorId: lot.custodianActorId,
      });
      clearSelection();
      refresh();
      toast(`Combined into ${lotCode(child.lotId)}, ${child.canonicalMassKg}kg.`);
    } catch (err) {
      catchInv(err, toast);
    }
  }

  return (
    <div className="detail-panel">
      <span className="back-link" onClick={onBack} role="button" tabIndex={0}>
        ← back to {lotCode(lot.lotId)}
      </span>
      <h3 style={{ fontFamily: "var(--font)", fontSize: 20, margin: "0 0 6px" }}>
        Combine {lotCode(lot.lotId)} with other lots
      </h3>
      <p className="helper-note">
        Only lots in the same form and route can be combined. Incompatible lots are shown greyed
        out.
      </p>
      <form onSubmit={submit}>
        <div className="compat-list">
          {candidates.length === 0 ? (
            <div className="compat-row">No other lots in this actor&apos;s custody right now.</div>
          ) : (
            candidates.map((c) => {
              const compatible =
                c.processingState === lot.processingState &&
                c.processingRoute === lot.processingRoute;
              return (
                <div key={c.lotId} className={`compat-row${compatible ? "" : " disabled"}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(c.lotId)}
                    disabled={!compatible}
                    onChange={() => toggle(c.lotId)}
                  />
                  <span>
                    {lotCode(c.lotId)} — {stateLabel(c.processingState)}, {c.canonicalMassKg}kg
                    {compatible ? "" : " (different form/route)"}
                  </span>
                </div>
              );
            })
          )}
        </div>
        <div className="running-total">Combined total so far: {running}kg</div>
        <button type="submit" disabled={selected.size === 0}>
          Combine {selected.size + 1} lots
        </button>
      </form>
    </div>
  );
}

function ProcessForm({
  lot,
  actingActorId,
  ledger,
  lotCode,
  refresh,
  toast,
  onBack,
  clearSelection,
}: {
  lot: Lot;
  actingActorId: string;
  ledger: ReturnType<typeof useLedger>["ledger"];
  lotCode: (id: string) => string;
  refresh: () => void;
  toast: (m: string, e?: boolean) => void;
  onBack: () => void;
  clearSelection: () => void;
}) {
  const [extras, setExtras] = useState<Set<string>>(new Set());
  const [outState, setOutState] = useState<ProcessingState>("wet_parchment");
  const [reject, setReject] = useState("0");
  const [loss, setLoss] = useState("0");

  const candidates = ledger
    .currentInventory(actingActorId)
    .filter(
      (l) =>
        l.lotId !== lot.lotId &&
        l.processingState === lot.processingState &&
        l.processingRoute === lot.processingRoute,
    );
  const totalInput =
    lot.canonicalMassKg +
    [...extras].reduce((a, id) => a + (ledger.lots.get(id)?.canonicalMassKg ?? 0), 0);
  const rejectKg = parseFloat(reject) || 0;
  const lossKg = parseFloat(loss) || 0;
  const product = Math.round((totalInput - rejectKg - lossKg) * 100) / 100;
  const eligible = LOSS_ELIGIBLE_STATES.has(lot.processingState);

  function toggle(id: string) {
    setExtras((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const inputLotIds = [lot.lotId, ...extras];
      const out = ledger.process({
        inputLotIds,
        outputState: outState,
        outputMassKg: product,
        rejectKg,
        lossKg,
        executingPersonId: lot.custodianActorId,
        actingActorId: lot.custodianActorId,
      });
      clearSelection();
      refresh();
      toast(
        `${lotCode(out.lotId)} produced — ${out.canonicalMassKg}kg ${stateLabel(out.processingState)}.`,
      );
    } catch (err) {
      catchInv(err, toast);
    }
  }

  return (
    <div className="detail-panel">
      <span className="back-link" onClick={onBack} role="button" tabIndex={0}>
        ← back to {lotCode(lot.lotId)}
      </span>
      <h3 style={{ fontFamily: "var(--font)", fontSize: 20, margin: "0 0 6px" }}>
        Process {lotCode(lot.lotId)}
      </h3>
      <p className="helper-note">
        Total input: {totalInput}kg. Enter what&apos;s removed as reject or lost — the rest becomes
        your output automatically.
      </p>
      <form onSubmit={submit}>
        {candidates.length > 0 && (
          <>
            <h3 className="subhead">Add other lots to this batch (optional)</h3>
            <div className="compat-list">
              {candidates.map((c) => (
                <div className="compat-row" key={c.lotId}>
                  <input
                    type="checkbox"
                    checked={extras.has(c.lotId)}
                    onChange={() => toggle(c.lotId)}
                  />
                  <span>
                    {lotCode(c.lotId)} — {c.canonicalMassKg}kg
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor="pr-outstate">Resulting form</label>
          <select
            id="pr-outstate"
            value={outState}
            onChange={(e) => setOutState(e.target.value as ProcessingState)}
          >
            <option value="wet_parchment">Wet parchment</option>
            <option value="dry_parchment">Dry parchment</option>
            <option value="dried_cherry">Dried cherry</option>
            <option value="green_natural">Green (natural)</option>
            <option value="green_washed">Green (washed)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="pr-reject">Reject / foreign matter (kg)</label>
          <input
            id="pr-reject"
            type="number"
            step={0.01}
            value={reject}
            onChange={(e) => setReject(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="pr-loss">Genuine moisture/process loss (kg)</label>
          <input
            id="pr-loss"
            type="number"
            step={0.01}
            value={loss}
            onChange={(e) => setLoss(e.target.value)}
          />
        </div>
        {!eligible && lossKg > 0 && (
          <p className="warn-note">
            Loss usually isn&apos;t valid on this form of coffee — this will likely be rejected unless
            another input lot in the batch is eligible.
          </p>
        )}
        <div className={`computed-output${product < 0 ? " invalid" : ""}`}>
          Output product: <span className="num">{product}kg</span> {stateLabel(outState)}
          {product < 0 ? <br /> : null}
          {product < 0 ? "Reject + loss can't exceed total input." : ""}
        </div>
        <button type="submit" disabled={product < 0}>
          Process
        </button>
      </form>
    </div>
  );
}

function TransferForm({
  lot,
  ledger,
  lotCode,
  refresh,
  toast,
  onBack,
  keepSelection,
}: {
  lot: Lot;
  ledger: ReturnType<typeof useLedger>["ledger"];
  lotCode: (id: string) => string;
  refresh: () => void;
  toast: (m: string, e?: boolean) => void;
  onBack: () => void;
  keepSelection: () => void;
}) {
  const others = allowedSendTargets(ledger, lot.custodianActorId).filter(
    (a) => a.actorId !== lot.ownerActorId,
  );
  // Ownership transfers follow the same role chain as send targets, plus keep current chain partners
  const transferTargets =
    others.length > 0
      ? others
      : [...ledger.actors.values()].filter((a) => {
          if (a.actorId === lot.ownerActorId) return false;
          const self = ledger.actors.get(lot.custodianActorId);
          if (!self) return false;
          if (self.actorType === "farmer") return a.actorType === "akrabi";
          if (self.actorType === "akrabi") return a.actorType === "exporter";
          if (self.actorType === "exporter") return a.actorType === "akrabi";
          return false;
        });
  const [ownerId, setOwnerId] = useState(transferTargets[0]?.actorId ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!ownerId) {
      toast("No allowed owners for this role.", true);
      return;
    }
    try {
      ledger.transferOwnership({
        lotId: lot.lotId,
        newOwnerActorId: ownerId,
        executingPersonId: lot.custodianActorId,
        actingActorId: lot.custodianActorId,
      });
      keepSelection();
      refresh();
      toast(`${lotCode(lot.lotId)} now owned by ${actorLabel(ledger, ownerId)}.`);
    } catch (err) {
      catchInv(err, toast);
    }
  }

  return (
    <div className="detail-panel">
      <span className="back-link" onClick={onBack} role="button" tabIndex={0}>
        ← back to {lotCode(lot.lotId)}
      </span>
      <h3 style={{ fontFamily: "var(--font)", fontSize: 20, margin: "0 0 16px" }}>
        Transfer ownership of {lotCode(lot.lotId)}
      </h3>
      <p className="helper-note">
        Currently owned by {actorLabel(ledger, lot.ownerActorId)}. This does not move the lot —
        custody and location stay the same.
      </p>
      {transferTargets.length === 0 ? (
        <p className="warn-note">No allowed owners for this role.</p>
      ) : (
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="to-owner">New owner</label>
          <select id="to-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {transferTargets.map((a) => (
              <option key={a.actorId} value={a.actorId}>
                {a.displayName} ({a.actorType})
              </option>
            ))}
          </select>
        </div>
        <button type="submit">Transfer</button>
      </form>
      )}
    </div>
  );
}

function CloseForm({
  lot,
  ledger,
  lotCode,
  refresh,
  toast,
  onBack,
  clearSelection,
}: {
  lot: Lot;
  ledger: ReturnType<typeof useLedger>["ledger"];
  lotCode: (id: string) => string;
  refresh: () => void;
  toast: (m: string, e?: boolean) => void;
  onBack: () => void;
  clearSelection: () => void;
}) {
  const [reason, setReason] = useState<TerminalReason>("fob_export");

  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      ledger.terminalDispose({
        lotId: lot.lotId,
        reason,
        executingPersonId: lot.custodianActorId,
        actingActorId: lot.custodianActorId,
      });
      clearSelection();
      refresh();
      toast(`${lotCode(lot.lotId)} closed — ${REASON_LABELS[reason]}.`);
    } catch (err) {
      catchInv(err, toast);
    }
  }

  return (
    <div className="detail-panel">
      <span className="back-link" onClick={onBack} role="button" tabIndex={0}>
        ← back to {lotCode(lot.lotId)}
      </span>
      <h3 style={{ fontFamily: "var(--font)", fontSize: 20, margin: "0 0 16px" }}>
        Close {lotCode(lot.lotId)}
      </h3>
      <p className="warn-note">
        This permanently removes the lot from active inventory. It cannot be undone.
      </p>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="td-reason">Reason</label>
          <select
            id="td-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as TerminalReason)}
          >
            <option value="fob_export">Export at FOB</option>
            <option value="domestic_disposition">Sold domestically</option>
            <option value="destroyed">Destroyed / lost</option>
          </select>
        </div>
        <button type="submit" className="danger">
          Close lot
        </button>
      </form>
    </div>
  );
}
