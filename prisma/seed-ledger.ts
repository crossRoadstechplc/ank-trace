/**
 * Idempotent seed: copy on-file ledger bootstrap into Postgres once.
 * Usage: npx tsx prisma/seed-ledger.ts
 * Force: npx tsx prisma/seed-ledger.ts --force
 */
import { getLedgerOrSeed } from "../lib/ledger/db-store";
import { prisma } from "../lib/prisma";

async function main() {
  const force = process.argv.includes("--force");
  if (force) {
    await prisma.ledgerMeta.deleteMany();
    await prisma.networkDiscrepancy.deleteMany();
    await prisma.networkLineage.deleteMany();
    await prisma.networkMovement.deleteMany();
    await prisma.networkEvent.deleteMany();
    await prisma.networkLot.deleteMany();
    await prisma.networkActor.deleteMany();
    console.log("Cleared existing network ledger tables (--force).");
  }

  const loaded = await getLedgerOrSeed({ forceReseed: force });
  console.log(
    JSON.stringify(
      {
        actors: loaded.snapshot.actors.length,
        lots: loaded.snapshot.lots.length,
        events: loaded.snapshot.events.length,
        movements: loaded.snapshot.movements.length,
        lineage: loaded.snapshot.lineage.length,
        actingActorId: loaded.actingActorId,
        preferredTraceLotId: loaded.preferredTraceLotId,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
