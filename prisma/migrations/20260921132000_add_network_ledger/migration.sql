-- Additive network ledger tables (auth tables unchanged).

CREATE TABLE IF NOT EXISTS "LedgerMeta" (
    "id" TEXT NOT NULL,
    "seededAt" TIMESTAMP(3),
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerMeta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NetworkActor" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "legalIdentityRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sponsorId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkActor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NetworkActor_legalIdentityRef_key" ON "NetworkActor"("legalIdentityRef");
CREATE INDEX IF NOT EXISTS "NetworkActor_sponsorId_idx" ON "NetworkActor"("sponsorId");
CREATE INDEX IF NOT EXISTS "NetworkActor_actorType_idx" ON "NetworkActor"("actorType");

CREATE TABLE IF NOT EXISTS "NetworkLot" (
    "id" TEXT NOT NULL,
    "commodity" TEXT NOT NULL DEFAULT 'coffee',
    "processingState" TEXT NOT NULL,
    "processingRoute" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "canonicalMassKg" DOUBLE PRECISION NOT NULL,
    "ownerActorId" TEXT NOT NULL,
    "custodianActorId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "originLocationId" TEXT,
    "cropYear" TEXT NOT NULL,
    "originStatus" TEXT NOT NULL,
    "createdEventId" TEXT NOT NULL,
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "inactiveEventId" TEXT,
    "inTransit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkLot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NetworkLot_ownerActorId_idx" ON "NetworkLot"("ownerActorId");
CREATE INDEX IF NOT EXISTS "NetworkLot_custodianActorId_idx" ON "NetworkLot"("custodianActorId");
CREATE INDEX IF NOT EXISTS "NetworkLot_status_idx" ON "NetworkLot"("status");

CREATE TABLE IF NOT EXISTS "NetworkEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "recordTime" TIMESTAMP(3) NOT NULL,
    "executingPersonId" TEXT NOT NULL,
    "onBehalfOfActorId" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "correctsEventId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NetworkEvent_eventType_idx" ON "NetworkEvent"("eventType");
CREATE INDEX IF NOT EXISTS "NetworkEvent_sortOrder_idx" ON "NetworkEvent"("sortOrder");

CREATE TABLE IF NOT EXISTS "NetworkMovement" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "fromActorId" TEXT NOT NULL,
    "toActorId" TEXT NOT NULL,
    "senderDeclaredKg" DOUBLE PRECISION NOT NULL,
    "destinationLocationId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "receiverDeclaredKg" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NetworkMovement_lotId_idx" ON "NetworkMovement"("lotId");
CREATE INDEX IF NOT EXISTS "NetworkMovement_toActorId_idx" ON "NetworkMovement"("toActorId");
CREATE INDEX IF NOT EXISTS "NetworkMovement_state_idx" ON "NetworkMovement"("state");

CREATE TABLE IF NOT EXISTS "NetworkLineage" (
    "id" TEXT NOT NULL,
    "parentLotId" TEXT NOT NULL,
    "childLotId" TEXT NOT NULL,
    "contributionKg" DOUBLE PRECISION NOT NULL,
    "proportion" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "NetworkLineage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NetworkLineage_parentLotId_idx" ON "NetworkLineage"("parentLotId");
CREATE INDEX IF NOT EXISTS "NetworkLineage_childLotId_idx" ON "NetworkLineage"("childLotId");
CREATE UNIQUE INDEX IF NOT EXISTS "NetworkLineage_parentLotId_childLotId_key" ON "NetworkLineage"("parentLotId", "childLotId");

CREATE TABLE IF NOT EXISTS "NetworkDiscrepancy" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "senderKg" DOUBLE PRECISION NOT NULL,
    "receiverKg" DOUBLE PRECISION NOT NULL,
    "deltaKg" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "NetworkDiscrepancy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NetworkDiscrepancy_movementId_idx" ON "NetworkDiscrepancy"("movementId");
CREATE INDEX IF NOT EXISTS "NetworkDiscrepancy_lotId_idx" ON "NetworkDiscrepancy"("lotId");
