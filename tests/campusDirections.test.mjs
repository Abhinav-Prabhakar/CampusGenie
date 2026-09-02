import test from "node:test";
import assert from "node:assert/strict";

import {
  haversineMeters,
  bearingDegrees,
  compassName,
  buildWalkingRoute,
  formatDistance,
  formatDuration,
} from "../src/lib/campusDirections.ts";

const LIBRARY = { name: "Central Library", lat: 12.9264, lng: 77.5895, category: "library" };
const CANTEEN = { name: "Main Canteen", lat: 12.9252, lng: 77.5918, category: "dining" };

test("haversineMeters measures known campus distances", () => {
  const d = haversineMeters(LIBRARY, CANTEEN);
  // Seeded buildings are ~2 tenths of a degree apart in Bengaluru → ~270 m.
  assert.ok(d > 200 && d < 340, `expected ~270 m, got ${d}`);
  assert.equal(haversineMeters(LIBRARY, LIBRARY), 0);
});

test("bearingDegrees and compassName agree", () => {
  assert.equal(bearingDegrees({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }), 0);
  assert.equal(compassName(0), "north");
  assert.equal(compassName(45), "north-east");
  assert.equal(compassName(90), "east");
  assert.equal(compassName(460), "east"); // wraps to 100°
});

test("buildWalkingRoute produces a full S-curve payload", () => {
  const route = buildWalkingRoute(LIBRARY, CANTEEN, "Databricks University");

  assert.equal(route.from.name, "Central Library");
  assert.equal(route.to.name, "Main Canteen");
  assert.equal(route.college, "Databricks University");
  assert.equal(route.mode, "walking");

  // GeoJSON-ordered coordinate line that starts and ends at the right places
  assert.ok(route.coordinates.length > 10, "route should be densified");
  assert.equal(route.coordinates[0][0], LIBRARY.lng);
  assert.equal(route.coordinates[0][1], LIBRARY.lat);
  const last = route.coordinates[route.coordinates.length - 1];
  assert.equal(last[0], CANTEEN.lng);
  assert.equal(last[1], CANTEEN.lat);

  // Distance/duration sanity
  assert.ok(route.distanceMeters >= haversineMeters(LIBRARY, CANTEEN), "S-curve is longer than direct line");
  assert.ok(route.durationMinutes >= 1);
  assert.equal(route.durationMinutes, Math.max(1, Math.round(route.distanceMeters / 80)));

  // Steps narrate the whole walk
  const turns = route.steps.map((s) => s.turn);
  assert.deepEqual(turns, ["depart", "right", "left", "arrive"]);
  assert.ok(route.steps[0].instruction.includes("Central Library"));
  assert.ok(route.steps[route.steps.length - 1].instruction.includes("Main Canteen"));
  assert.equal(route.steps[route.steps.length - 1].distanceMeters, 0);
});

test("buildWalkingRoute handles colocated buildings", () => {
  const here = { name: "Kemper Hall", lat: 12.9266, lng: 77.5921, category: "academics" };
  const route = buildWalkingRoute(here, { ...here, name: "Kemper Hall Annex" }, "Databricks University");
  assert.equal(route.steps.length, 2);
  assert.equal(route.steps[0].turn, "depart");
  assert.equal(route.steps[1].turn, "arrive");
});

test("route generation is deterministic", () => {
  const a = buildWalkingRoute(LIBRARY, CANTEEN, "Databricks University");
  const b = buildWalkingRoute(LIBRARY, CANTEEN, "Databricks University");
  assert.deepEqual(a, b);
});

test("formatters use design-system tabular conventions", () => {
  assert.equal(formatDistance(243.4), "245 m");
  assert.equal(formatDistance(1842), "1.8 km");
  assert.equal(formatDuration(6.2), "6 min");
  assert.equal(formatDuration(75), "1 h 15 min");
});
