/** Session-only role binding (not persisted to Postgres). */

export type SessionRole = "farmer" | "collector" | "akrabi" | "exporter";

export type RoleSession = {
  role: SessionRole;
  /** Stable seed identity — survives ledger re-bootstrap across page loads. */
  legalIdentityRef: string;
};

export const ROLE_SESSION_KEY = "ank_role";

export const SESSION_ROLE_LABELS: Record<SessionRole, string> = {
  farmer: "Farmer",
  collector: "Collector",
  akrabi: "Aggregator",
  exporter: "Exporter",
};

const VALID_ROLES: SessionRole[] = ["farmer", "collector", "akrabi", "exporter"];

export function getRoleSession(): RoleSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ROLE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoleSession & { actorId?: string };
    if (!parsed || !VALID_ROLES.includes(parsed.role)) {
      return null;
    }
    // Migrate legacy { role, actorId } by treating as invalid — force re-pick
    if (typeof parsed.legalIdentityRef !== "string" || !parsed.legalIdentityRef) {
      return null;
    }
    return { role: parsed.role, legalIdentityRef: parsed.legalIdentityRef };
  } catch {
    return null;
  }
}

export function setRoleSession(session: RoleSession): void {
  sessionStorage.setItem(ROLE_SESSION_KEY, JSON.stringify(session));
}

export function clearRoleSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ROLE_SESSION_KEY);
}
