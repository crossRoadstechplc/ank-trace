import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, jsonError } from "@/lib/auth";
import { InvariantViolation } from "@/lib/ledger/engine";
import { withLedgerMutation } from "@/lib/ledger/db-store";
import type { ActorType } from "@/lib/ledger/types";

const facilitySchema = z.object({
  actorType: z.enum(["washing_station", "mill"]),
  displayName: z.string().min(1),
  legalIdentityRef: z.string().min(1),
  metadata: z.record(z.string()).optional(),
});

const bodySchema = z.object({
  actorType: z.string().min(1),
  displayName: z.string().min(1),
  legalIdentityRef: z.string().min(1),
  sponsorActorId: z.string().nullable(),
  metadata: z.record(z.string()).optional(),
  facility: facilitySchema.optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Invalid actor payload.");

    const body = parsed.data;
    const { result, loaded } = await withLedgerMutation((ledger) => {
      const actor = ledger.onboardActor(
        body.actorType as ActorType,
        body.displayName,
        body.legalIdentityRef,
        body.sponsorActorId,
        body.metadata ?? {},
      );
      if (body.facility) {
        ledger.onboardActor(
          body.facility.actorType,
          body.facility.displayName,
          body.facility.legalIdentityRef,
          actor.actorId,
          body.facility.metadata ?? {},
        );
      }
      return actor;
    });

    return NextResponse.json({
      actor: result,
      snapshot: loaded.snapshot,
      actingActorId: loaded.actingActorId,
      preferredTraceLotId: loaded.preferredTraceLotId,
    });
  } catch (err) {
    if (err instanceof InvariantViolation) {
      return jsonError(err.message, 400);
    }
    console.error("POST /api/ledger/actors", err);
    return jsonError(err instanceof Error ? err.message : "Could not onboard actor.", 500);
  }
}
