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

export interface Connection {
  id: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  transfersCount: number;
  legs: Leg[];
  reliabilityScore?: number;
  tags: string[];
}
