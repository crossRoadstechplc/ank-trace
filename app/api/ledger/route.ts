import { NextResponse } from "next/server";
import { getSession, jsonError } from "@/lib/auth";
import { getLedgerOrSeed } from "@/lib/ledger/db-store";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const loaded = await getLedgerOrSeed();
    return NextResponse.json({
      snapshot: loaded.snapshot,
      actingActorId: loaded.actingActorId,
      preferredTraceLotId: loaded.preferredTraceLotId,
    });
  } catch (err) {
    console.error("GET /api/ledger", err);
    return jsonError(err instanceof Error ? err.message : "Failed to load ledger.", 500);
  }
}
