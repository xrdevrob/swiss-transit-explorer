export interface Station {
  id?: string;
  name: string;
}

export interface StopTime {
  name: string;
  timePlanned: string;
  timeActual?: string;
  platform?: string;
}

export interface Leg {
  type: "walk" | "ride";
  line?: string;
  operator?: string;
  from: StopTime;
  to: StopTime;
  stops?: StopTime[];
  delayMinutes?: number;
}

export interface TransferRisk {
  fromStation: string;
  toStation: string;
  marginMinutes: number;
  riskLevel: "low" | "medium" | "high";
  isBigStation: boolean;
}

export interface ReliabilityReason {
  code: string;
  label: string;
  penalty: number;
}

export interface ReliabilityInsight {
  score: number;
  level: "low" | "medium" | "high";
  reasons: ReliabilityReason[];
  transferRisks: TransferRisk[];
}

export interface Connection {
  id: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  transfersCount: number;
  legs: Leg[];
  reliabilityScore?: number;
  reliability?: ReliabilityInsight;
  tags: string[];
}
