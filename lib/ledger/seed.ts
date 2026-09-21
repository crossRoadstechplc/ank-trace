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

/** Full exporter network — many aggregators; first three stay demo-selectable for role pick. */
export const AKRABI_SITES: AkrabiSite[] = [
  { place: "Yirgacheffe", zone: "Gedeo", woreda: "Yirgacheffe", region: "South Ethiopia", lat: 6.17, lng: 38.21, route: "washed" },
  { place: "Bensa", zone: "Sidama", woreda: "Bensa", region: "Sidama", lat: 6.7, lng: 38.55, route: "natural" },
  { place: "Yirgalem", zone: "Sidama", woreda: "Dale", region: "Sidama", lat: 6.75, lng: 38.417, route: "mixed" },
  { place: "Kochere", zone: "Gedeo", woreda: "Kochere", region: "South Ethiopia", lat: 5.95, lng: 38.25, route: "washed" },
  { place: "Hambela", zone: "Guji", woreda: "Hambela Wamena", region: "Oromia", lat: 5.78, lng: 38.82, route: "natural" },
  { place: "Aleta Wondo", zone: "Sidama", woreda: "Aleta Wondo", region: "Sidama", lat: 6.58, lng: 38.42, route: "washed" },
  { place: "Dilla", zone: "Gedeo", woreda: "Dilla Zuria", region: "South Ethiopia", lat: 6.41, lng: 38.31, route: "mixed" },
  { place: "Shakiso", zone: "Guji", woreda: "Shakiso", region: "Oromia", lat: 5.77, lng: 38.91, route: "natural" },
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
  collectors: Array<{ collector: Actor; akrabi: Actor; site: AkrabiSite }>;
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
  // Single rich exporter — display name is overwritten at runtime with the logged-in user.
  const exporter = ledger.onboardActor("exporter", "Exporter", "REG-EXP-2201", null, {
    address: "Bole Sub-City, Woreda 03, Addis Ababa",
    exportLicense: "ETH-EXP-88231",
    nbeRegistration: "NBE-FX-4471",
    contactPerson: "",
    contactPhone: "+251 91 122 3344",
    companyName: "Sidama Gold Export PLC",
    warehouse: "Central warehouse, Bole, Addis Ababa",
    yearsOperating: "12",
    primaryDestinations: "Germany, Japan, USA, South Korea",
    annualVolumeBags: "48,000",
    certifications: "Organic, Fairtrade, Rainforest Alliance",
    bank: "Commercial Bank of Ethiopia, FX desk",
    tin: "0001234567",
    demoSelectable: "true",
  });

  let farmerSeq = 0;
  let collectorSeq = 0;
  const akrabis: SeededNetwork["akrabis"] = [];
  const collectors: SeededNetwork["collectors"] = [];
  const stations: SeededNetwork["stations"] = [];
  const allFarmers: Actor[] = [];
  const deliveries: SeededNetwork["deliveries"] = [];
  /** Green lots held by exporter, keyed for multi-aggregator export blends. */
  const exporterGreensByRoute: Record<"washed" | "natural", Lot[]> = {
    washed: [],
    natural: [],
  };

  function processToGreen(
    combined: Lot,
    cherryIn: number,
    route: ProcessingRoute,
    station: Actor,
  ): Lot {
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
      return ledger.process({
        inputLotIds: [parchment.lotId],
        outputState: "green_washed",
        outputMassKg: greenOut,
        rejectKg: parchOut - greenOut,
        lossKg: 0,
        executingPersonId: station.actorId,
        actingActorId: station.actorId,
      });
    }
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
    return ledger.process({
      inputLotIds: [dried.lotId],
      outputState: "green_natural",
      outputMassKg: greenOut,
      rejectKg: driedOut - greenOut,
      lossKg: 0,
      executingPersonId: station.actorId,
      actingActorId: station.actorId,
    });
  }

  function shipGreenToExporter(finalLot: Lot, station: Actor): void {
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
      `${exporter.metadata.companyName || exporter.displayName} central warehouse, Addis Ababa`,
    );
  }

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

    // One collector per aggregator site; first three are demo-selectable.
    collectorSeq++;
    const collector = ledger.onboardActor(
      "collector",
      `${site.place} Collector ${collectorSeq}`,
      `REG-COL-${1000 + collectorSeq}`,
      akrabi.actorId,
      {
        region: site.region,
        zone: site.zone,
        woreda: site.woreda,
        kebele: `${site.place} Kebele 02`,
        phone: `+251 9${(20000000 + collectorSeq * 41) % 90000000}`.slice(0, 13),
        coverageArea: `${site.woreda} kebeles`,
        yearsCollecting: String(2 + (si % 8)),
        demoSelectable: si < 3 ? "true" : "false",
      },
    );
    collectors.push({ collector, akrabi, site });

    // Farmers sponsored by the collector (not the aggregator).
    const farmerCount = 6;
    const farmers: Actor[] = [];
    for (let f = 0; f < farmerCount; f++) {
      farmerSeq++;
      const farmerLat = site.lat + Math.sin(farmerSeq * 12.9) * 0.03;
      const farmerLng = site.lng + Math.cos(farmerSeq * 7.3) * 0.03;
      const farmer = ledger.onboardActor(
        "farmer",
        generateFarmerName(site, f + si * 7),
        `FAYDA-${String(2000 + farmerSeq).padStart(6, "0")}`,
        collector.actorId,
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
          demoSelectable: si < 3 && f === 0 ? "true" : "false",
        },
      );
      farmers.push(farmer);
      allFarmers.push(farmer);
    }

    // Role pick still offers three aggregators; the rest feed the exporter network only.
    akrabi.metadata.demoSelectable = si < 3 ? "true" : "false";

    function deliverFarmerToAkrabi(
      farmer: Actor,
      lotId: string,
      kg: number,
      recvKg: number,
    ): void {
      moveReceive(
        ledger,
        lotId,
        farmer.actorId,
        collector.actorId,
        kg,
        recvKg,
        `${collector.displayName} collection point, ${site.place}`,
      );
      moveReceive(
        ledger,
        lotId,
        collector.actorId,
        akrabi.actorId,
        recvKg,
        recvKg,
        `${akrabiName} store, ${site.place}`,
      );
    }

    // Historical FOB cycle: all farms → collector → aggregator → green → FOB.
    {
      const route: ProcessingRoute =
        site.route === "mixed"
          ? "washed"
          : site.route === "natural"
            ? "natural"
            : "washed";
      const origins = farmers.map((farmer, k) => {
        const kg = 180 + ((si * 11 + k * 23) % 220);
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
        const recvKg = k % 5 === 0 ? kg - 2 : kg;
        deliverFarmerToAkrabi(farmer, lot.lotId, kg, recvKg);
        return lot;
      });
      const cherryIn = origins.reduce((s, l) => s + l.canonicalMassKg, 0);
      const combined = ledger.aggregate({
        parentLotIds: origins.map((l) => l.lotId),
        executingPersonId: akrabi.actorId,
        actingActorId: akrabi.actorId,
      });
      moveReceive(
        ledger,
        combined.lotId,
        akrabi.actorId,
        station.actorId,
        cherryIn,
        cherryIn,
        `${stationName}, ${site.place}`,
      );
      const finalLot = processToGreen(combined, cherryIn, route, station);
      shipGreenToExporter(finalLot, station);
      ledger.terminalDispose({
        lotId: finalLot.lotId,
        reason: "fob_export",
        executingPersonId: exporter.actorId,
        actingActorId: exporter.actorId,
      });
      deliveries.push({ akrabi, station, finalLot, route, cherryIn });
    }

    // Open cycle: leave aggregated cherry with collector (demo inventory).
    {
      const route: ProcessingRoute =
        site.route === "natural" ? "natural" : "washed";
      const useFarmers = farmers.slice(0, 4);
      const origins = useFarmers.map((farmer, k) => {
        const kg = 200 + ((si * 9 + k * 17) % 160);
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
        moveReceive(
          ledger,
          lot.lotId,
          farmer.actorId,
          collector.actorId,
          kg,
          kg,
          `${collector.displayName} collection point, ${site.place}`,
        );
        return lot;
      });
      const cherryIn = origins.reduce((s, l) => s + l.canonicalMassKg, 0);
      const combined = ledger.aggregate({
        parentLotIds: origins.map((l) => l.lotId),
        executingPersonId: collector.actorId,
        actingActorId: collector.actorId,
      });
      deliveries.push({ akrabi, station, finalLot: combined, route, cherryIn });
    }

    // Active multi-farm green contribution for the exporter blend (not yet FOB).
    {
      const route: ProcessingRoute =
        site.route === "natural" ? "natural" : "washed";
      const origins = farmers.map((farmer, k) => {
        const kg = 240 + ((si * 13 + k * 19) % 200);
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
        deliverFarmerToAkrabi(farmer, lot.lotId, kg, kg);
        return lot;
      });
      const cherryIn = origins.reduce((s, l) => s + l.canonicalMassKg, 0);
      const combined = ledger.aggregate({
        parentLotIds: origins.map((l) => l.lotId),
        executingPersonId: akrabi.actorId,
        actingActorId: akrabi.actorId,
      });
      moveReceive(
        ledger,
        combined.lotId,
        akrabi.actorId,
        station.actorId,
        cherryIn,
        cherryIn,
        `${stationName}, ${site.place}`,
      );
      const green = processToGreen(combined, cherryIn, route, station);
      shipGreenToExporter(green, station);
      exporterGreensByRoute[route].push(green);
      deliveries.push({ akrabi, station, finalLot: green, route, cherryIn });
    }

    // Demo farmer keeps fresh cherry in custody for workspace demo.
    if (si < 3) {
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
    }
  });

  // Exporter blends greens across aggregators → one lineage root spanning many farms.
  const blendLots: Lot[] = [];
  (["washed", "natural"] as const).forEach((route) => {
    const greens = exporterGreensByRoute[route];
    if (greens.length < 2) return;
    const blend = ledger.aggregate({
      parentLotIds: greens.map((g) => g.lotId),
      executingPersonId: exporter.actorId,
      actingActorId: exporter.actorId,
    });
    blendLots.push(blend);
    deliveries.push({
      akrabi: akrabis[0].akrabi,
      station: stations[0].station,
      finalLot: blend,
      route,
      cherryIn: greens.reduce((s, g) => s + g.canonicalMassKg, 0),
    });
  });

  // Prefer the washed multi-aggregator blend for lineage trace (most farms).
  if (blendLots.length) {
    const preferred = blendLots.find((l) => l.processingRoute === "washed") ?? blendLots[0];
    const idx = deliveries.findIndex((d) => d.finalLot.lotId === preferred.lotId);
    if (idx >= 0) {
      const [row] = deliveries.splice(idx, 1);
      deliveries.push(row);
    }
  }

  return { exporter, akrabis, collectors, stations, allFarmers, deliveries };
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
