"use client";

import { useEffect, useRef, useState } from "react";
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
  const markersRef = useRef<any[]>([]);
  const routeRef = useRef(route);
  const isDarkRef = useRef(isDark);
  const applyOverlaysRef = useRef<(() => void) | null>(null);
  const styleThemeRef = useRef(isDark);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    routeRef.current = route;
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      applyOverlaysRef.current?.();
      mapRef.current.resize();
    }
  }, [route]);

  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        const maplibreglModule: any = await import("maplibre-gl");
        const maplibregl = maplibreglModule.default || maplibreglModule;

        // maplibre v6 derives its worker URL from import.meta.url, which is not
        // a real http(s) URL under Next's bundlers — the worker then resolves
        // against the page origin and the server answers with HTML, leaving the
        // map blank. Point it at the copy served from /public/maplibre.
        if (typeof maplibregl?.setWorkerUrl === "function") {
          maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
        }

        if (cancelled || !containerRef.current || mapRef.current) return;

        const r = routeRef.current;
        const midIndex = Math.floor(r.coordinates.length / 2);
        const mid = r.coordinates[midIndex] ?? [r.from.lng, r.from.lat];

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

        map.addControl(new maplibregl.NavigationControl({ visualize_pitch: true }), "top-right");

        const applyOverlays = () => {
          const current = mapRef.current;
          if (!current || !current.isStyleLoaded()) return;
          const dark = isDarkRef.current;
          const palette = PAINT[dark ? "dark" : "light"];

          // 3D buildings (fill-extrusion)
          try {
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
          } catch {
            // basemap without a building layer — skip extrusions
          }

          // Route casing + main line
          try {
            const data = routeFeatureCollection(routeRef.current);
            const existingSource = current.getSource("cg-route") as GeoJSONSource | undefined;
            if (!existingSource) {
              current.addSource("cg-route", { type: "geojson", data });
            } else {
              existingSource.setData(data);
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
          } catch {
            // route overlay failure is non-fatal — markers may still render
          }

          // Origin and Destination markers
          try {
            markersRef.current.forEach((m) => m?.remove?.());
            markersRef.current = [];
            const { from, to } = routeRef.current;
            const originMarker = new maplibregl.Marker({ element: markerElement("origin"), anchor: "center" })
              .setLngLat([from.lng, from.lat])
              .addTo(current);
            const destMarker = new maplibregl.Marker({ element: markerElement("destination"), anchor: "bottom" })
              .setLngLat([to.lng, to.lat])
              .addTo(current);
            markersRef.current = [originMarker, destMarker];
          } catch {
            // markers are decorative — the route line carries the path
          }

          // Fit bounds
          try {
            const lats = routeRef.current.coordinates.map((c) => c[1]);
            const lngs = routeRef.current.coordinates.map((c) => c[0]);
            if (lats.length > 0 && lngs.length > 0) {
              current.fitBounds(
                [
                  [Math.min(...lngs), Math.min(...lats)],
                  [Math.max(...lngs), Math.max(...lats)],
                ],
                { padding: { top: 70, bottom: 70, left: 60, right: 60 }, maxZoom: 17.2, duration: 800, essential: true }
              );
            }
          } catch {
            // fall back to the initial center/zoom
          }

          setTimeout(() => current.resize(), 120);
          setTimeout(() => current.resize(), 600);
        };

        applyOverlaysRef.current = applyOverlays;

        map.on("style.load", () => {
          map.once("idle", applyOverlays);
          if (map.isStyleLoaded()) applyOverlays();
        });

        map.on("load", () => {
          applyOverlays();
          map.resize();
          if (containerRef.current) {
            resizeObserver = new ResizeObserver(() => map.resize());
            resizeObserver.observe(containerRef.current);
          }
        });

        // If the basemap never loads (blocked network, dead worker), surface a
        // visible state instead of a silently blank container.
        watchdog = setTimeout(() => {
          const current = mapRef.current;
          if (cancelled || !current) return;
          if (!current.isStyleLoaded()) {
            setMapError("Basemap style failed to load — check your network and refresh.");
          }
        }, 15000);
      } catch (err: any) {
        setMapError(String(err?.message ?? err));
      }
    })();

    return () => {
      cancelled = true;
      if (watchdog) clearTimeout(watchdog);
      resizeObserver?.disconnect();
      markersRef.current.forEach((m) => m?.remove?.());
      markersRef.current = [];
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

  return (
    <div className="relative size-full">
      <div ref={containerRef} className="cg-map-container" aria-label={`Walking directions map from ${route.from.name} to ${route.to.name}`} />
      {mapError && (
        <div
          role="status"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 bg-canvas px-4 text-center"
        >
          <span className="text-[12.5px] font-semibold text-red">Map failed to render</span>
          <span className="font-mono text-[10.5px] leading-relaxed text-ink-3">{mapError}</span>
        </div>
      )}
    </div>
  );
}
