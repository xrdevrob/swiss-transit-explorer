import React, { useState } from "react";
import type { Connection, Leg } from "../types";

// Shared helpers
const formatTime = (isoString: string) => {
  if (!isoString) return "--:--";
  const date = new Date(isoString);
  return date.toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isPlatformChanged = (platform?: string) => platform?.includes("!");

const PlatformBadge: React.FC<{ platform?: string; className?: string }> = ({ platform, className = "" }) => {
  if (!platform) return null;
  const changed = isPlatformChanged(platform);
  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded ${
        changed 
          ? "bg-red-500/20 text-red-600 dark:text-red-400 font-medium" 
          : "text-tertiary bg-surface"
      } ${className}`}
      title={changed ? "⚠️ Platform changed! Check departure boards." : undefined}
    >
      Pl. {platform}
    </span>
  );
};

interface ConnectionCardProps {
  connection: Connection;
  isExpanded?: boolean;
}

export const ConnectionCard: React.FC<ConnectionCardProps> = ({
  connection,
  isExpanded: defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    return `${hours}h ${mins}min`;
  };

  const getLineBadgeColor = (line?: string) => {
    if (!line) return "bg-gray-500";
    if (line.startsWith("IC")) return "bg-red-600";
    if (line.startsWith("IR")) return "bg-red-500";
    if (line.startsWith("S")) return "bg-blue-500";
    if (line.startsWith("RE")) return "bg-orange-500";
    if (line.startsWith("TGV")) return "bg-purple-600";
    if (line.startsWith("EC") || line.startsWith("EN")) return "bg-gray-700";
    return "bg-teal-500";
  };

  const getReliabilityColor = (score?: number) => {
    if (!score) return "text-gray-400";
    if (score >= 0.8) return "text-emerald-500";
    if (score >= 0.6) return "text-yellow-500";
    return "text-red-500";
  };

  const getTagStyle = (tag: string) => {
    switch (tag) {
      case "fastest":
        return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400";
      case "recommended":
        return "bg-blue-500/20 text-blue-600 dark:text-blue-400";
      case "fewest transfers":
        return "bg-purple-500/20 text-purple-600 dark:text-purple-400";
      default:
        return "bg-gray-500/20 text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div className="bg-surface border border-default rounded-xl overflow-hidden transition-all duration-200 hover:border-blue-500/50">
      {/* Main card - clickable */}
      <button
        className="w-full p-4 text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Times */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-center">
              <div className="text-xl font-semibold text-default tabular-nums">
                {formatTime(connection.departureTime)}
              </div>
              {connection.legs[0]?.from.platform && (
                <div className="mt-0.5">
                  <PlatformBadge platform={connection.legs[0].from.platform} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-tertiary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <div className="text-center">
              <div className="text-xl font-semibold text-default tabular-nums">
                {formatTime(connection.arrivalTime)}
              </div>
              {connection.legs[connection.legs.length - 1]?.to.platform && (
                <div className="mt-0.5">
                  <PlatformBadge platform={connection.legs[connection.legs.length - 1].to.platform} />
                </div>
              )}
            </div>
          </div>

          {/* Center info */}
          <div className="flex-1 flex flex-col items-center gap-1.5">
            {/* Line badges */}
            <div className="flex flex-wrap justify-center gap-1">
              {connection.legs
                .filter((leg) => leg.type === "ride" && leg.line)
                .map((leg, i) => (
                  <span
                    key={i}
                    className={`px-2 py-0.5 text-xs font-semibold text-white rounded ${getLineBadgeColor(leg.line)}`}
                  >
                    {leg.line}
                  </span>
                ))}
            </div>
            {/* Tags */}
            {connection.tags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1">
                {connection.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getTagStyle(tag)}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right side info */}
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <div className="font-medium text-default">
                {formatDuration(connection.durationMinutes)}
              </div>
              <div className="text-tertiary text-xs">
                {connection.transfersCount === 0
                  ? "Direct"
                  : `${connection.transfersCount} transfer${connection.transfersCount > 1 ? "s" : ""}`}
              </div>
            </div>
            {connection.reliabilityScore !== undefined && (
              <div 
                className={`text-right cursor-help ${getReliabilityColor(connection.reliabilityScore)}`}
                title="Reliability score based on: number of transfers (fewer = better), connection type (direct trains score higher), and current delays. Higher % = more likely to arrive on time."
              >
                <div className="text-lg font-semibold">
                  {Math.round(connection.reliabilityScore * 100)}%
                </div>
                <div className="text-[10px] opacity-70">reliable</div>
              </div>
            )}
            <svg
              className={`w-5 h-5 text-tertiary transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-default px-4 py-3 bg-surface-elevated">
          <LegTimeline legs={connection.legs} />
        </div>
      )}
    </div>
  );
};

const LegTimeline: React.FC<{ legs: Leg[] }> = ({ legs }) => {
  const getTransferTime = (legIndex: number): number | null => {
    if (legIndex >= legs.length - 1) return null;
    const arrival = new Date(legs[legIndex].to.timeActual || legs[legIndex].to.timePlanned).getTime();
    const departure = new Date(legs[legIndex + 1].from.timePlanned).getTime();
    return Math.round((departure - arrival) / 60000);
  };

  return (
    <div className="space-y-0">
      {legs.map((leg, index) => {
        const transferTime = getTransferTime(index);
        const isTightTransfer = transferTime !== null && transferTime < 6;

        return (
          <React.Fragment key={index}>
            {/* Leg */}
            <div className="flex gap-3">
              {/* Timeline indicator */}
              <div className="flex flex-col items-center w-8">
                <div
                  className={`w-3 h-3 rounded-full border-2 ${
                    leg.type === "walk"
                      ? "border-gray-400 bg-transparent"
                      : "border-blue-500 bg-blue-500"
                  }`}
                />
                <div
                  className={`flex-1 w-0.5 min-h-8 ${
                    leg.type === "walk" ? "border-l-2 border-dashed border-gray-400" : "bg-blue-500"
                  }`}
                />
                <div
                  className={`w-3 h-3 rounded-full border-2 ${
                    leg.type === "walk"
                      ? "border-gray-400 bg-transparent"
                      : "border-blue-500 bg-blue-500"
                  }`}
                />
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                {/* Departure */}
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-mono text-sm tabular-nums text-default">
                    {formatTime(leg.from.timeActual || leg.from.timePlanned)}
                  </span>
                  <span className="text-sm font-medium text-default">{leg.from.name}</span>
                  <PlatformBadge platform={leg.from.platform} />
                  {leg.delayMinutes && leg.delayMinutes > 0 && (
                    <span className="text-xs text-red-500 font-medium">
                      +{leg.delayMinutes}′
                    </span>
                  )}
                </div>

                {/* Leg info */}
                {leg.type === "ride" && leg.line && (
                  <div className="text-xs text-secondary ml-1 my-2">
                    <span className="font-medium">{leg.line}</span>
                    {leg.operator && <span className="text-tertiary"> · {leg.operator}</span>}
                    {leg.stops && leg.stops.length > 0 && (
                      <span className="text-tertiary">
                        {" "}
                        · {leg.stops.length} stop{leg.stops.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                )}
                {leg.type === "walk" && (
                  <div className="text-xs text-tertiary ml-1 my-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Walk
                  </div>
                )}

                {/* Arrival */}
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm tabular-nums text-default">
                    {formatTime(leg.to.timeActual || leg.to.timePlanned)}
                  </span>
                  <span className="text-sm font-medium text-default">{leg.to.name}</span>
                  <PlatformBadge platform={leg.to.platform} />
                </div>
              </div>
            </div>

            {/* Transfer indicator */}
            {transferTime !== null && (
              <div className="flex gap-3 py-2">
                <div className="w-8 flex justify-center">
                  <svg className="w-4 h-4 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <div
                  className={`text-xs ${
                    isTightTransfer ? "text-orange-500 font-medium" : "text-tertiary"
                  }`}
                >
                  {transferTime} min transfer
                  {isTightTransfer && " ⚠️"}
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default ConnectionCard;

