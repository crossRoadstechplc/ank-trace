import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Ledger } from "./engine";
import { bootstrap } from "./seed";
import {
  asActor,
  asDiscrepancy,
  asEvent,
  asLot,
  asMovement,
  ledgerFromSnapshot,
  resolveActingExporterId,
  resolvePreferredTraceLotId,
  snapshotFromLedger,
  type LedgerSnapshot,
} from "./snapshot";

const META_ID = "default";
const LEDGER_SCHEMA_VERSION = 1;

export type LoadedLedger = {
  ledger: Ledger;
  actingActorId: string;
  preferredTraceLotId: string | null;
  snapshot: LedgerSnapshot;
};

/** Replace all network tables with the current in-memory ledger state. */
export async function ledgerToDb(
  ledger: Ledger,
  meta: { actingActorId: string | null; preferredTraceLotId: string | null; markSeeded?: boolean },
): Promise<void> {
  const snapshot = snapshotFromLedger(ledger, meta);
  const now = new Date();

  await prisma.$transaction(
    async (tx) => {
      await tx.networkDiscrepancy.deleteMany();
      await tx.networkLineage.deleteMany();
      await tx.networkMovement.deleteMany();
      await tx.networkEvent.deleteMany();
      await tx.networkLot.deleteMany();
      await tx.networkActor.deleteMany();

      if (snapshot.actors.length) {
        await tx.networkActor.createMany({
          data: snapshot.actors.map((a) => ({
            id: a.actorId,
            actorType: a.actorType,
            displayName: a.displayName,
            legalIdentityRef: a.legalIdentityRef,
            status: a.status,
            sponsorId: a.sponsorActorId,
            metadata: a.metadata as Prisma.InputJsonValue,
            updatedAt: now,
          })),
        });
      }

      if (snapshot.lots.length) {
        await tx.networkLot.createMany({
          data: snapshot.lots.map((l) => ({
            id: l.lotId,
            commodity: l.commodity,
            processingState: l.processingState,
            processingRoute: l.processingRoute,
            status: l.status,
            canonicalMassKg: l.canonicalMassKg,
            ownerActorId: l.ownerActorId,
            custodianActorId: l.custodianActorId,
            locationId: l.locationId,
            originLocationId: l.originLocationId ?? null,
            cropYear: l.cropYear,
            originStatus: l.originStatus,
            createdEventId: l.createdEventId,
            provenance: l.provenance as Prisma.InputJsonValue,
            inactiveEventId: l.inactiveEventId,
            inTransit: l.inTransit,
            updatedAt: now,
          })),
        });
      }

      if (snapshot.events.length) {
        await tx.networkEvent.createMany({
          data: snapshot.events.map((e, i) => ({
            id: e.eventId,
            eventType: e.eventType,
            eventTime: new Date(e.eventTime),
            recordTime: new Date(e.recordTime),
            executingPersonId: e.executingPersonId,
            onBehalfOfActorId: e.onBehalfOfActorId,
            payload: e.payload as Prisma.InputJsonValue,
            correctsEventId: e.correctsEventId,
            sortOrder: i,
          })),
        });
      }

      if (snapshot.movements.length) {
        await tx.networkMovement.createMany({
          data: snapshot.movements.map((m) => ({
            id: m.movementId,
            lotId: m.lotId,
            fromActorId: m.fromActorId,
            toActorId: m.toActorId,
            senderDeclaredKg: m.senderDeclaredKg,
            destinationLocationId: m.destinationLocationId,
            state: m.state,
            receiverDeclaredKg: m.receiverDeclaredKg ?? null,
            updatedAt: now,
          })),
        });
      }

      if (snapshot.lineage.length) {
        await tx.networkLineage.createMany({
          data: snapshot.lineage.map((x) => ({
            parentLotId: x.parentLotId,
            childLotId: x.childLotId,
            contributionKg: x.contributionKg,
            proportion: x.proportion,
          })),
        });
      }

      if (snapshot.discrepancies.length) {
        await tx.networkDiscrepancy.createMany({
          data: snapshot.discrepancies.map((d) => ({
            id: d.discrepancyId,
            movementId: d.movementId,
            lotId: d.lotId,
            senderKg: d.senderKg,
            receiverKg: d.receiverKg,
            deltaKg: d.deltaKg,
            status: d.status,
          })),
        });
      }

      await tx.ledgerMeta.upsert({
        where: { id: META_ID },
        create: {
          id: META_ID,
          seededAt: meta.markSeeded ? now : null,
          schemaVersion: LEDGER_SCHEMA_VERSION,
          actingActorId: meta.actingActorId,
          preferredTraceLotId: meta.preferredTraceLotId,
        },
        update: {
          schemaVersion: LEDGER_SCHEMA_VERSION,
          actingActorId: meta.actingActorId,
          preferredTraceLotId: meta.preferredTraceLotId,
          ...(meta.markSeeded ? { seededAt: now } : {}),
        },
      });
    },
    { timeout: 120_000 },
  );
}

export async function dbToLedger(): Promise<LoadedLedger | null> {
  const meta = await prisma.ledgerMeta.findUnique({ where: { id: META_ID } });
  const actorCount = await prisma.networkActor.count();
  if (!meta?.seededAt || actorCount === 0) return null;

  const [actors, lots, events, movements, lineage, discrepancies] = await Promise.all([
    prisma.networkActor.findMany(),
    prisma.networkLot.findMany(),
    prisma.networkEvent.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.networkMovement.findMany(),
    prisma.networkLineage.findMany(),
    prisma.networkDiscrepancy.findMany(),
  ]);

  const snapshot: LedgerSnapshot = {
    actors: actors.map(asActor),
    lots: lots.map(asLot),
    events: events.map(asEvent),
    movements: movements.map(asMovement),
    lineage: lineage.map((x) => ({
      parentLotId: x.parentLotId,
      childLotId: x.childLotId,
      contributionKg: x.contributionKg,
      proportion: x.proportion,
    })),
    discrepancies: discrepancies.map(asDiscrepancy),
    actingActorId: meta.actingActorId,
    preferredTraceLotId: meta.preferredTraceLotId,
  };

  const ledger = ledgerFromSnapshot(snapshot);
  const actingActorId =
    meta.actingActorId && ledger.actors.has(meta.actingActorId)
      ? meta.actingActorId
      : resolveActingExporterId(ledger) ?? [...ledger.actors.keys()][0] ?? "";
  const preferredTraceLotId =
    meta.preferredTraceLotId && ledger.lots.has(meta.preferredTraceLotId)
      ? meta.preferredTraceLotId
      : resolvePreferredTraceLotId(ledger);

  return {
    ledger,
    actingActorId,
    preferredTraceLotId,
    snapshot: {
      ...snapshot,
      actingActorId,
      preferredTraceLotId,
    },
  };
}

/** Load from DB, or seed from on-file bootstrap once then persist. */
export async function getLedgerOrSeed(options?: { forceReseed?: boolean }): Promise<LoadedLedger> {
  if (!options?.forceReseed) {
    const existing = await dbToLedger();
    if (existing) return existing;
  }

  const boot = bootstrap();
  await ledgerToDb(boot.ledger, {
    actingActorId: boot.actingActorId,
    preferredTraceLotId: boot.preferredTraceLotId,
    markSeeded: true,
  });

  return {
    ledger: boot.ledger,
    actingActorId: boot.actingActorId,
    preferredTraceLotId: boot.preferredTraceLotId,
    snapshot: snapshotFromLedger(boot.ledger, {
      actingActorId: boot.actingActorId,
      preferredTraceLotId: boot.preferredTraceLotId,
    }),
  };
}

/** Apply a mutation against the DB-backed ledger and persist. */
export async function withLedgerMutation<T>(
  mutate: (ledger: Ledger, ctx: { actingActorId: string; preferredTraceLotId: string | null }) => T,
): Promise<{ result: T; loaded: LoadedLedger }> {
  const loaded = await getLedgerOrSeed();
  const result = mutate(loaded.ledger, {
    actingActorId: loaded.actingActorId,
    preferredTraceLotId: loaded.preferredTraceLotId,
  });
  const preferredTraceLotId =
    loaded.preferredTraceLotId && loaded.ledger.lots.has(loaded.preferredTraceLotId)
      ? loaded.preferredTraceLotId
      : resolvePreferredTraceLotId(loaded.ledger);
  await ledgerToDb(loaded.ledger, {
    actingActorId: loaded.actingActorId,
    preferredTraceLotId,
  });
  const snapshot = snapshotFromLedger(loaded.ledger, {
    actingActorId: loaded.actingActorId,
    preferredTraceLotId,
  });
  return {
    result,
    loaded: {
      ledger: loaded.ledger,
      actingActorId: loaded.actingActorId,
      preferredTraceLotId,
      snapshot,
    },
  };
}
