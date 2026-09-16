import { Ledger } from "./engine";
import type { Actor, Lot, ProcessingRoute } from "./types";

export type SiteRoute = "washed" | "natural" | "mixed";

export interface AkrabiSite {
  place: string;
  zone: string;
  woreda: string;
  region: string;
  lat: number;
  lng: number;
  route: SiteRoute;
}

/** Compact demo sites — three rich chains for role pick / dashboards. */
export const AKRABI_SITES: AkrabiSite[] = [
  { place: "Yirgacheffe", zone: "Gedeo", woreda: "Yirgacheffe", region: "South Ethiopia", lat: 6.17, lng: 38.21, route: "washed" },
  { place: "Bensa", zone: "Sidama", woreda: "Bensa", region: "Sidama", lat: 6.7, lng: 38.55, route: "natural" },
  { place: "Yirgalem", zone: "Sidama", woreda: "Dale", region: "Sidama", lat: 6.75, lng: 38.417, route: "mixed" },
];

export const GIVEN_SOUTH_M = [
  "Abebe", "Tesfaye", "Desta", "Alemayehu", "Girma", "Bekele", "Tadesse", "Mulugeta", "Haile", "Kebede",
  "Dawit", "Solomon", "Yohannes", "Getachew", "Mesfin", "Zerihun", "Asrat", "Tamrat", "Fikru", "Wondimu",
];
export const GIVEN_SOUTH_F = [
  "Tigist", "Alemitu", "Zewditu", "Yeshi", "Genet", "Selamawit", "Meseret", "Hirut", "Almaz", "Aster",
  "Bezawit", "Hana", "Meron", "Rahel", "Sara", "Tsehay", "Frehiwot", "Kidist",
];
export const GIVEN_GUJI_M = [
  "Guyo", "Boru", "Wario", "Galgalo", "Halake", "Jilo", "Dida", "Roba", "Gemechu", "Tolera",
  "Diriba", "Kebena", "Liban", "Molu", "Sora",
];
export const GIVEN_GUJI_F = [
  "Ayantu", "Buke", "Dhugo", "Shano", "Galme", "Bontu", "Caaltu", "Dane", "Fatuma", "Halima",
];

export function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

export function generateFarmerName(site: AkrabiSite, i: number): string {
  const isGuji = site.region === "Oromia";
  const male = i % 2 === 0;
  const given = isGuji
    ? pick(male ? GIVEN_GUJI_M : GIVEN_GUJI_F, i)
    : pick(male ? GIVEN_SOUTH_M : GIVEN_SOUTH_F, i);
  const father = isGuji ? pick(GIVEN_GUJI_M, i + 5) : pick(GIVEN_SOUTH_M, i + 5);
  return `${given} ${father}`;
}

function moveReceive(
  ledger: Ledger,
  lotId: string,
  fromId: string,
  toId: string,
  sendKg: number,
  recvKg: number,
  dest: string,
): void {
  const mid = ledger.movementSend({
    lotId,
    fromActorId: fromId,
    toActorId: toId,
    senderDeclaredKg: sendKg,
    executingPersonId: fromId,
    destinationLocationId: dest,
  });
  ledger.movementReceive({
    movementId: mid,
    receiverDeclaredKg: recvKg,
    executingPersonId: toId,
  });
}

export interface SeededNetwork {
  exporter: Actor;
  akrabis: Array<{ akrabi: Actor; site: AkrabiSite }>;
  stations: Array<{ station: Actor; site: AkrabiSite; isMill: boolean }>;
  allFarmers: Actor[];
  deliveries: Array<{
    akrabi: Actor;
    station: Actor;
    finalLot: Lot;
    route: ProcessingRoute;
    cherryIn: number;
  }>;
}

export function seedNetwork(ledger: Ledger): SeededNetwork {
  const exporter = ledger.onboardActor("exporter", "Sidama Gold Export PLC", "REG-EXP-2201", null, {
    address: "Bole Sub-City, Addis Ababa",
    exportLicense: "ETH-EXP-88231",
    nbeRegistration: "NBE-FX-4471",
    contactPerson: "Meron Assefa",
    contactPhone: "+251 91 122 3344",
  });

  let farmerSeq = 0;
  const akrabis: SeededNetwork["akrabis"] = [];
  const stations: SeededNetwork["stations"] = [];
  const allFarmers: Actor[] = [];
  const deliveries: SeededNetwork["deliveries"] = [];

  AKRABI_SITES.forEach((site, si) => {
    const akrabiName =
      si % 2 === 0
        ? `${site.place} Farmers Cooperative Union`
        : `${site.place} Coffee Trading PLC`;
    const akrabi = ledger.onboardActor("akrabi", akrabiName, `REG-AK-${1000 + si}`, exporter.actorId, {
      region: site.region,
      zone: site.zone,
      woreda: site.woreda,
      registrationNo: `AK-${1000 + si}`,
      license: `LIC-${3000 + si}`,
      warehouseLocation: `${site.place} town, ${site.woreda}`,
      yearsOperating: String(3 + (si % 9)),
      lat: site.lat,
      lng: site.lng,
    });
    akrabis.push({ akrabi, site });

    const isMill = site.route === "natural";
    const stationType = isMill ? "mill" : "washing_station";
    const stationName = isMill ? `${site.place} Hulling Mill` : `${site.place} Washing Station`;
    const stationLat = site.lat + (si % 2 === 0 ? 0.02 : -0.015);
    const stationLng = site.lng + (si % 2 === 0 ? -0.015 : 0.02);
    const station = ledger.onboardActor(
      stationType,
      stationName,
      `REG-${isMill ? "MILL" : "WS"}-${4000 + si}`,
      akrabi.actorId,
      {
        region: site.region,
        zone: site.zone,
        woreda: site.woreda,
        kebele: `${site.place} Kebele 01`,
        registrationNo: `${isMill ? "MILL" : "WS"}-${4000 + si}`,
        capacityKgPerDay: String(2000 + (si % 5) * 500),
        operator: generateFarmerName(site, si + 20),
        lat: stationLat,
        lng: stationLng,
      },
    );
    stations.push({ station, site, isMill });

    // Three farmers per aggregator — first is the selectable demo farmer (keeps inventory).
    const farmerCount = 3;
    const farmers: Actor[] = [];
    for (let f = 0; f < farmerCount; f++) {
      farmerSeq++;
      const farmerLat = site.lat + Math.sin(farmerSeq * 12.9) * 0.03;
      const farmerLng = site.lng + Math.cos(farmerSeq * 7.3) * 0.03;
      const farmer = ledger.onboardActor(
        "farmer",
        generateFarmerName(site, f + si * 3),
        `FAYDA-${String(2000 + farmerSeq).padStart(6, "0")}`,
        akrabi.actorId,
        {
          region: site.region,
          zone: site.zone,
          woreda: site.woreda,
          kebele: `${site.place} Kebele 0${1 + (f % 4)}`,
          phone: `+251 9${(10000000 + farmerSeq * 37) % 90000000}`.slice(0, 13),
          farmSizeHa: (0.5 + (f % 4) * 0.5).toFixed(1),
          variety:
            site.route === "natural" ? "Heirloom (local landrace)" : "Heirloom · Kurume/Dega",
          yearsFarming: String(5 + ((f * 3 + si) % 30)),
          lat: farmerLat,
          lng: farmerLng,
          demoSelectable: f === 0 ? "true" : "false",
        },
      );
      farmers.push(farmer);
      allFarmers.push(farmer);
    }

    // Tag aggregator for role pick (all three sites are demo-selectable).
    akrabi.metadata.demoSelectable = "true";

    // One complete historical cycle (closed at FOB) + one open cycle that leaves
    // green with the exporter and cherry with the akrabi / demo farmer.
    const cycleCount = 2;
    for (let c = 0; c < cycleCount; c++) {
      const useFarmers = farmers.slice(0, 2 + (c % 2)); // 2–3 farmers per cycle

      const route: ProcessingRoute =
        site.route === "mixed"
          ? c % 2 === 0
            ? "washed"
            : "natural"
          : site.route === "natural"
            ? "natural"
            : "washed";

      const origins = useFarmers.map((farmer, k) => {
        const kg = 220 + ((si * 7 + c * 13 + k * 29) % 280);
        const lot = ledger.createOriginLot({
          farmerActorId: farmer.actorId,
          recordedByActorId: farmer.actorId,
          executingPersonId: farmer.actorId,
          massKg: kg,
          processingState: "cherry",
          processingRoute: route,
          locationId: `${site.place}, ${site.woreda}`,
          cropYear: "2025-2026",
        });
        const recvKg = (c + k) % 5 === 0 ? kg - 3 : kg;
        moveReceive(
          ledger,
          lot.lotId,
          farmer.actorId,
          akrabi.actorId,
          kg,
          recvKg,
          `${akrabiName} store, ${site.place}`,
        );
        return lot;
      });

      const cherryIn = origins.reduce((s, l) => s + l.canonicalMassKg, 0);
      const combined =
        origins.length > 1
          ? ledger.aggregate({
              parentLotIds: origins.map((l) => l.lotId),
              executingPersonId: akrabi.actorId,
              actingActorId: akrabi.actorId,
            })
          : origins[0];

      // Open cycle: leave aggregated cherry with akrabi (demo inventory).
      if (c === cycleCount - 1) {
        deliveries.push({ akrabi, station, finalLot: combined, route, cherryIn });
        continue;
      }

      moveReceive(
        ledger,
        combined.lotId,
        akrabi.actorId,
        station.actorId,
        cherryIn,
        cherryIn,
        `${stationName}, ${site.place}`,
      );

      let finalLot: Lot;
      if (route === "washed") {
        const parchOut = Math.round(cherryIn * 0.55);
        const parchReject = Math.round(cherryIn * 0.05);
        const parchLoss = cherryIn - parchOut - parchReject;
        const parchment = ledger.process({
          inputLotIds: [combined.lotId],
          outputState: "dry_parchment",
          outputMassKg: parchOut,
          rejectKg: parchReject,
          lossKg: parchLoss,
          executingPersonId: station.actorId,
          actingActorId: station.actorId,
          lossCategory: "moisture",
        });
        const greenOut = Math.round((parchOut * 500) / 550);
        const greenReject = parchOut - greenOut;
        finalLot = ledger.process({
          inputLotIds: [parchment.lotId],
          outputState: "green_washed",
          outputMassKg: greenOut,
          rejectKg: greenReject,
          lossKg: 0,
          executingPersonId: station.actorId,
          actingActorId: station.actorId,
        });
      } else {
        const driedOut = Math.round(cherryIn * 0.4);
        const driedReject = Math.round(cherryIn * 0.03);
        const driedLoss = cherryIn - driedOut - driedReject;
        const dried = ledger.process({
          inputLotIds: [combined.lotId],
          outputState: "dried_cherry",
          outputMassKg: driedOut,
          rejectKg: driedReject,
          lossKg: driedLoss,
          executingPersonId: station.actorId,
          actingActorId: station.actorId,
          lossCategory: "sun-drying moisture loss",
        });
        const greenOut = Math.round(driedOut * 0.85);
        const greenReject = driedOut - greenOut;
        finalLot = ledger.process({
          inputLotIds: [dried.lotId],
          outputState: "green_natural",
          outputMassKg: greenOut,
          rejectKg: greenReject,
          lossKg: 0,
          executingPersonId: station.actorId,
          actingActorId: station.actorId,
        });
      }

      ledger.transferOwnership({
        lotId: finalLot.lotId,
        newOwnerActorId: exporter.actorId,
        executingPersonId: station.actorId,
        actingActorId: station.actorId,
      });
      moveReceive(
        ledger,
        finalLot.lotId,
        station.actorId,
        exporter.actorId,
        finalLot.canonicalMassKg,
        finalLot.canonicalMassKg,
        `${exporter.displayName} central warehouse, Addis Ababa`,
      );

      // Historical cycle closed at FOB
      ledger.terminalDispose({
        lotId: finalLot.lotId,
        reason: "fob_export",
        executingPersonId: exporter.actorId,
        actingActorId: exporter.actorId,
      });
      deliveries.push({ akrabi, station, finalLot, route, cherryIn });
    }

    // Demo farmer keeps fresh cherry in custody for workspace demo.
    const demoFarmer = farmers[0];
    ledger.createOriginLot({
      farmerActorId: demoFarmer.actorId,
      recordedByActorId: demoFarmer.actorId,
      executingPersonId: demoFarmer.actorId,
      massKg: 310 + si * 40,
      processingState: "cherry",
      processingRoute: site.route === "natural" ? "natural" : "washed",
      locationId: `${site.place}, ${site.woreda}`,
      cropYear: "2025-2026",
    });
  });

  // Leave one green lot with the exporter (from a short open export receive).
  // Rebuild a small washed lot path for exporter inventory using first site's station.
  {
    const { akrabi, site } = akrabis[0];
    const station = stations[0].station;
    const farmer = allFarmers[0];
    const kg = 400;
    const origin = ledger.createOriginLot({
      farmerActorId: farmer.actorId,
      recordedByActorId: farmer.actorId,
      executingPersonId: farmer.actorId,
      massKg: kg,
      processingState: "cherry",
      processingRoute: "washed",
      locationId: `${site.place}, ${site.woreda}`,
      cropYear: "2025-2026",
    });
    moveReceive(
      ledger,
      origin.lotId,
      farmer.actorId,
      akrabi.actorId,
      kg,
      kg,
      `${akrabi.displayName} store, ${site.place}`,
    );
    moveReceive(
      ledger,
      origin.lotId,
      akrabi.actorId,
      station.actorId,
      kg,
      kg,
      `${station.displayName}, ${site.place}`,
    );
    const parchOut = Math.round(kg * 0.55);
    const parchReject = Math.round(kg * 0.05);
    const parchLoss = kg - parchOut - parchReject;
    const parchment = ledger.process({
      inputLotIds: [origin.lotId],
      outputState: "dry_parchment",
      outputMassKg: parchOut,
      rejectKg: parchReject,
      lossKg: parchLoss,
      executingPersonId: station.actorId,
      actingActorId: station.actorId,
      lossCategory: "moisture",
    });
    const greenOut = Math.round((parchOut * 500) / 550);
    const greenReject = parchOut - greenOut;
    const green = ledger.process({
      inputLotIds: [parchment.lotId],
      outputState: "green_washed",
      outputMassKg: greenOut,
      rejectKg: greenReject,
      lossKg: 0,
      executingPersonId: station.actorId,
      actingActorId: station.actorId,
    });
    ledger.transferOwnership({
      lotId: green.lotId,
      newOwnerActorId: exporter.actorId,
      executingPersonId: station.actorId,
      actingActorId: station.actorId,
    });
    moveReceive(
      ledger,
      green.lotId,
      station.actorId,
      exporter.actorId,
      green.canonicalMassKg,
      green.canonicalMassKg,
      `${exporter.displayName} central warehouse, Addis Ababa`,
    );
    deliveries.push({
      akrabi,
      station,
      finalLot: green,
      route: "washed",
      cherryIn: kg,
    });
  }

  return { exporter, akrabis, stations, allFarmers, deliveries };
}

export interface LotCodeHelpers {
  lotCodes: Map<string, string>;
  lotCode: (lotId: string) => string;
  assignCodes: () => void;
}

export interface BootstrapResult extends LotCodeHelpers {
  ledger: Ledger;
  actingActorId: string;
  preferredTraceLotId: string | null;
  seeded: SeededNetwork;
}

export function createLotCodeHelpers(ledger: Ledger): LotCodeHelpers {
  const lotCodes = new Map<string, string>();
  let nextLotSeq = 1;

  function lotCode(lotId: string): string {
    if (!lotCodes.has(lotId)) {
      lotCodes.set(lotId, `L-${String(nextLotSeq).padStart(3, "0")}`);
      nextLotSeq++;
    }
    return lotCodes.get(lotId)!;
  }

  function assignCodes(): void {
    for (const lot of ledger.lots.values()) lotCode(lot.lotId);
  }

  return { lotCodes, lotCode, assignCodes };
}

export function bootstrap(): BootstrapResult {
  const ledger = new Ledger();
  const helpers = createLotCodeHelpers(ledger);
  const seeded = seedNetwork(ledger);
  const actingActorId = seeded.exporter.actorId;
  const preferredTraceLotId = seeded.deliveries.length
    ? seeded.deliveries[seeded.deliveries.length - 1].finalLot.lotId
    : null;
  helpers.assignCodes();
  return {
    ledger,
    actingActorId,
    preferredTraceLotId,
    seeded,
    ...helpers,
  };
}
