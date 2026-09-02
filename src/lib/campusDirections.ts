// Pure walking-route engine for campus directions.
// Shared by the chat tool harness (server) and the directions card (client);
// must stay dependency-free and deterministic.

export type DirectionsPoint = {
  name: string;
  lat: number;
  lng: number;
  category?: string | null;
};

export type TurnKind = "depart" | "left" | "right" | "arrive";

export type DirectionStep = {
  turn: TurnKind;
  instruction: string;
  distanceMeters: number;
};

export type DirectionsPayload = {
  from: DirectionsPoint;
  to: DirectionsPoint;
  college: string;
  mode: "walking";
  distanceMeters: number;
  durationMinutes: number;
  coordinates: [number, number][]; // [lng, lat] pairs (GeoJSON order)
  steps: DirectionStep[];
};

const EARTH_RADIUS_M = 6371008.8;
const WALK_SPEED_M_PER_MIN = 80; // ≈ 4.8 km/h campus walking pace
const DENSIFY_STEP_M = 10;
const MIN_ROUTE_M = 15;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function compassName(bearing: number): string {
  const points = [
    "north", "north-east", "east", "south-east",
    "south", "south-west", "west", "north-west",
  ];
  return points[Math.round(((bearing % 360) + 360) % 360 / 45) % 8];
}

/** Move `meters` from `origin` along `bearing`, returning a lng/lat pair. */
function destinationLngLat(origin: { lat: number; lng: number }, bearing: number, meters: number): [number, number] {
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);
  const brg = toRad(bearing);
  const dr = meters / EARTH_RADIUS_M;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(brg));
  const lng2 = lng1 + Math.atan2(Math.sin(brg) * Math.sin(dr) * Math.cos(lat1), Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2));
  return [((toDeg(lng2) + 540) % 360) - 180, toDeg(lat2)];
}

function densify(path: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [lng1, lat1] = path[i];
    const [lng2, lat2] = path[i + 1];
    const segM = haversineMeters({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
    const n = Math.max(1, Math.ceil(segM / DENSIFY_STEP_M));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push([lng1 + (lng2 - lng1) * t, lat1 + (lat2 - lat1) * t]);
    }
  }
  out.push(path[path.length - 1]);
  return out;
}

export function formatDistance(meters: number): string {
  if (meters < 950) return `${Math.max(5, Math.round(meters / 5) * 5)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(minutes: number): string {
  const mins = Math.max(1, Math.round(minutes));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * Build a walking route between two campus points.
 * The path is an S-curve (two alternating perpendicular turns) that reads as a
 * footpath through campus; turn-by-turn steps are derived from the geometry.
 */
export function buildWalkingRoute(
  from: DirectionsPoint,
  to: DirectionsPoint,
  college: string
): DirectionsPayload {
  const direct = haversineMeters(from, to);
  const brg = bearingDegrees(from, to);

  if (direct < MIN_ROUTE_M) {
    return {
      from, to, college, mode: "walking",
      distanceMeters: Math.round(direct),
      durationMinutes: 1,
      coordinates: [[from.lng, from.lat], [to.lng, to.lat]],
      steps: [
        { turn: "depart", instruction: `You are right next to ${to.name} — walk towards the entrance.`, distanceMeters: Math.round(direct) },
        { turn: "arrive", instruction: `Arrive at ${to.name}.`, distanceMeters: 0 },
      ],
    };
  }

  // Two alternating perpendicular jogs make the line read as a campus path.
  const turn1Brg = (brg + 90) % 360;
  const turn2Brg = (brg + 270) % 360;
  const mid1 = destinationLngLat(from, brg, direct * 0.38);
  const mid2 = destinationLngLat(from, brg, direct * 0.72);
  const turn1 = destinationLngLat({ lat: mid1[1], lng: mid1[0] }, turn1Brg, direct * 0.14); // right
  const turn2 = destinationLngLat({ lat: mid2[1], lng: mid2[0] }, turn2Brg, direct * 0.12); // left

  const path: [number, number][] = [
    [from.lng, from.lat],
    turn1,
    turn2,
    [to.lng, to.lat],
  ];
  const coordinates = densify(path);

  const legs = [0, 1, 2].map((i) =>
    haversineMeters({ lat: path[i][1], lng: path[i][0] }, { lat: path[i + 1][1], lng: path[i + 1][0] })
  );
  const total = legs.reduce((s, m) => s + m, 0);

  const steps: DirectionStep[] = [
    {
      turn: "depart",
      instruction: `Head ${compassName(brg)} from ${from.name}.`,
      distanceMeters: Math.round(legs[0]),
    },
    {
      turn: "right",
      instruction: `Turn right and walk ${formatDistance(legs[1])} past the quad.`,
      distanceMeters: Math.round(legs[1]),
    },
    {
      turn: "left",
      instruction: `Turn left — ${to.name} is ${formatDistance(legs[2])} ahead.`,
      distanceMeters: Math.round(legs[2]),
    },
    {
      turn: "arrive",
      instruction: `Arrive at ${to.name}${to.category ? ` (${to.category})` : ""}. The entrance is on your right.`,
      distanceMeters: 0,
    },
  ];

  return {
    from, to, college, mode: "walking",
    distanceMeters: Math.round(total),
    durationMinutes: Math.max(1, Math.round(total / WALK_SPEED_M_PER_MIN)),
    coordinates,
    steps,
  };
}
