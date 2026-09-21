/** Actor roles in the coffee supply network. */
export type ActorType =
  | "farmer"
  | "collector"
  | "akrabi"
  | "washing_station"
  | "mill"
  | "exporter"
  | "transporter"
  | "regulator";

/** Physical form of coffee in a lot. */
export type ProcessingState =
  | "cherry"
  | "wet_parchment"
  | "dry_parchment"
  | "dried_cherry"
  | "green_natural"
  | "green_washed";

/** Processing route chosen (or deferred) at origin. */
export type ProcessingRoute = "washed" | "natural" | "unknown_at_origin";

export type LotStatus = "active" | "inactive";

export type OriginStatus = "farmer_verified" | "recorded_by_counterparty";

export type ActorStatus = "active" | "inactive";

export type MovementState = "pending" | "received_clean" | "received_discrepant";

export type DiscrepancyStatus = "open" | "resolved";

export type TerminalReason = "fob_export" | "domestic_disposition" | "destroyed";

export type EventType =
  | "actor_onboarded"
  | "origin_lot_created"
  | "intake_lot_recorded"
  | "movement_send"
  | "movement_receive"
  | "ownership_transfer"
  | "disaggregate"
  | "aggregate"
  | "process"
  | "terminal_disposition"
  | "correction";

/** Farmer-origin share of a lot keyed by farmer actorId. */
export type Provenance = Record<string, number>;

export type ActorMetadata = Record<string, string | number>;

export interface Actor {
  actorId: string;
  actorType: ActorType;
  displayName: string;
  legalIdentityRef: string;
  status: ActorStatus;
  sponsorActorId: string | null;
  metadata: ActorMetadata;
}

export interface Lot {
  lotId: string;
  commodity: "coffee";
  processingState: ProcessingState;
  processingRoute: ProcessingRoute;
  status: LotStatus;
  canonicalMassKg: number;
  ownerActorId: string;
  custodianActorId: string;
  locationId: string;
  originLocationId?: string;
  cropYear: string;
  originStatus: OriginStatus;
  createdEventId: string;
  provenance: Provenance;
  inactiveEventId: string | null;
  inTransit: boolean;
}

export interface Event {
  eventId: string;
  eventType: EventType;
  eventTime: string;
  recordTime: string;
  executingPersonId: string;
  onBehalfOfActorId: string;
  payload: Record<string, unknown>;
  correctsEventId: string | null;
}

export interface Movement {
  movementId: string;
  lotId: string;
  fromActorId: string;
  toActorId: string;
  senderDeclaredKg: number;
  destinationLocationId: string;
  state: MovementState;
  receiverDeclaredKg?: number;
}

export interface Lineage {
  parentLotId: string;
  childLotId: string;
  contributionKg: number;
  proportion: number;
}

export interface Discrepancy {
  discrepancyId: string;
  movementId: string;
  lotId: string;
  senderKg: number;
  receiverKg: number;
  deltaKg: number;
  status: DiscrepancyStatus;
}

export interface CreateOriginLotParams {
  farmerActorId: string;
  recordedByActorId: string;
  executingPersonId: string;
  massKg: number;
  processingState: ProcessingState;
  processingRoute: ProcessingRoute;
  locationId: string;
  cropYear: string;
}

/** Mid/downstream intake: lot enters receiver custody with lineage back through supplier. */
export interface CreateIntakeLotParams {
  supplierActorId: string;
  receiverActorId: string;
  executingPersonId: string;
  massKg: number;
  processingState: ProcessingState;
  processingRoute: ProcessingRoute;
  locationId: string;
  cropYear: string;
}

export interface MovementSendParams {
  lotId: string;
  fromActorId: string;
  toActorId: string;
  senderDeclaredKg: number;
  executingPersonId: string;
  destinationLocationId: string;
}

export interface MovementReceiveParams {
  movementId: string;
  receiverDeclaredKg: number;
  executingPersonId: string;
}

export interface TransferOwnershipParams {
  lotId: string;
  newOwnerActorId: string;
  executingPersonId: string;
  actingActorId: string;
}

export interface DisaggregateParams {
  parentLotId: string;
  childMassesKg: number[];
  executingPersonId: string;
  actingActorId: string;
}

export interface AggregateParams {
  parentLotIds: string[];
  executingPersonId: string;
  actingActorId: string;
}

export interface ProcessParams {
  inputLotIds: string[];
  outputState: ProcessingState;
  outputMassKg: number;
  rejectKg: number;
  lossKg: number;
  executingPersonId: string;
  actingActorId: string;
  lossCategory?: string | null;
}

export interface TerminalDisposeParams {
  lotId: string;
  reason: TerminalReason | string;
  executingPersonId: string;
  actingActorId: string;
}

export interface CorrectEventParams {
  originalEventId: string;
  correctedPayload: Record<string, unknown>;
  reason: string;
  executingPersonId: string;
  actingActorId: string;
}
