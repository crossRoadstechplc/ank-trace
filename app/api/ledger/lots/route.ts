import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, jsonError } from "@/lib/auth";
import { InvariantViolation } from "@/lib/ledger/engine";
import { withLedgerMutation } from "@/lib/ledger/db-store";

const processingState = z.enum([
  "cherry",
  "wet_parchment",
  "dry_parchment",
  "green_washed",
  "green_natural",
  "dried_cherry",
]);
const processingRoute = z.enum(["washed", "natural", "unknown_at_origin"]);

const originSchema = z.object({
  kind: z.literal("origin"),
  farmerActorId: z.string().min(1),
  recordedByActorId: z.string().min(1),
  executingPersonId: z.string().min(1),
  massKg: z.number().positive(),
  processingState,
  processingRoute,
  locationId: z.string().min(1),
  cropYear: z.string().min(1),
});

const intakeSchema = z.object({
  kind: z.literal("intake"),
  supplierActorId: z.string().min(1),
  receiverActorId: z.string().min(1),
  executingPersonId: z.string().min(1),
  massKg: z.number().positive(),
  processingState,
  processingRoute,
  locationId: z.string().min(1),
  cropYear: z.string().min(1),
});

const bodySchema = z.discriminatedUnion("kind", [originSchema, intakeSchema]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Invalid lot payload.");

    const body = parsed.data;
    const { result, loaded } = await withLedgerMutation((ledger) => {
      if (body.kind === "origin") {
        return ledger.createOriginLot(body);
      }
      return ledger.createIntakeLot(body);
    });

    return NextResponse.json({
      lot: result,
      snapshot: loaded.snapshot,
      actingActorId: loaded.actingActorId,
      preferredTraceLotId: loaded.preferredTraceLotId,
    });
  } catch (err) {
    if (err instanceof InvariantViolation) {
      return jsonError(err.message, 400);
    }
    console.error("POST /api/ledger/lots", err);
    return jsonError(err instanceof Error ? err.message : "Could not create lot.", 500);
  }
}
