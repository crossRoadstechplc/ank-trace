import type { Ledger } from "./engine";
import type { Lot } from "./types";

function parentsOf(ledger: Ledger, lotId: string): string[] {
  return ledger.lineage.filter((e) => e.childLotId === lotId).map((e) => e.parentLotId);
}

/** Collect this lot and all upstream ancestors (reference collectAllNodeIds). */
export function collectAllNodeIds(ledger: Ledger, lotId: string, acc: Set<string> = new Set()): Set<string> {
  acc.add(lotId);
  for (const p of parentsOf(ledger, lotId)) collectAllNodeIds(ledger, p, acc);
  return acc;
}

export type ActorDelivery = {
  lot: Lot;
  receivedKg: number;
  time: string;
};

/**
 * Lots the acting actor received whose lineage passed through `fromActorId`
 * (send or process on behalf of that actor) — matches reference actorDeliveriesTo.
 */
export function actorDeliveriesTo(
  ledger: Ledger,
  fromActorId: string,
  toActorId: string,
): ActorDelivery[] {
  const results: ActorDelivery[] = [];

  for (const ev of ledger.events) {
    if (ev.eventType !== "movement_receive") continue;
    const mid = ev.payload.movementId as string | undefined;
    if (!mid) continue;
    const mv = ledger.movements.get(mid);
    if (!mv || mv.toActorId !== toActorId) continue;
    const lot = ledger.lots.get(mv.lotId);
    if (!lot) continue;

    const chain = collectAllNodeIds(ledger, lot.lotId, new Set());
    const passedThrough = ledger.events.some((e2) => {
      if (e2.onBehalfOfActorId !== fromActorId) return false;
      if (e2.eventType === "movement_send") {
        return chain.has(e2.payload.lotId as string);
      }
      if (e2.eventType === "process") {
        const inputs = e2.payload.inputLotIds as string[] | undefined;
        return Boolean(inputs?.some((id) => chain.has(id)));
      }
      return false;
    });

    if (passedThrough) {
      results.push({
        lot,
        receivedKg: (ev.payload.receiverDeclaredKg as number) ?? mv.receiverDeclaredKg ?? mv.senderDeclaredKg,
        time: ev.eventTime,
      });
    }
  }

  return results.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}
