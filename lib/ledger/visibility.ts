import type { Ledger } from "./engine";
import { sponsoredBy } from "./labels";
import type { Actor, ActorType } from "./types";
import type { SessionRole } from "@/lib/role-session";

export function actorsOfType(ledger: Ledger, type: ActorType): Actor[] {
  return [...ledger.actors.values()]
    .filter((a) => a.actorType === type)
    .filter((a) => {
      // Role pick / demo lists: only seeded "good" actors with demoSelectable
      if (type === "farmer" || type === "akrabi" || type === "exporter") {
        return a.metadata?.demoSelectable === "true";
      }
      return true;
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Who appears in the Network view for the acting actor. */
export function networkVisibleActors(ledger: Ledger, actingActorId: string): Actor[] {
  const self = ledger.actors.get(actingActorId);
  if (!self) return [];

  if (self.actorType === "farmer") {
    return [self];
  }
  if (self.actorType === "akrabi") {
    return sponsoredBy(ledger, actingActorId).filter((a) => a.actorType === "farmer");
  }
  if (self.actorType === "exporter") {
    return sponsoredBy(ledger, actingActorId).filter((a) => a.actorType === "akrabi");
  }
  return [];
}

/** Allowed recipients when sending a lot. */
export function allowedSendTargets(ledger: Ledger, actingActorId: string): Actor[] {
  const self = ledger.actors.get(actingActorId);
  if (!self) return [];

  if (self.actorType === "farmer") {
    if (!self.sponsorActorId) return [];
    const sponsor = ledger.actors.get(self.sponsorActorId);
    return sponsor ? [sponsor] : [];
  }
  if (self.actorType === "akrabi") {
    return [...ledger.actors.values()].filter((a) => a.actorType === "exporter");
  }
  if (self.actorType === "exporter") {
    // Exporter may send within network of sponsored akrabis only (no farmers).
    return sponsoredBy(ledger, actingActorId).filter((a) => a.actorType === "akrabi");
  }
  return [];
}

export function canShowFarmerIdentity(role: SessionRole | null): boolean {
  return role === "farmer" || role === "akrabi";
}

/** Who the acting actor may record an intake lot from. */
export function allowedIntakeSuppliers(ledger: Ledger, actingActorId: string): Actor[] {
  const self = ledger.actors.get(actingActorId);
  if (!self) return [];

  if (self.actorType === "akrabi") {
    return sponsoredBy(ledger, actingActorId)
      .filter((a) => a.actorType === "farmer")
      .sort((a, b) => a.legalIdentityRef.localeCompare(b.legalIdentityRef));
  }
  if (self.actorType === "exporter") {
    return sponsoredBy(ledger, actingActorId)
      .filter((a) => a.actorType === "akrabi")
      .sort((a, b) => a.legalIdentityRef.localeCompare(b.legalIdentityRef));
  }
  return [];
}

/** Immediate prior party for a lot (last completed inbound movement), else null for harvest origin. */
export function immediateSupplierOf(ledger: Ledger, lotId: string): Actor | null {
  const completed = [...ledger.movements.values()].filter(
    (m) => m.lotId === lotId && m.state !== "pending",
  );
  if (completed.length === 0) return null;
  const last = completed[completed.length - 1];
  return ledger.actors.get(last.fromActorId) ?? null;
}

export function primaryWorkspaceAction(
  role: SessionRole | null,
): "newLot" | "addFarmer" | "addAkrabi" | null {
  // Every role can add a lot from the workspace; onboard CTAs stay in the toolbar.
  if (role === "farmer" || role === "akrabi" || role === "exporter") return "newLot";
  return null;
}

export function dashboardKicker(role: SessionRole | null): string {
  if (role === "farmer") return "Farmer Dashboard";
  if (role === "akrabi") return "Aggregator Dashboard";
  if (role === "exporter") return "Exporter Dashboard";
  return "Ledger Workspace";
}

/** Stable peer list for Farmer N / Aggregator N labels. */
function numberedPeers(
  ledger: Ledger,
  actor: Actor,
): Actor[] {
  if (actor.actorType === "farmer" || actor.actorType === "akrabi") {
    return [...ledger.actors.values()]
      .filter(
        (a) =>
          a.actorType === actor.actorType &&
          a.sponsorActorId === actor.sponsorActorId,
      )
      .sort((a, b) => a.legalIdentityRef.localeCompare(b.legalIdentityRef));
  }
  return [];
}

function numberedLabel(actor: Actor, peers: Actor[]): string {
  const prefix = actor.actorType === "akrabi" ? "Aggregator" : "Farmer";
  const idx = peers.findIndex((a) => a.actorId === actor.actorId);
  return idx >= 0 ? `${prefix} ${idx + 1}` : prefix;
}

/**
 * Display name for UI. On aggregator/exporter views, farmers and aggregators
 * are shown as Farmer N / Aggregator N instead of personal or place names.
 */
export function displayActorName(
  ledger: Ledger,
  actorId: string,
  role: SessionRole | null,
): string {
  const actor = ledger.actors.get(actorId);
  if (!actor) return actorId;

  const useNumbers = role === "exporter" || role === "akrabi";
  if (useNumbers && (actor.actorType === "farmer" || actor.actorType === "akrabi")) {
    return numberedLabel(actor, numberedPeers(ledger, actor));
  }

  return actor.displayName;
}
