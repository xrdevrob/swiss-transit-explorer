import { AppsSDKUIProvider } from "@openai/apps-sdk-ui/components/AppsSDKUIProvider";
import { McpUseProvider, useWidget, type WidgetMetadata } from "mcp-use/react";
import React from "react";
import { Link } from "react-router";
import { z } from "zod";
import "../styles.css";

interface Departure {
  line: string;
  destination: string;
  departurePlanned: string;
  departureActual?: string;
  platform?: string;
  delayMinutes?: number;
}

interface DeparturesBoardProps {
  station: string;
  departures: Departure[];
  generatedAt: string;
  [key: string]: unknown;
}

export const widgetMetadata: WidgetMetadata = {
  description: "Live departure board showing upcoming trains from a Swiss transit station.",
  props: z.object({
    station: z.string(),
    departures: z.any(),
    generatedAt: z.string(),
  }),
  exposeAsTool: false,
};

const formatTime = (iso: string) => {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
};

const getLineBadgeColor = (line: string) => {
  if (line.startsWith("IC")) return "bg-red-600";
  if (line.startsWith("IR")) return "bg-red-500";
  if (line.startsWith("S")) return "bg-blue-500";
  if (line.startsWith("RE")) return "bg-orange-500";
  if (line.startsWith("TGV")) return "bg-purple-600";
  if (line.startsWith("EC") || line.startsWith("EN")) return "bg-gray-700";
  return "bg-teal-500";
};

const DeparturesBoard: React.FC = () => {
  const { props } = useWidget<DeparturesBoardProps>();

  if (!props?.departures) {
    return (
      <McpUseProvider debugger viewControls autoSize>
        <AppsSDKUIProvider linkComponent={Link}>
          <div className="bg-surface-elevated border border-default rounded-2xl p-8 text-center">
            <p className="text-secondary">Loading departures...</p>
          </div>
        </AppsSDKUIProvider>
      </McpUseProvider>
    );
  }

  return (
    <McpUseProvider debugger viewControls autoSize>
      <AppsSDKUIProvider linkComponent={Link}>
        <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden font-mono">
          {/* Header - styled like station displays */}
          <div className="bg-blue-900 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
                <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
              </svg>
              <span className="text-yellow-400 font-bold text-lg tracking-wide">
                {props.station}
              </span>
            </div>
            <span className="text-gray-400 text-xs">
              {formatTime(props.generatedAt)}
            </span>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-800 text-gray-400 text-xs uppercase tracking-wider">
            <div className="col-span-2">Time</div>
            <div className="col-span-2">Line</div>
            <div className="col-span-5">Destination</div>
            <div className="col-span-2 text-center">Platform</div>
            <div className="col-span-1"></div>
          </div>

          {/* Departures */}
          <div className="divide-y divide-gray-800">
            {props.departures.map((dep: Departure, i: number) => (
              <div
                key={i}
                className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${
                  i === 0 ? "bg-gray-800/50" : ""
                }`}
              >
                {/* Time */}
                <div className="col-span-2">
                  <span className="text-yellow-400 text-lg font-bold">
                    {formatTime(dep.departureActual || dep.departurePlanned)}
                  </span>
                </div>

                {/* Line */}
                <div className="col-span-2">
                  <span className={`px-2 py-1 text-xs font-bold text-white rounded ${getLineBadgeColor(dep.line)}`}>
                    {dep.line}
                  </span>
                </div>

                {/* Destination */}
                <div className="col-span-5">
                  <span className="text-white font-medium truncate block">
                    {dep.destination}
                  </span>
                </div>

                {/* Platform */}
                <div className="col-span-2 text-center">
                  {dep.platform && (
                    <span className={`px-2 py-1 text-sm font-bold rounded ${
                      dep.platform.includes("!") 
                        ? "bg-red-500/20 text-red-400" 
                        : "bg-gray-700 text-white"
                    }`}>
                      {dep.platform}
                    </span>
                  )}
                </div>

                {/* Delay indicator */}
                <div className="col-span-1 text-right">
                  {dep.delayMinutes && dep.delayMinutes > 0 && (
                    <span className="text-red-400 text-sm font-bold">
                      +{dep.delayMinutes}′
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="bg-gray-800 px-4 py-2 text-center">
            <span className="text-gray-500 text-xs">
              Data from transport.opendata.ch
            </span>
          </div>
        </div>
      </AppsSDKUIProvider>
    </McpUseProvider>
  );
};

export default DeparturesBoard;

