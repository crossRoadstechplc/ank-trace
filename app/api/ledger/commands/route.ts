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

const sendSchema = z.object({
  command: z.literal("send"),
  lotId: z.string(),
  fromActorId: z.string(),
  toActorId: z.string(),
  senderDeclaredKg: z.number(),
  executingPersonId: z.string(),
  destinationLocationId: z.string(),
});

const receiveSchema = z.object({
  command: z.literal("receive"),
  movementId: z.string(),
  receiverDeclaredKg: z.number(),
  executingPersonId: z.string(),
});

const aggregateSchema = z.object({
  command: z.literal("aggregate"),
  parentLotIds: z.array(z.string()).min(2),
  executingPersonId: z.string(),
  actingActorId: z.string(),
});

const disaggregateSchema = z.object({
  command: z.literal("disaggregate"),
  parentLotId: z.string(),
  childMassesKg: z.array(z.number()).min(2),
  executingPersonId: z.string(),
  actingActorId: z.string(),
});

const processSchema = z.object({
  command: z.literal("process"),
  inputLotIds: z.array(z.string()).min(1),
  outputState: processingState,
  outputMassKg: z.number(),
  rejectKg: z.number(),
  lossKg: z.number(),
  executingPersonId: z.string(),
  actingActorId: z.string(),
  lossCategory: z.string().nullable().optional(),
});

const transferSchema = z.object({
  command: z.literal("transferOwnership"),
  lotId: z.string(),
  newOwnerActorId: z.string(),
  executingPersonId: z.string(),
  actingActorId: z.string(),
});

const disposeSchema = z.object({
  command: z.literal("terminalDispose"),
  lotId: z.string(),
  reason: z.enum(["fob_export", "domestic_disposition", "destroyed"]),
  executingPersonId: z.string(),
  actingActorId: z.string(),
});

const bodySchema = z.discriminatedUnion("command", [
  sendSchema,
  receiveSchema,
  aggregateSchema,
  disaggregateSchema,
  processSchema,
  transferSchema,
  disposeSchema,
]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Invalid command payload.");

    const body = parsed.data;
    const { result, loaded } = await withLedgerMutation((ledger) => {
      switch (body.command) {
        case "send":
          return ledger.movementSend(body);
        case "receive":
          return ledger.movementReceive(body);
        case "aggregate":
          return ledger.aggregate(body);
        case "disaggregate":
          return ledger.disaggregate(body);
        case "process":
          return ledger.process({
            ...body,
            lossCategory: body.lossCategory ?? null,
          });
        case "transferOwnership":
          return ledger.transferOwnership(body);
        case "terminalDispose":
          return ledger.terminalDispose(body);
        default:
          throw new Error("Unknown command");
      }
    });

    return NextResponse.json({
      result,
      snapshot: loaded.snapshot,
      actingActorId: loaded.actingActorId,
      preferredTraceLotId: loaded.preferredTraceLotId,
    });
  } catch (err) {
    if (err instanceof InvariantViolation) {
      return jsonError(err.message, 400);
    }
    console.error("POST /api/ledger/commands", err);
    return jsonError(err instanceof Error ? err.message : "Command failed.", 500);
  }
}
