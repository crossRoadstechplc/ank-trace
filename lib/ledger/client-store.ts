import {
  createLotCodeHelpers,
  type BootstrapResult,
  type SeededNetwork,
} from "./seed";
import {
  ledgerFromSnapshot,
  type LedgerSnapshot,
} from "./snapshot";
import type { Actor } from "./types";

const GLOBAL_KEY = "__ankuaru_ledger_boot_v7__";

type GlobalBoot = typeof globalThis & {
  [GLOBAL_KEY]?: BootstrapResult;
};

function emptySeeded(exporter: Actor | undefined): SeededNetwork {
  const fallback: Actor =
    exporter ??
    ({
      actorId: "unknown",
      actorType: "exporter",
      displayName: "Exporter",
      legalIdentityRef: "unknown",
      status: "active",
      sponsorActorId: null,
      metadata: {},
    } as Actor);
  return {
    exporter: fallback,
    akrabis: [],
    collectors: [],
    stations: [],
    allFarmers: [],
    deliveries: [],
  };
}

function bootFromSnapshot(snapshot: LedgerSnapshot): BootstrapResult {
  const ledger = ledgerFromSnapshot(snapshot);
  const helpers = createLotCodeHelpers(ledger);
  helpers.assignCodes();
  const exporter = [...ledger.actors.values()].find((a) => a.actorType === "exporter");
  return {
    ledger,
    actingActorId: snapshot.actingActorId ?? exporter?.actorId ?? "",
    preferredTraceLotId: snapshot.preferredTraceLotId,
    seeded: emptySeeded(exporter),
    ...helpers,
  };
}

/** Install DB snapshot into the in-memory client cache (after GET/POST). */
export function installClientLedger(snapshot: LedgerSnapshot): BootstrapResult {
  const g = globalThis as GlobalBoot;
  g[GLOBAL_KEY] = bootFromSnapshot(snapshot);
  return g[GLOBAL_KEY];
}

export function peekClientLedger(): BootstrapResult | null {
  const g = globalThis as GlobalBoot;
  return g[GLOBAL_KEY] ?? null;
}

/** One ledger per tab after hydrate from GET /api/ledger. */
export function getClientLedger(): BootstrapResult {
  const g = globalThis as GlobalBoot;
  if (!g[GLOBAL_KEY]) {
    throw new Error("Ledger not hydrated. Wait for LedgerProvider / role select load.");
  }
  return g[GLOBAL_KEY];
}

export function resetClientLedger(snapshot?: LedgerSnapshot): BootstrapResult | null {
  const g = globalThis as GlobalBoot;
  if (!snapshot) {
    delete g[GLOBAL_KEY];
    return null;
  }
  return installClientLedger(snapshot);
}
