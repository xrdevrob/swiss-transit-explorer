import type { Station, Connection, Leg, ReliabilityInsight } from "../types";
import { calculateReliability } from "../insights/reliability";

const BASE_URL = "https://transport.opendata.ch/v1";

export interface Departure {
  line: string;
  destination: string;
  departurePlanned: string;
  departureActual?: string;
  platform?: string;
  delayMinutes?: number;
}

export async function getStationboard(station: string, limit = 10): Promise<{
  station: string;
  departures: Departure[];
  generatedAt: string;
}> {
  const url = new URL(`${BASE_URL}/stationboard`);
  url.searchParams.set("station", station);
  url.searchParams.set("limit", limit.toString());

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "SwissTransitExplorer/1.0", "Accept": "application/json" },
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);

  const data = await response.json();
  
  const departures: Departure[] = (data.stationboard || []).map((entry: {
    stop?: { departure?: string; platform?: string; prognosis?: { departure?: string; platform?: string } };
    name?: string;
    to?: string;
  }) => {
    const planned = entry.stop?.departure || "";
    const actual = entry.stop?.prognosis?.departure;
    let delayMinutes: number | undefined;
    
    if (planned && actual) {
      const diff = (new Date(actual).getTime() - new Date(planned).getTime()) / 60000;
      if (diff > 0) delayMinutes = Math.round(diff);
    }

    return {
      line: entry.name || "",
      destination: entry.to || "",
      departurePlanned: planned,
      departureActual: actual && actual !== planned ? actual : undefined,
      platform: entry.stop?.prognosis?.platform || entry.stop?.platform,
      delayMinutes,
    };
  });

  return {
    station: data.station?.name || station,
    departures,
    generatedAt: new Date().toISOString(),
  };
}

interface TransportLocation {
  id?: string;
  name: string;
  coordinate?: { x: number; y: number };
}

interface TransportCheckpoint {
  station: TransportLocation;
  arrival?: string;
  departure?: string;
  platform?: string;
  prognosis?: {
    arrival?: string;
    departure?: string;
    platform?: string;
  };
}

interface TransportSection {
  journey?: {
    name?: string;
    category?: string;
    number?: string;
    operator?: string;
  };
  walk?: { duration?: number };
  departure: TransportCheckpoint;
  arrival: TransportCheckpoint;
}

interface TransportConnection {
  from: TransportCheckpoint;
  to: TransportCheckpoint;
  duration?: string;
  transfers: number;
  sections: TransportSection[];
}

export async function searchStations(query: string, limit = 8): Promise<Station[]> {
  const url = new URL(`${BASE_URL}/locations`);
  url.searchParams.set("query", query);
  url.searchParams.set("type", "station");

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "SwissTransitExplorer/1.0", "Accept": "application/json" },
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);

  const data = await response.json();
  return data.stations
    .filter((s: TransportLocation) => s.name)
    .slice(0, limit)
    .map((s: TransportLocation) => ({ id: s.id, name: s.name }));
}

export async function findConnections(
  from: string,
  to: string,
  datetime?: string,
  isArrivalTime = false,
  limit = 6
): Promise<{ connections: Connection[]; fromStation?: Station; toStation?: Station }> {
  const url = new URL(`${BASE_URL}/connections`);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("limit", limit.toString());

  if (datetime) {
    const date = new Date(datetime);
    url.searchParams.set("date", date.toISOString().split("T")[0]);
    url.searchParams.set("time", date.toTimeString().slice(0, 5));
    url.searchParams.set("isArrivalTime", isArrivalTime ? "1" : "0");
  }

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "SwissTransitExplorer/1.0", "Accept": "application/json" },
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);

  const data = await response.json();

  let fastestDuration = Infinity;
  let fewestTransfers = Infinity;
  const processed = data.connections.map((conn: TransportConnection, index: number) => {
    const duration = parseDuration(conn.duration);
    if (duration < fastestDuration) fastestDuration = duration;
    if (conn.transfers < fewestTransfers) fewestTransfers = conn.transfers;
    return { conn, duration, index };
  });

  const connections: Connection[] = processed.map(({ conn, duration, index }: { conn: TransportConnection; duration: number; index: number }) => {
    const legs = normalizeLegs(conn.sections);
    const tags: string[] = [];
    if (duration === fastestDuration) tags.push("fastest");
    if (conn.transfers === fewestTransfers) tags.push("fewest transfers");
    if (index === 0) tags.push("recommended");

    const reliability = calculateReliability(legs, conn.from.departure || new Date().toISOString());

    return {
      id: generateConnectionId(conn),
      departureTime: conn.from.departure || "",
      arrivalTime: conn.to.arrival || "",
      durationMinutes: duration,
      transfersCount: conn.transfers,
      legs,
      reliabilityScore: reliability.score,
      reliability,
      tags,
    };
  });

  let fromStation: Station | undefined;
  let toStation: Station | undefined;
  if (data.connections.length > 0) {
    fromStation = { name: data.connections[0].from.station.name };
    toStation = { name: data.connections[0].to.station.name };
  }

  return { connections, fromStation, toStation };
}

function parseDuration(duration?: string): number {
  if (!duration) return 0;
  const match = duration.match(/(?:(\d+)d)?(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1] || "0") * 24 * 60 + parseInt(match[2]) * 60 + parseInt(match[3]);
}

function normalizeLegs(sections: TransportSection[]): Leg[] {
  return sections.map((section): Leg => {
    const isWalk = !!section.walk;
    const departure = section.departure;
    const arrival = section.arrival;

    let delayMinutes: number | undefined;
    if (departure.prognosis?.departure && departure.departure) {
      const planned = new Date(departure.departure).getTime();
      const actual = new Date(departure.prognosis.departure).getTime();
      delayMinutes = Math.round((actual - planned) / 60000);
    }

    const fromPlatform = departure.prognosis?.platform || departure.platform;
    const toPlatform = arrival.prognosis?.platform || arrival.platform;
    const fromActual = departure.prognosis?.departure;
    const toActual = arrival.prognosis?.arrival;

    const leg: Leg = {
      type: isWalk ? "walk" : "ride",
      from: {
        name: departure.station.name,
        timePlanned: departure.departure || "",
        ...(fromActual && fromActual !== departure.departure && { timeActual: fromActual }),
        ...(fromPlatform && { platform: fromPlatform }),
      },
      to: {
        name: arrival.station.name,
        timePlanned: arrival.arrival || "",
        ...(toActual && toActual !== arrival.arrival && { timeActual: toActual }),
        ...(toPlatform && { platform: toPlatform }),
      },
    };

    if (!isWalk && section.journey) {
      leg.line = section.journey.name || section.journey.category;
    }
    if (delayMinutes && delayMinutes > 0) {
      leg.delayMinutes = delayMinutes;
    }

    return leg;
  });
}

function generateConnectionId(conn: TransportConnection): string {
  const lines = conn.sections.filter((s) => s.journey).map((s) => s.journey?.name).join("-");
  return `${conn.from.departure || ""}-${lines}`.replace(/[^a-zA-Z0-9-]/g, "_");
}

interface DelayedRoute {
  route: string;
  line: string;
  scheduledDeparture: string;
  delayMinutes: number;
}

export async function checkDisruptions(stationName: string): Promise<{
  station: string;
  checkedAt: string;
  routesChecked: string[];
  totalConnectionsChecked: number;
  delayedConnectionsCount: number;
  cancelledOrMissing: number;
  averageDelayMinutes: number;
  maxDelayMinutes: number;
  delayedRoutes: DelayedRoute[];
  status: "normal" | "minor_delays" | "major_delays" | "disrupted";
  summary: string;
}> {
  const majorHubs = ["Zürich HB", "Bern", "Basel SBB", "Genève", "Lausanne", "Luzern", "Winterthur", "St. Gallen"]
    .filter(hub => !stationName.toLowerCase().includes(hub.toLowerCase().split(" ")[0]));

  const delays: number[] = [];
  const delayedRoutes: DelayedRoute[] = [];
  let cancelledOrMissing = 0;
  let totalChecked = 0;

  const hubsToCheck = majorHubs.sort(() => Math.random() - 0.5).slice(0, 4);

  for (const hub of hubsToCheck) {
    try {
      const result = await findConnections(stationName, hub, new Date().toISOString(), false, 2);
      totalChecked += result.connections.length;

      for (const conn of result.connections) {
        for (const leg of conn.legs) {
          if (leg.delayMinutes && leg.delayMinutes > 0) {
            delays.push(leg.delayMinutes);
            delayedRoutes.push({
              route: `${leg.from.name} → ${leg.to.name}`,
              line: leg.line || "walk",
              scheduledDeparture: leg.from.timePlanned,
              delayMinutes: leg.delayMinutes,
            });
          }
        }
      }
      if (result.connections.length === 0) cancelledOrMissing++;
    } catch {
      cancelledOrMissing++;
    }
  }

  const delayedConnectionsCount = delayedRoutes.length;
  const averageDelay = delays.length > 0 ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 0;
  const maxDelay = delays.length > 0 ? Math.max(...delays) : 0;

  let status: "normal" | "minor_delays" | "major_delays" | "disrupted";
  if (cancelledOrMissing >= 2 || maxDelay > 30) status = "disrupted";
  else if (maxDelay > 15 || delayedConnectionsCount > totalChecked * 0.5) status = "major_delays";
  else if (maxDelay > 5 || delayedConnectionsCount > 0) status = "minor_delays";
  else status = "normal";

  const summaries = {
    disrupted: `⚠️ Significant disruptions around ${stationName}. ${delayedConnectionsCount} delayed, max ${maxDelay}min.`,
    major_delays: `🟠 Major delays around ${stationName}. Average ${averageDelay}min.`,
    minor_delays: `🟡 Minor delays around ${stationName}. ${delayedConnectionsCount} delayed, avg ${averageDelay}min.`,
    normal: `✅ Service normal around ${stationName}.`,
  };

  return {
    station: stationName,
    checkedAt: new Date().toISOString(),
    routesChecked: hubsToCheck.map(h => `${stationName} → ${h}`),
    totalConnectionsChecked: totalChecked,
    delayedConnectionsCount,
    cancelledOrMissing,
    averageDelayMinutes: averageDelay,
    maxDelayMinutes: maxDelay,
    delayedRoutes,
    status,
    summary: summaries[status],
  };
}
