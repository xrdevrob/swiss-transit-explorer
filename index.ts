import { MCPServer, widget, text, object } from "mcp-use/server";
import { z } from "zod";
import { searchStations, findConnections, checkDisruptions } from "./src/api/transport";

const server = new MCPServer({
  name: "swiss-transit-explorer",
  version: "1.0.0",
  description: "Swiss public transit explorer - find connections, compare routes, check delays",
  baseUrl: process.env.MCP_URL || "http://localhost:3000",
});

// Tool: search_stations
server.tool(
  {
    name: "search_stations",
    description: "Search for Swiss transit stations by name. Use for autocomplete and validation.",
    schema: z.object({
      query: z.string().describe("Station name (e.g., 'Zurich', 'Bern HB')"),
      limit: z.number().optional().default(8),
    }),
  },
  async ({ query, limit }) => {
    try {
      const stations = await searchStations(query, limit);
      if (stations.length === 0) {
        return text(`No stations found matching "${query}".`);
      }
      return object({
        summary: `Found ${stations.length} station${stations.length !== 1 ? "s" : ""} matching "${query}"`,
        stations,
      });
    } catch (error) {
      return text(`Failed to search stations: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// Tool: find_connections
server.tool(
  {
    name: "find_connections",
    description: "Find Swiss train connections. Use isArrivalTime=true when user needs to 'arrive by' a time.",
    schema: z.object({
      from: z.string().describe("Departure station"),
      to: z.string().describe("Destination station"),
      datetime: z.string().optional().describe("Time: '15:00', '3pm', or ISO. Empty = now"),
      isArrivalTime: z.boolean().optional().default(false).describe("TRUE = arrive by datetime, FALSE = depart at datetime"),
      limit: z.number().optional().default(3),
    }),
    widget: {
      name: "transit-route-explorer",
      invoking: "Finding Swiss transit connections...",
      invoked: "Found connections",
    },
  },
  async ({ from, to, datetime, isArrivalTime, limit }) => {
    try {
      const requestTime = parseDateTime(datetime);
      const result = await findConnections(from, to, requestTime, isArrivalTime, limit);

      if (result.connections.length === 0) {
        return text(`No connections found from "${from}" to "${to}".`);
      }

      const fastest = result.connections.reduce((a, b) => a.durationMinutes < b.durationMinutes ? a : b);
      const recommended = result.connections.find((c) => c.tags.includes("recommended")) || fastest;
      const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });

      const summary = `Found ${result.connections.length} connections from ${result.fromStation?.name || from} to ${result.toStation?.name || to}. ` +
        `Best: depart ${formatTime(recommended.departureTime)}, arrive ${formatTime(recommended.arrivalTime)} ` +
        `(${recommended.durationMinutes} min, ${recommended.transfersCount === 0 ? "direct" : recommended.transfersCount + " transfer(s)"}).`;

      return widget({
        props: {
          query: { from, to, datetimeISO: requestTime },
          stationsResolved: { fromStation: result.fromStation, toStation: result.toStation },
          connections: result.connections,
          generatedAtISO: new Date().toISOString(),
        },
        output: text(summary),
      });
    } catch (error) {
      return text(`Failed to find connections: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// Tool: find_connections_arrive_by
server.tool(
  {
    name: "find_connections_arrive_by",
    description: "Find connections when user says 'arrive by', 'be there by', 'need to be there by' a time.",
    schema: z.object({
      from: z.string().describe("Departure station"),
      to: z.string().describe("Destination station"),
      arriveBy: z.string().describe("Arrival deadline (e.g. '15:00' for 3pm)"),
    }),
    widget: {
      name: "transit-route-explorer",
      invoking: "Finding connections arriving by your deadline...",
      invoked: "Found connections",
    },
  },
  async ({ from, to, arriveBy }) => {
    try {
      const requestTime = parseDateTime(arriveBy);
      const result = await findConnections(from, to, requestTime, true, 3);

      if (result.connections.length === 0) {
        return text(`No connections found arriving in ${to} by ${arriveBy}.`);
      }

      const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
      const latest = result.connections[result.connections.length - 1];
      const summary = `Found ${result.connections.length} options arriving by ${arriveBy}. Latest departure: ${formatTime(latest.departureTime)} → arrive ${formatTime(latest.arrivalTime)}.`;

      return widget({
        props: {
          query: { from, to, datetimeISO: requestTime },
          stationsResolved: { fromStation: result.fromStation, toStation: result.toStation },
          connections: result.connections,
          generatedAtISO: new Date().toISOString(),
        },
        output: text(summary),
      });
    } catch (error) {
      return text(`Failed to find connections: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// Tool: get_connection_details
server.tool(
  {
    name: "get_connection_details",
    description: "Get detailed info about a specific connection including platforms and timing.",
    schema: z.object({
      from: z.string(),
      to: z.string(),
      datetime: z.string(),
      connectionIndex: z.number().optional().default(0),
    }),
  },
  async ({ from, to, datetime, connectionIndex }) => {
    try {
      const result = await findConnections(from, to, datetime, false, 6);
      if (result.connections.length === 0) {
        return text("No connections found.");
      }

      const connection = result.connections[connectionIndex] || result.connections[0];
      const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });

      const legDetails = connection.legs
        .map((leg, i) => {
          if (leg.type === "walk") return `${i + 1}. 🚶 Walk: ${leg.from.name} → ${leg.to.name}`;
          const platform = leg.from.platform ? ` (Pl. ${leg.from.platform})` : "";
          const delay = leg.delayMinutes ? ` ⚠️ +${leg.delayMinutes}min` : "";
          return `${i + 1}. ${leg.line}: ${leg.from.name}${platform} ${formatTime(leg.from.timePlanned)} → ${leg.to.name} ${formatTime(leg.to.timePlanned)}${delay}`;
        })
        .join("\n");

      return object({
        connection,
        summary: `${from} → ${to}\nDepart: ${formatTime(connection.departureTime)} | Arrive: ${formatTime(connection.arrivalTime)}\nDuration: ${connection.durationMinutes}min | Transfers: ${connection.transfersCount}\n\n${legDetails}`,
      });
    } catch (error) {
      return text(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// Tool: check_disruptions
server.tool(
  {
    name: "check_disruptions",
    description: "Check for delays/disruptions around a Swiss transit station.",
    schema: z.object({
      station: z.string().describe("Station name (e.g., 'Zürich HB', 'Bern')"),
    }),
  },
  async ({ station }) => {
    try {
      const result = await checkDisruptions(station);
      const statusEmoji = { normal: "✅", minor_delays: "🟡", major_delays: "🟠", disrupted: "⚠️" };
      const formatTime = (iso: string) => iso ? new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }) : "N/A";

      let details = `**${result.station}** - ${statusEmoji[result.status]} ${result.status.replace("_", " ").toUpperCase()}\n\n`;
      details += `${result.summary}\n\n`;
      details += `Routes checked: ${result.routesChecked.join(", ")}\n`;
      details += `Connections: ${result.totalConnectionsChecked} checked, ${result.delayedConnectionsCount} delayed\n`;
      details += `Delays: avg ${result.averageDelayMinutes}min, max ${result.maxDelayMinutes}min\n`;

      if (result.delayedRoutes.length > 0) {
        details += `\nDelayed:\n`;
        for (const dr of result.delayedRoutes) {
          details += `• ${dr.line}: ${dr.route} (+${dr.delayMinutes}min)\n`;
        }
      }
      details += `\n_Checked ${formatTime(result.checkedAt)}_`;

      return object({ ...result, _humanSummary: details });
    } catch (error) {
      return text(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// Helper: parse flexible datetime formats
function parseDateTime(datetime?: string): string {
  if (!datetime) return new Date().toISOString();
  
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(datetime)) {
    const today = new Date();
    const [hours, minutes] = datetime.split(":").map(Number);
    today.setHours(hours, minutes, 0, 0);
    return today.toISOString();
  }
  
  if (/^\d{1,2}(am|pm)$/i.test(datetime)) {
    const today = new Date();
    const match = datetime.match(/^(\d{1,2})(am|pm)$/i);
    if (match) {
      let hours = parseInt(match[1]);
      if (match[2].toLowerCase() === "pm" && hours !== 12) hours += 12;
      if (match[2].toLowerCase() === "am" && hours === 12) hours = 0;
      today.setHours(hours, 0, 0, 0);
      return today.toISOString();
    }
  }
  
  const parsed = new Date(datetime);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

// Prompts (templates for common queries)
server.prompt(
  {
    name: "template_commute",
    description: "Template: commute planning question",
    schema: z.object({
      home: z.string(),
      work: z.string(),
      arrivalTime: z.string().optional(),
    }),
  },
  async ({ home, work, arrivalTime }) => ({
    messages: [{
      role: "user",
      content: { type: "text", text: `I commute from ${home} to ${work}. ${arrivalTime ? `I need to arrive by ${arrivalTime}.` : "I want to leave soon."} Find me the best connections.` },
    }],
  })
);

server.prompt(
  {
    name: "template_fastest_route",
    description: "Template: fastest route question",
    schema: z.object({ from: z.string(), to: z.string() }),
  },
  async ({ from, to }) => ({
    messages: [{
      role: "user",
      content: { type: "text", text: `What's the fastest train from ${from} to ${to}?` },
    }],
  })
);

server.prompt(
  {
    name: "template_service_status",
    description: "Template: service status question",
    schema: z.object({ station: z.string() }),
  },
  async ({ station }) => ({
    messages: [{
      role: "user",
      content: { type: "text", text: `Are there any disruptions or delays around ${station}?` },
    }],
  })
);

server.listen().then(() => console.log("🚂 Swiss Transit Explorer running"));
