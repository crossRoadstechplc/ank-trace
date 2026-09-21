import type {
  Actor,
  ActorMetadata,
  ActorType,
  AggregateParams,
  CorrectEventParams,
  CreateOriginLotParams,
  CreateIntakeLotParams,
  DisaggregateParams,
  Discrepancy,
  Event,
  EventType,
  Lineage,
  Lot,
  Movement,
  MovementReceiveParams,
  MovementSendParams,
  ProcessParams,
  ProcessingState,
  Provenance,
  TerminalDisposeParams,
  TransferOwnershipParams,
} from "./types";

export class InvariantViolation extends Error {
  invariantId: string;

  constructor(invariantId: string, message: string) {
    super(`[${invariantId}] ${message}`);
    this.name = "InvariantViolation";
    this.invariantId = invariantId;
  }
}

let _idCounter = 0;

export function newId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}_${_idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Reset the id counter — useful for deterministic tests. */
export function resetIdCounter(): void {
  _idCounter = 0;
}

export const LOSS_ELIGIBLE_STATES = new Set<ProcessingState>([
  "cherry",
  "wet_parchment",
  "dry_parchment",
  "dried_cherry",
]);

export class Ledger {
  actors = new Map<string, Actor>();
  lots = new Map<string, Lot>();
  events: Event[] = [];
  lineage: Lineage[] = [];
  discrepancies: Discrepancy[] = [];
  movements = new Map<string, Movement>();

  _commit(
    eventType: EventType,
    executingPersonId: string,
    onBehalfOfActorId: string,
    payload: Record<string, unknown>,
    corrects: string | null = null,
  ): Event {
    const now = new Date().toISOString();
    const ev: Event = {
      eventId: newId("evt"),
      eventType,
      eventTime: now,
      recordTime: now,
      executingPersonId,
      onBehalfOfActorId,
      payload,
      correctsEventId: corrects,
    };
    this.events.push(ev);
    return ev;
  }

  _requireActive(lotId: string, invariant = "INV-04"): Lot {
    const lot = this.lots.get(lotId);
    if (!lot) throw new InvariantViolation(invariant, `Lot ${lotId} does not exist.`);
    if (lot.status !== "active") {
      throw new InvariantViolation(
        invariant,
        `Lot ${lotId} is not active (status=${lot.status}); an inactive lot cannot be consumed or disposed again.`,
      );
    }
    if (lot.inTransit) {
      throw new InvariantViolation(
        "INV-09",
        `Lot ${lotId} has a pending movement in progress; single disposition authority forbids a second concurrent action.`,
      );
    }
    return lot;
  }

  _deactivate(lot: Lot, eventId: string): void {
    lot.status = "inactive";
    lot.inactiveEventId = eventId;
  }

  onboardActor(
    actorType: ActorType,
    displayName: string,
    legalIdentityRef: string,
    sponsorActorId: string | null = null,
    metadata: ActorMetadata = {},
  ): Actor {
    const actor: Actor = {
      actorId: newId("actor"),
      actorType,
      displayName,
      legalIdentityRef,
      status: "active",
      sponsorActorId,
      metadata,
    };
    this.actors.set(actor.actorId, actor);
    this._commit("actor_onboarded", actor.actorId, actor.actorId, {
      actorId: actor.actorId,
      actorType,
      sponsorActorId,
    });
    return actor;
  }

  createOriginLot({
    farmerActorId,
    recordedByActorId,
    executingPersonId,
    massKg,
    processingState,
    processingRoute,
    locationId,
    cropYear,
  }: CreateOriginLotParams): Lot {
    if (!farmerActorId) {
      throw new InvariantViolation("INV-10", "Coffee cannot enter the ledger without a named farmer origin.");
    }
    if (massKg <= 0) {
      throw new InvariantViolation("INV-07", "Origin mass must be positive.");
    }
    const originStatus =
      recordedByActorId === farmerActorId ? "farmer_verified" : "recorded_by_counterparty";
    const ev = this._commit("origin_lot_created", executingPersonId, recordedByActorId, {
      farmerActorId,
      massKg,
    });
    const lot: Lot = {
      lotId: newId("lot"),
      commodity: "coffee",
      processingState,
      processingRoute,
      status: "active",
      canonicalMassKg: massKg,
      ownerActorId: farmerActorId,
      custodianActorId: farmerActorId,
      locationId,
      originLocationId: locationId,
      cropYear,
      originStatus,
      createdEventId: ev.eventId,
      provenance: { [farmerActorId]: 1.0 },
      inactiveEventId: null,
      inTransit: false,
    };
    this.lots.set(lot.lotId, lot);
    return lot;
  }

  /**
   * Record an intake lot for an aggregator/exporter: creates farmer origin,
   * moves through the immediate supplier, then into receiver custody with ownership.
   * Lineage and movements both point back to the supplier before.
   */
  createIntakeLot({
    supplierActorId,
    receiverActorId,
    executingPersonId,
    massKg,
    processingState,
    processingRoute,
    locationId,
    cropYear,
  }: CreateIntakeLotParams): Lot {
    const supplier = this.actors.get(supplierActorId);
    const receiver = this.actors.get(receiverActorId);
    if (!supplier) {
      throw new InvariantViolation("INV-10", `Unknown supplier ${supplierActorId}.`);
    }
    if (!receiver) {
      throw new InvariantViolation("INV-10", `Unknown receiver ${receiverActorId}.`);
    }
    if (massKg <= 0) {
      throw new InvariantViolation("INV-07", "Intake mass must be positive.");
    }

    let farmerActorId: string;
    if (supplier.actorType === "farmer") {
      farmerActorId = supplier.actorId;
    } else if (supplier.actorType === "akrabi") {
      const farm = [...this.actors.values()].find(
        (a) => a.actorType === "farmer" && a.sponsorActorId === supplier.actorId,
      );
      if (!farm) {
        throw new InvariantViolation(
          "INV-10",
          `${supplier.displayName} has no farmers to attribute origin to.`,
        );
      }
      farmerActorId = farm.actorId;
    } else {
      throw new InvariantViolation(
        "INV-10",
        `Intake supplier must be a farmer or aggregator (got ${supplier.actorType}).`,
      );
    }

    const origin = this.createOriginLot({
      farmerActorId,
      recordedByActorId: receiverActorId,
      executingPersonId,
      massKg,
      processingState,
      processingRoute,
      locationId,
      cropYear,
    });

    const hop = (fromId: string, toId: string, dest: string) => {
      const mid = this.movementSend({
        lotId: origin.lotId,
        fromActorId: fromId,
        toActorId: toId,
        senderDeclaredKg: origin.canonicalMassKg,
        executingPersonId: fromId,
        destinationLocationId: dest,
      });
      this.movementReceive({
        movementId: mid,
        receiverDeclaredKg: origin.canonicalMassKg,
        executingPersonId: toId,
      });
    };

    // Farmer → aggregator (when supplier is akrabi), then supplier → receiver.
    if (supplier.actorType === "akrabi" && farmerActorId !== supplier.actorId) {
      hop(
        farmerActorId,
        supplier.actorId,
        `${supplier.displayName} store`,
      );
    }

    if (origin.custodianActorId !== receiverActorId) {
      hop(origin.custodianActorId, receiverActorId, locationId);
    }

    if (origin.ownerActorId !== receiverActorId) {
      this.transferOwnership({
        lotId: origin.lotId,
        newOwnerActorId: receiverActorId,
        executingPersonId,
        actingActorId: receiverActorId,
      });
    }

    this._commit("intake_lot_recorded", executingPersonId, receiverActorId, {
      lotId: origin.lotId,
      supplierActorId,
      farmerActorId,
      massKg: origin.canonicalMassKg,
    });

    return origin;
  }

  movementSend({
    lotId,
    fromActorId,
    toActorId,
    senderDeclaredKg,
    executingPersonId,
    destinationLocationId,
  }: MovementSendParams): string {
    const lot = this._requireActive(lotId);
    if (lot.custodianActorId !== fromActorId) {
      throw new InvariantViolation("INV-12", `${fromActorId} is not the current custodian of ${lotId}.`);
    }
    const movementId = newId("mov");
    lot.inTransit = true;
    this.movements.set(movementId, {
      movementId,
      lotId,
      fromActorId,
      toActorId,
      senderDeclaredKg,
      destinationLocationId,
      state: "pending",
    });
    this._commit("movement_send", executingPersonId, fromActorId, {
      movementId,
      lotId,
      senderDeclaredKg,
    });
    return movementId;
  }

  movementReceive({
    movementId,
    receiverDeclaredKg,
    executingPersonId,
  }: MovementReceiveParams): Movement {
    const mv = this.movements.get(movementId);
    if (!mv) throw new InvariantViolation("INV-11", `Unknown movement ${movementId}.`);
    const lot = this.lots.get(mv.lotId);
    if (!lot) throw new InvariantViolation("INV-04", `Lot ${mv.lotId} does not exist.`);
    const discrepancyKg = Math.round((receiverDeclaredKg - mv.senderDeclaredKg) * 1e6) / 1e6;
    if (discrepancyKg !== 0) {
      mv.state = "received_discrepant";
      this.discrepancies.push({
        discrepancyId: newId("disc"),
        movementId,
        lotId: lot.lotId,
        senderKg: mv.senderDeclaredKg,
        receiverKg: receiverDeclaredKg,
        deltaKg: discrepancyKg,
        status: "open",
      });
    } else {
      mv.state = "received_clean";
    }
    lot.custodianActorId = mv.toActorId;
    lot.locationId = mv.destinationLocationId;
    lot.inTransit = false;
    mv.receiverDeclaredKg = receiverDeclaredKg;
    this._commit("movement_receive", executingPersonId, mv.toActorId, {
      movementId,
      receiverDeclaredKg,
      discrepancyKg,
    });
    return mv;
  }

  transferOwnership({
    lotId,
    newOwnerActorId,
    executingPersonId,
    actingActorId,
  }: TransferOwnershipParams): void {
    const lot = this._requireActive(lotId);
    this._commit("ownership_transfer", executingPersonId, actingActorId, {
      lotId,
      newOwnerActorId,
      previousOwnerActorId: lot.ownerActorId,
    });
    lot.ownerActorId = newOwnerActorId;
  }

  disaggregate({
    parentLotId,
    childMassesKg,
    executingPersonId,
    actingActorId,
  }: DisaggregateParams): Lot[] {
    const parent = this._requireActive(parentLotId, "INV-05");
    const total = Math.round(childMassesKg.reduce((a, b) => a + b, 0) * 1e6) / 1e6;
    if (total !== Math.round(parent.canonicalMassKg * 1e6) / 1e6) {
      throw new InvariantViolation(
        "INV-07",
        `Disaggregation mass mismatch: children sum to ${total}kg, parent is ${parent.canonicalMassKg}kg.`,
      );
    }
    const ev = this._commit("disaggregate", executingPersonId, actingActorId, {
      parentLotId,
      childMassesKg,
    });
    const children: Lot[] = [];
    for (const mass of childMassesKg) {
      const child: Lot = {
        lotId: newId("lot"),
        commodity: parent.commodity,
        processingState: parent.processingState,
        processingRoute: parent.processingRoute,
        status: "active",
        canonicalMassKg: mass,
        ownerActorId: parent.ownerActorId,
        custodianActorId: parent.custodianActorId,
        locationId: parent.locationId,
        originLocationId: parent.originLocationId || parent.locationId,
        cropYear: parent.cropYear,
        originStatus: parent.originStatus,
        createdEventId: ev.eventId,
        provenance: { ...parent.provenance },
        inactiveEventId: null,
        inTransit: false,
      };
      this.lots.set(child.lotId, child);
      this.lineage.push({
        parentLotId,
        childLotId: child.lotId,
        contributionKg: mass,
        proportion: 1.0,
      });
      children.push(child);
    }
    this._deactivate(parent, ev.eventId);
    return children;
  }

  aggregate({ parentLotIds, executingPersonId, actingActorId }: AggregateParams): Lot {
    if (parentLotIds.length < 2) {
      throw new InvariantViolation("INV-07", "Aggregation requires at least two input lots.");
    }
    const parents = parentLotIds.map((id) => this._requireActive(id));
    const states = new Set(parents.map((p) => p.processingState));
    const routes = new Set(parents.map((p) => p.processingRoute));
    if (states.size > 1 || routes.size > 1) {
      throw new InvariantViolation(
        "INV-07",
        "Aggregation inputs must share processing_state and processing_route.",
      );
    }
    const totalMass = Math.round(parents.reduce((a, p) => a + p.canonicalMassKg, 0) * 1e6) / 1e6;
    const ev = this._commit("aggregate", executingPersonId, actingActorId, {
      parentLotIds,
      totalMassKg: totalMass,
    });
    const provenance: Provenance = {};
    for (const p of parents) {
      const weight = p.canonicalMassKg / totalMass;
      for (const [origin, prop] of Object.entries(p.provenance)) {
        provenance[origin] = (provenance[origin] || 0) + prop * weight;
      }
    }
    const child: Lot = {
      lotId: newId("lot"),
      commodity: parents[0].commodity,
      processingState: parents[0].processingState,
      processingRoute: parents[0].processingRoute,
      status: "active",
      canonicalMassKg: totalMass,
      ownerActorId: parents[0].ownerActorId,
      custodianActorId: parents[0].custodianActorId,
      locationId: parents[0].locationId,
      cropYear: parents[0].cropYear,
      originStatus: parents[0].originStatus,
      createdEventId: ev.eventId,
      provenance,
      inactiveEventId: null,
      inTransit: false,
    };
    this.lots.set(child.lotId, child);
    for (const p of parents) {
      this.lineage.push({
        parentLotId: p.lotId,
        childLotId: child.lotId,
        contributionKg: p.canonicalMassKg,
        proportion: p.canonicalMassKg / totalMass,
      });
      this._deactivate(p, ev.eventId);
    }
    return child;
  }

  process({
    inputLotIds,
    outputState,
    outputMassKg,
    rejectKg,
    lossKg,
    executingPersonId,
    actingActorId,
    lossCategory = null,
  }: ProcessParams): Lot {
    const inputs = inputLotIds.map((id) => this._requireActive(id));
    const totalInput = Math.round(inputs.reduce((a, i) => a + i.canonicalMassKg, 0) * 1e6) / 1e6;
    const totalOutputSide = Math.round((outputMassKg + rejectKg + lossKg) * 1e6) / 1e6;
    if (totalOutputSide !== totalInput) {
      throw new InvariantViolation(
        "INV-07",
        `Mass balance failed: input ${totalInput}kg != output ${outputMassKg} + reject ${rejectKg} + loss ${lossKg} = ${totalOutputSide}kg.`,
      );
    }
    if (lossKg > 0) {
      const eligible = inputs.some((i) => LOSS_ELIGIBLE_STATES.has(i.processingState));
      if (!eligible) {
        throw new InvariantViolation(
          "INV-08",
          "Loss is not eligible for this operation/state; loss cannot be used as a balancing plug.",
        );
      }
    }
    const ev = this._commit("process", executingPersonId, actingActorId, {
      inputLotIds,
      outputState,
      outputMassKg,
      rejectKg,
      lossKg,
      lossCategory,
    });
    const provenance: Provenance = {};
    for (const i of inputs) {
      const weight = i.canonicalMassKg / totalInput;
      for (const [origin, prop] of Object.entries(i.provenance)) {
        provenance[origin] = (provenance[origin] || 0) + prop * weight;
      }
    }
    const outputLot: Lot = {
      lotId: newId("lot"),
      commodity: inputs[0].commodity,
      processingState: outputState,
      processingRoute: inputs[0].processingRoute,
      status: "active",
      canonicalMassKg: outputMassKg,
      ownerActorId: inputs[0].ownerActorId,
      custodianActorId: inputs[0].custodianActorId,
      locationId: inputs[0].locationId,
      cropYear: inputs[0].cropYear,
      originStatus: inputs[0].originStatus,
      createdEventId: ev.eventId,
      provenance,
      inactiveEventId: null,
      inTransit: false,
    };
    this.lots.set(outputLot.lotId, outputLot);
    for (const i of inputs) {
      this.lineage.push({
        parentLotId: i.lotId,
        childLotId: outputLot.lotId,
        contributionKg: i.canonicalMassKg,
        proportion: i.canonicalMassKg / totalInput,
      });
      this._deactivate(i, ev.eventId);
    }
    return outputLot;
  }

  terminalDispose({
    lotId,
    reason,
    executingPersonId,
    actingActorId,
  }: TerminalDisposeParams): void {
    const lot = this._requireActive(lotId);
    const ev = this._commit("terminal_disposition", executingPersonId, actingActorId, {
      lotId,
      reason,
    });
    this._deactivate(lot, ev.eventId);
  }

  correctEvent({
    originalEventId,
    correctedPayload,
    reason,
    executingPersonId,
    actingActorId,
  }: CorrectEventParams): Event {
    const original = this.events.find((e) => e.eventId === originalEventId);
    if (!original) {
      throw new InvariantViolation("INV-02", `Cannot correct unknown event ${originalEventId}.`);
    }
    return this._commit(
      "correction",
      executingPersonId,
      actingActorId,
      { reason, correctedPayload },
      originalEventId,
    );
  }

  currentInventory(actorId: string): Lot[] {
    return [...this.lots.values()].filter(
      (l) => l.status === "active" && l.custodianActorId === actorId,
    );
  }

  traceBackward(lotId: string): string[] {
    const roots: string[] = [];
    const stack = [lotId];
    const seen = new Set<string>();
    while (stack.length) {
      const lid = stack.pop()!;
      if (seen.has(lid)) continue;
      seen.add(lid);
      const parents = this.lineage
        .filter((e) => e.childLotId === lid)
        .map((e) => e.parentLotId);
      if (parents.length === 0) roots.push(lid);
      else stack.push(...parents);
    }
    return roots;
  }

  forwardOneHop(lotId: string): string[] {
    return this.lineage.filter((e) => e.parentLotId === lotId).map((e) => e.childLotId);
  }
}
