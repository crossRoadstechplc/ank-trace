import type { Ledger } from "./engine";
import type { Actor, ActorType, ProcessingRoute, ProcessingState, TerminalReason } from "./types";

export const STATE_LABELS: Record<ProcessingState, string> = {
  cherry: "Cherry",
  wet_parchment: "Wet parchment",
  dry_parchment: "Dry parchment",
  dried_cherry: "Dried cherry",
  green_natural: "Green (natural)",
  green_washed: "Green (washed)",
};

export const ROUTE_LABELS: Record<ProcessingRoute, string> = {
  washed: "Washed",
  natural: "Natural",
  unknown_at_origin: "Unknown at origin",
};

export const REASON_LABELS: Record<TerminalReason, string> = {
  fob_export: "Export at FOB",
  domestic_disposition: "Sold domestically",
  destroyed: "Destroyed / lost",
};

export const ACTOR_TYPE_LABELS: Record<ActorType, string> = {
  farmer: "Farmer",
  akrabi: "Akrabi",
  washing_station: "Washing station",
  mill: "Mill",
  exporter: "Exporter",
  transporter: "Transporter",
  regulator: "Regulator",
};

/** Who can onboard whom. */
export const ONBOARD_RULES: Partial<Record<ActorType, ActorType[]>> = {
  exporter: ["akrabi"],
  akrabi: ["farmer"],
};

/** Metadata fields: [key, label, placeholder]. */
export type MetadataField = [key: string, label: string, placeholder: string];

export const METADATA_FIELDS: Partial<Record<ActorType, MetadataField[]>> = {
  farmer: [
    ["region", "Region", "Sidama"],
    ["zone", "Zone", ""],
    ["woreda", "Woreda", ""],
    ["kebele", "Kebele", ""],
    ["phone", "Phone", ""],
    ["farmSizeHa", "Farm size (ha)", ""],
    ["variety", "Primary variety", "Heirloom"],
    ["yearsFarming", "Years farming", ""],
  ],
  akrabi: [
    ["region", "Region", "Sidama"],
    ["zone", "Zone", ""],
    ["woreda", "Woreda", ""],
    ["registrationNo", "Registration no.", ""],
    ["license", "License", ""],
    ["warehouseLocation", "Warehouse location", ""],
    ["yearsOperating", "Years operating", ""],
  ],
  washing_station: [
    ["region", "Region", "Sidama"],
    ["zone", "Zone", ""],
    ["woreda", "Woreda", ""],
    ["kebele", "Kebele", ""],
    ["registrationNo", "Registration no.", ""],
    ["capacityKgPerDay", "Capacity (kg/day)", ""],
    ["operator", "Operator", ""],
  ],
  mill: [
    ["region", "Region", "Sidama"],
    ["zone", "Zone", ""],
    ["woreda", "Woreda", ""],
    ["kebele", "Kebele", ""],
    ["registrationNo", "Registration no.", ""],
    ["capacityKgPerDay", "Capacity (kg/day)", ""],
    ["operator", "Operator", ""],
  ],
  exporter: [
    ["address", "Address", "Addis Ababa"],
    ["exportLicense", "Export license", ""],
    ["nbeRegistration", "NBE / ECX registration", ""],
    ["contactPerson", "Contact person", ""],
    ["contactPhone", "Contact phone", ""],
  ],
};

export function stateLabel(s: string): string {
  return STATE_LABELS[s as ProcessingState] || s;
}

export function routeLabel(r: string): string {
  return ROUTE_LABELS[r as ProcessingRoute] || r;
}

export function reasonLabel(reason: string): string {
  return REASON_LABELS[reason as TerminalReason] || reason;
}

export function actorTypeLabel(type: string): string {
  return ACTOR_TYPE_LABELS[type as ActorType] || type;
}

export function actorLabel(ledger: Ledger, actorId: string): string {
  const a = ledger.actors.get(actorId);
  return a ? a.displayName : actorId;
}

export function sponsoredBy(ledger: Ledger, actorId: string): Actor[] {
  return [...ledger.actors.values()].filter((a) => a.sponsorActorId === actorId);
}

export function canOnboardTypes(ledger: Ledger, actorId: string): ActorType[] {
  const a = ledger.actors.get(actorId);
  return a ? ONBOARD_RULES[a.actorType] || [] : [];
}

export function fmtKg(n: number | string): string {
  return Number(n).toLocaleString("en-US");
}

export function formatEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
