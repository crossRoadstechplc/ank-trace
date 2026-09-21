import type { Ledger } from "./engine";
import { sponsoredBy } from "./labels";
import type { Actor, ActorType } from "./types";
import type { SessionRole } from "@/lib/role-session";

export function actorsOfType(ledger: Ledger, type: ActorType): Actor[] {
  return [...ledger.actors.values()]
    .filter((a) => a.actorType === type)
    .filter((a) => {
      // Role pick: seeded demo identities + parties the user onboarded.
      if (
        type === "farmer" ||
        type === "collector" ||
        type === "akrabi" ||
        type === "exporter"
      ) {
        return (
          a.metadata?.demoSelectable === "true" ||
          a.metadata?.userOnboarded === "true"
        );
      }
      return true;
    })
    .sort((a, b) => {
      // Keep demo picks first; newly onboarded after (easier to find).
      const aNew = a.metadata?.userOnboarded === "true" ? 1 : 0;
      const bNew = b.metadata?.userOnboarded === "true" ? 1 : 0;
      if (aNew !== bNew) return aNew - bNew;
      return a.legalIdentityRef.localeCompare(b.legalIdentityRef);
    });
}

/** Who appears in the Network view for the acting actor. */
export function networkVisibleActors(ledger: Ledger, actingActorId: string): Actor[] {
  const self = ledger.actors.get(actingActorId);
  if (!self) return [];

  if (self.actorType === "farmer") {
    return [self];
  }
  if (self.actorType === "collector") {
    return sponsoredBy(ledger, actingActorId).filter((a) => a.actorType === "farmer");
  }
  if (self.actorType === "akrabi") {
    return sponsoredBy(ledger, actingActorId).filter((a) => a.actorType === "collector");
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
  if (self.actorType === "collector") {
    if (!self.sponsorActorId) return [];
    const sponsor = ledger.actors.get(self.sponsorActorId);
    return sponsor ? [sponsor] : [];
  }
  if (self.actorType === "akrabi") {
    return [...ledger.actors.values()].filter((a) => a.actorType === "exporter");
  }
  if (self.actorType === "exporter") {
    return sponsoredBy(ledger, actingActorId).filter((a) => a.actorType === "akrabi");
  }
  return [];
}

export function canShowFarmerIdentity(role: SessionRole | null): boolean {
  return role === "farmer" || role === "collector";
}

/** Who the acting actor may record an intake lot from. */
export function allowedIntakeSuppliers(ledger: Ledger, actingActorId: string): Actor[] {
  const self = ledger.actors.get(actingActorId);
  if (!self) return [];

  if (self.actorType === "collector") {
    return sponsoredBy(ledger, actingActorId)
      .filter((a) => a.actorType === "farmer")
      .sort((a, b) => a.legalIdentityRef.localeCompare(b.legalIdentityRef));
  }
  if (self.actorType === "akrabi") {
    return sponsoredBy(ledger, actingActorId)
      .filter((a) => a.actorType === "collector")
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
  if (
    role === "farmer" ||
    role === "collector" ||
    role === "akrabi" ||
    role === "exporter"
  ) {
    return "newLot";
  }
  return null;
}

export function dashboardKicker(role: SessionRole | null): string {
  if (role === "farmer") return "Farmer Dashboard";
  if (role === "collector") return "Collector Dashboard";
  if (role === "akrabi") return "Aggregator Dashboard";
  if (role === "exporter") return "Exporter Dashboard";
  return "Ledger Workspace";
}

/** Stable peer list for Farmer N / Collector N / Aggregator N labels. */
function numberedPeers(ledger: Ledger, actor: Actor): Actor[] {
  if (
    actor.actorType === "farmer" ||
    actor.actorType === "collector" ||
    actor.actorType === "akrabi"
  ) {
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
  const prefix =
    actor.actorType === "akrabi"
      ? "Aggregator"
      : actor.actorType === "collector"
        ? "Collector"
        : "Farmer";
  const idx = peers.findIndex((a) => a.actorId === actor.actorId);
  return idx >= 0 ? `${prefix} ${idx + 1}` : prefix;
}

/**
 * Display name for UI. Mid/downstream roles see Farmer N / Collector N / Aggregator N.
 * User-onboarded parties also show the entered name: "Collector 4 · Abebe".
 */
export function displayActorName(
  ledger: Ledger,
  actorId: string,
  role: SessionRole | null,
): string {
  const actor = ledger.actors.get(actorId);
  if (!actor) return actorId;

  const useNumbers =
    role === "exporter" || role === "akrabi" || role === "collector";
  if (
    useNumbers &&
    (actor.actorType === "farmer" ||
      actor.actorType === "collector" ||
      actor.actorType === "akrabi")
  ) {
    const num = numberedLabel(actor, numberedPeers(ledger, actor));
    const name = String(actor.displayName || "").trim();
    if (actor.metadata?.userOnboarded === "true" && name) {
      return `${num} · ${name}`;
    }
    return num;
  }

  return actor.displayName;
}
