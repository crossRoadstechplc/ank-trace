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

export function primaryWorkspaceAction(
  role: SessionRole | null,
): "newLot" | "addFarmer" | "addAkrabi" | null {
  if (role === "farmer") return "newLot";
  if (role === "akrabi") return "addFarmer";
  if (role === "exporter") return "addAkrabi";
  return null;
}

export function dashboardKicker(role: SessionRole | null): string {
  if (role === "farmer") return "Farmer Dashboard";
  if (role === "akrabi") return "Aggregator Dashboard";
  if (role === "exporter") return "Exporter Dashboard";
  return "Ledger Workspace";
}

/** Redact farmer display names for exporter-facing UI. */
export function displayActorName(
  ledger: Ledger,
  actorId: string,
  role: SessionRole | null,
): string {
  const actor = ledger.actors.get(actorId);
  if (!actor) return actorId;
  if (role === "exporter" && actor.actorType === "farmer") {
    return "Origin farmer (protected)";
  }
  return actor.displayName;
}
