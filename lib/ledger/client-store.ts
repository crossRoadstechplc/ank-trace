import { bootstrap, type BootstrapResult } from "./seed";

const GLOBAL_KEY = "__ankuaru_ledger_boot_v5__";

type GlobalBoot = typeof globalThis & {
  [GLOBAL_KEY]?: BootstrapResult;
};

/** One seeded ledger per browser tab so role pick and dashboard share actor IDs. */
export function getClientLedger(): BootstrapResult {
  const g = globalThis as GlobalBoot;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = bootstrap();
  }
  return g[GLOBAL_KEY];
}

export function resetClientLedger(): BootstrapResult {
  const g = globalThis as GlobalBoot;
  g[GLOBAL_KEY] = bootstrap();
  return g[GLOBAL_KEY];
}
