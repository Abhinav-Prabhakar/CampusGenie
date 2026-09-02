"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import type { DirectionsPayload } from "@/lib/campusDirections";

// Free, keyless vector basemaps (CARTO) that follow the app's theme:
// dark-matter in dark mode, positron in light mode.
const BASE_STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
} as const;

// Concrete hex approximations of the OKLCH design tokens — MapLibre paint
// properties cannot read CSS custom properties.
const PAINT = {
  dark: {
    buildingLow: "#262B36",
    buildingMid: "#3A4150",
    buildingHigh: "#4A556B",
    routeCasing: "#0E1116",
    routeLine: "#3A84FF",
    buildingOpacity: 0.92,
  },
  light: {
    buildingLow: "#E3E7EF",
    buildingMid: "#C3CBD9",
    buildingHigh: "#A7B2C6",
    routeCasing: "#FFFFFF",
    routeLine: "#2563EB",
    buildingOpacity: 0.85,
  },
} as const;

function routeFeatureCollection(route: DirectionsPayload) {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: route.coordinates },
      },
    ],
  };
}

function markerElement(kind: "origin" | "destination") {
  const el = document.createElement("div");
  if (kind === "origin") {
    el.className = "cg-map-marker";
    const ping = document.createElement("span");
    ping.className = "cg-ping";
    const dot = document.createElement("span");
    dot.className = "cg-dot";
    el.append(ping, dot);
  } else {
    el.className = "cg-map-pin";
    el.innerHTML =
      '<svg width="26" height="32" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M12 1C5.9 1 1 5.9 1 12c0 8 11 17.5 11 17.5S23 20 23 12C23 5.9 18.1 1 12 1Z" fill="var(--green)" stroke="var(--page)" stroke-width="1.5"/>' +
      '<circle cx="12" cy="12" r="3.2" fill="var(--page)"/></svg>';
  }
  return el;
}

export default function DirectionsMap({ route, isDark }: { route: DirectionsPayload; isDark: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markersAddedRef = useRef(false);
  const fittedRef = useRef(false);
  const routeRef = useRef(route);
  const isDarkRef = useRef(isDark);
  // Theme the current basemap was created/switched for — guards the async
  // mount vs. theme-flip race.
  const styleThemeRef = useRef(isDark);

  // Mirror latest props into refs for use inside the async mount closure
  // (declared before the mount effect so they run first).
  useEffect(() => {
    routeRef.current = route;
  }, [route]);
  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      const maplibreglModule: any = await import("maplibre-gl");
      const maplibregl = maplibreglModule.default || maplibreglModule;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const midIndex = Math.floor(routeRef.current.coordinates.length / 2);
      const mid = routeRef.current.coordinates[midIndex] ?? [routeRef.current.from.lng, routeRef.current.from.lat];

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: BASE_STYLES[isDarkRef.current ? "dark" : "light"],
        center: mid,
        zoom: 15.6,
        pitch: 52,
        bearing: -18,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      styleThemeRef.current = isDarkRef.current;

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      map.on("error", (e: any) => console.warn("[DirectionsMap]", e?.error?.message || e));

      const applyOverlays = () => {
        const current = mapRef.current;
        if (!current || !current.isStyleLoaded()) return;
        const dark = isDarkRef.current;
        const palette = PAINT[dark ? "dark" : "light"];

        // 3D buildings (fill-extrusion) — reference whichever vector source the
        // active style provides so the layer survives basemap switches.
        const vectorSourceEntry = Object.entries(current.getStyle()?.sources ?? {}).find(
          ([, source]) => source.type === "vector"
        );
        if (vectorSourceEntry && !current.getLayer("cg-3d-buildings")) {
          current.addLayer({
            id: "cg-3d-buildings",
            type: "fill-extrusion",
            source: vectorSourceEntry[0],
            "source-layer": "building",
            minzoom: 13,
            paint: {
              "fill-extrusion-color": [
                "interpolate", ["linear"],
                ["coalesce", ["get", "render_height"], ["coalesce", ["get", "height"], 5]],
                0, palette.buildingLow,
                30, palette.buildingMid,
                90, palette.buildingHigh,
              ],
              "fill-extrusion-height": [
                "coalesce", ["get", "render_height"], ["coalesce", ["get", "height"], 6],
              ],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": palette.buildingOpacity,
            },
          } as const);
        }

        // Route casing + main line
        const data = routeFeatureCollection(routeRef.current);
        if (!current.getSource("cg-route")) {
          current.addSource("cg-route", { type: "geojson", data });
        } else {
          (current.getSource("cg-route") as GeoJSONSource).setData(data);
        }
        if (!current.getLayer("cg-route-casing")) {
          current.addLayer({
            id: "cg-route-casing",
            type: "line",
            source: "cg-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": palette.routeCasing,
              "line-width": ["interpolate", ["linear"], ["zoom"], 13, 6, 17, 13],
            },
          });
        }
        if (!current.getLayer("cg-route-line")) {
          current.addLayer({
            id: "cg-route-line",
            type: "line",
            source: "cg-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": palette.routeLine,
              "line-width": ["interpolate", ["linear"], ["zoom"], 13, 3.5, 17, 8],
              "line-opacity": 0.95,
            },
          });
        }

        if (!markersAddedRef.current) {
          markersAddedRef.current = true;
          const { from, to } = routeRef.current;
          new maplibregl.Marker({ element: markerElement("origin"), anchor: "center" })
            .setLngLat([from.lng, from.lat])
            .addTo(current);
          new maplibregl.Marker({ element: markerElement("destination"), anchor: "bottom" })
            .setLngLat([to.lng, to.lat])
            .addTo(current);
        }

        if (!fittedRef.current) {
          fittedRef.current = true;
          const lats = routeRef.current.coordinates.map((c) => c[1]);
          const lngs = routeRef.current.coordinates.map((c) => c[0]);
          current.fitBounds(
            [
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)],
            ],
            { padding: { top: 70, bottom: 70, left: 60, right: 60 }, maxZoom: 17.2, duration: 900, essential: true }
          );
        }
      };

      map.on("style.load", () => {
        // Wait one tick so basemap sources are queryable before layering.
        map.once("idle", applyOverlays);
        // If the map already finished idling (cached style), run immediately.
        if (map.isStyleLoaded()) applyOverlays();
      });
      map.on("load", () => {
        if (containerRef.current) {
          resizeObserver = new ResizeObserver(() => map.resize());
          resizeObserver.observe(containerRef.current);
        }
      });
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      markersAddedRef.current = false;
      fittedRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Auto-adapt the basemap when the app theme flips; setStyle re-fires style.load,
  // which re-applies the 3D building + route layers on the new style.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleThemeRef.current === isDark) return;
    styleThemeRef.current = isDark;
    map.setStyle(BASE_STYLES[isDark ? "dark" : "light"], { diff: false });
  }, [isDark]);

  return <div ref={containerRef} className="cg-map-container" aria-label={`Walking directions map from ${route.from.name} to ${route.to.name}`} />;
}
