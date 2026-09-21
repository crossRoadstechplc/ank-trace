import type { LedgerSnapshot } from "./snapshot";
import type { Actor, ActorType, Lot, ProcessingRoute, ProcessingState } from "./types";

export type LedgerApiResponse = {
  snapshot: LedgerSnapshot;
  actingActorId: string;
  preferredTraceLotId: string | null;
  actor?: Actor;
  lot?: Lot;
  result?: unknown;
};

async function parseJson(res: Response): Promise<LedgerApiResponse> {
  const data = (await res.json()) as LedgerApiResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function fetchLedgerSnapshot(): Promise<LedgerApiResponse> {
  const res = await fetch("/api/ledger", { cache: "no-store" });
  return parseJson(res);
}

export type OnboardActorBody = {
  actorType: ActorType;
  displayName: string;
  legalIdentityRef: string;
  sponsorActorId: string | null;
  metadata?: Record<string, string>;
  facility?: {
    actorType: "washing_station" | "mill";
    displayName: string;
    legalIdentityRef: string;
    metadata?: Record<string, string>;
  };
};

export async function postLedgerActor(body: OnboardActorBody): Promise<LedgerApiResponse> {
  const res = await fetch("/api/ledger/actors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export type CreateLotBody =
  | {
      kind: "origin";
      farmerActorId: string;
      recordedByActorId: string;
      executingPersonId: string;
      massKg: number;
      processingState: ProcessingState;
      processingRoute: ProcessingRoute;
      locationId: string;
      cropYear: string;
    }
  | {
      kind: "intake";
      supplierActorId: string;
      receiverActorId: string;
      executingPersonId: string;
      massKg: number;
      processingState: ProcessingState;
      processingRoute: ProcessingRoute;
      locationId: string;
      cropYear: string;
    };

export async function postLedgerLot(body: CreateLotBody): Promise<LedgerApiResponse> {
  const res = await fetch("/api/ledger/lots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export type LedgerCommandBody =
  | {
      command: "send";
      lotId: string;
      fromActorId: string;
      toActorId: string;
      senderDeclaredKg: number;
      executingPersonId: string;
      destinationLocationId: string;
    }
  | {
      command: "receive";
      movementId: string;
      receiverDeclaredKg: number;
      executingPersonId: string;
    }
  | {
      command: "aggregate";
      parentLotIds: string[];
      executingPersonId: string;
      actingActorId: string;
    }
  | {
      command: "disaggregate";
      parentLotId: string;
      childMassesKg: number[];
      executingPersonId: string;
      actingActorId: string;
    }
  | {
      command: "process";
      inputLotIds: string[];
      outputState: ProcessingState;
      outputMassKg: number;
      rejectKg: number;
      lossKg: number;
      executingPersonId: string;
      actingActorId: string;
      lossCategory?: string | null;
    }
  | {
      command: "transferOwnership";
      lotId: string;
      newOwnerActorId: string;
      executingPersonId: string;
      actingActorId: string;
    }
  | {
      command: "terminalDispose";
      lotId: string;
      reason: "fob_export" | "domestic_disposition" | "destroyed";
      executingPersonId: string;
      actingActorId: string;
    };

export async function postLedgerCommand(body: LedgerCommandBody): Promise<LedgerApiResponse> {
  const res = await fetch("/api/ledger/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}
