import type {
  Actor,
  ActorStatus,
  ActorType,
  Discrepancy,
  DiscrepancyStatus,
  Event,
  EventType,
  Lineage,
  Lot,
  LotStatus,
  Movement,
  MovementState,
  OriginStatus,
  ProcessingRoute,
  ProcessingState,
  Provenance,
} from "./types";
import { Ledger } from "./engine";

/** Portable ledger snapshot (API + DB hydrate). */
export type LedgerSnapshot = {
  actors: Actor[];
  lots: Lot[];
  events: Event[];
  movements: Movement[];
  lineage: Lineage[];
  discrepancies: Discrepancy[];
  actingActorId: string | null;
  preferredTraceLotId: string | null;
};

export function snapshotFromLedger(
  ledger: Ledger,
  meta: { actingActorId: string | null; preferredTraceLotId: string | null },
): LedgerSnapshot {
  return {
    actors: [...ledger.actors.values()],
    lots: [...ledger.lots.values()],
    events: [...ledger.events],
    movements: [...ledger.movements.values()],
    lineage: [...ledger.lineage],
    discrepancies: [...ledger.discrepancies],
    actingActorId: meta.actingActorId,
    preferredTraceLotId: meta.preferredTraceLotId,
  };
}

export function ledgerFromSnapshot(snapshot: LedgerSnapshot): Ledger {
  const ledger = new Ledger();
  for (const a of snapshot.actors) {
    ledger.actors.set(a.actorId, { ...a, metadata: { ...a.metadata } });
  }
  for (const l of snapshot.lots) {
    ledger.lots.set(l.lotId, {
      ...l,
      provenance: { ...l.provenance },
    });
  }
  ledger.events = snapshot.events.map((e) => ({
    ...e,
    payload: { ...e.payload },
  }));
  for (const m of snapshot.movements) {
    ledger.movements.set(m.movementId, { ...m });
  }
  ledger.lineage = snapshot.lineage.map((x) => ({ ...x }));
  ledger.discrepancies = snapshot.discrepancies.map((d) => ({ ...d }));
  return ledger;
}

export function resolvePreferredTraceLotId(ledger: Ledger): string | null {
  const active = [...ledger.lots.values()].filter(
    (l) => l.status === "active" && !l.inTransit,
  );
  const greens = active.filter(
    (l) =>
      l.processingState === "green_washed" || l.processingState === "green_natural",
  );
  const pick = greens.sort((a, b) => b.canonicalMassKg - a.canonicalMassKg)[0];
  return pick?.lotId ?? active[0]?.lotId ?? null;
}

export function resolveActingExporterId(ledger: Ledger): string | null {
  const exporter = [...ledger.actors.values()].find((a) => a.actorType === "exporter");
  return exporter?.actorId ?? null;
}

/** Narrow Prisma JsonValue-ish objects into engine types (runtime trust DB). */
export function asActor(row: {
  id: string;
  actorType: string;
  displayName: string;
  legalIdentityRef: string;
  status: string;
  sponsorId: string | null;
  metadata: unknown;
}): Actor {
  return {
    actorId: row.id,
    actorType: row.actorType as ActorType,
    displayName: row.displayName,
    legalIdentityRef: row.legalIdentityRef,
    status: row.status as ActorStatus,
    sponsorActorId: row.sponsorId,
    metadata: (row.metadata ?? {}) as Actor["metadata"],
  };
}

export function asLot(row: {
  id: string;
  commodity: string;
  processingState: string;
  processingRoute: string;
  status: string;
  canonicalMassKg: number;
  ownerActorId: string;
  custodianActorId: string;
  locationId: string;
  originLocationId: string | null;
  cropYear: string;
  originStatus: string;
  createdEventId: string;
  provenance: unknown;
  inactiveEventId: string | null;
  inTransit: boolean;
}): Lot {
  return {
    lotId: row.id,
    commodity: "coffee",
    processingState: row.processingState as ProcessingState,
    processingRoute: row.processingRoute as ProcessingRoute,
    status: row.status as LotStatus,
    canonicalMassKg: row.canonicalMassKg,
    ownerActorId: row.ownerActorId,
    custodianActorId: row.custodianActorId,
    locationId: row.locationId,
    originLocationId: row.originLocationId ?? undefined,
    cropYear: row.cropYear,
    originStatus: row.originStatus as OriginStatus,
    createdEventId: row.createdEventId,
    provenance: (row.provenance ?? {}) as Provenance,
    inactiveEventId: row.inactiveEventId,
    inTransit: row.inTransit,
  };
}

export function asEvent(row: {
  id: string;
  eventType: string;
  eventTime: Date;
  recordTime: Date;
  executingPersonId: string;
  onBehalfOfActorId: string;
  payload: unknown;
  correctsEventId: string | null;
}): Event {
  return {
    eventId: row.id,
    eventType: row.eventType as EventType,
    eventTime: row.eventTime.toISOString(),
    recordTime: row.recordTime.toISOString(),
    executingPersonId: row.executingPersonId,
    onBehalfOfActorId: row.onBehalfOfActorId,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    correctsEventId: row.correctsEventId,
  };
}

export function asMovement(row: {
  id: string;
  lotId: string;
  fromActorId: string;
  toActorId: string;
  senderDeclaredKg: number;
  destinationLocationId: string;
  state: string;
  receiverDeclaredKg: number | null;
}): Movement {
  return {
    movementId: row.id,
    lotId: row.lotId,
    fromActorId: row.fromActorId,
    toActorId: row.toActorId,
    senderDeclaredKg: row.senderDeclaredKg,
    destinationLocationId: row.destinationLocationId,
    state: row.state as MovementState,
    receiverDeclaredKg: row.receiverDeclaredKg ?? undefined,
  };
}

export function asDiscrepancy(row: {
  id: string;
  movementId: string;
  lotId: string;
  senderKg: number;
  receiverKg: number;
  deltaKg: number;
  status: string;
}): Discrepancy {
  return {
    discrepancyId: row.id,
    movementId: row.movementId,
    lotId: row.lotId,
    senderKg: row.senderKg,
    receiverKg: row.receiverKg,
    deltaKg: row.deltaKg,
    status: row.status as DiscrepancyStatus,
  };
}
