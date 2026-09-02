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

const LOG = "[DirectionsMap]";

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
        console.info(LOG, "importing maplibre-gl…");
        const maplibreglModule: any = await import("maplibre-gl");
        const maplibregl = maplibreglModule.default || maplibreglModule;
        console.info(LOG, "maplibre imported", {
          version: maplibregl?.version ?? "unknown",
          hasMap: typeof maplibregl?.Map,
          hasMarker: typeof maplibregl?.Marker,
          hasNavigationControl: typeof maplibregl?.NavigationControl,
        });

        // maplibre v6 derives its worker URL from import.meta.url, which is not
        // a real http(s) URL under Next's bundlers — the worker then resolves
        // against the page origin and the server answers with HTML, leaving the
        // map blank. Point it at the copy served from /public/maplibre.
        if (typeof maplibregl?.setWorkerUrl === "function") {
          maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
          console.info(LOG, "worker URL set → /maplibre/maplibre-gl-worker.mjs");
        } else {
          console.warn(LOG, "setWorkerUrl unavailable on this maplibre build");
        }

        if (cancelled || !containerRef.current || mapRef.current) return;

        // WebGL probe — maplibre cannot render without it.
        const probe = document.createElement("canvas");
        const gl = probe.getContext("webgl2") || probe.getContext("webgl");
        if (!gl) {
          console.error(LOG, "WebGL UNAVAILABLE — canvas context is null");
          setMapError("WebGL is unavailable in this browser");
          return;
        }
        console.info(LOG, "WebGL OK:", gl.getParameter(gl.VERSION));

        const r = routeRef.current;
        console.info(LOG, "route payload", {
          from: r.from,
          to: r.to,
          college: r.college,
          coordinateCount: r.coordinates?.length,
          steps: r.steps?.length,
        });

        const midIndex = Math.floor(r.coordinates.length / 2);
        const mid = r.coordinates[midIndex] ?? [r.from.lng, r.from.lat];
        const styleUrl = BASE_STYLES[isDarkRef.current ? "dark" : "light"];
        console.info(LOG, "constructing Map", { style: styleUrl, center: mid });

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: styleUrl,
          center: mid,
          zoom: 15.6,
          pitch: 52,
          bearing: -18,
          attributionControl: { compact: true },
        });
        mapRef.current = map;
        styleThemeRef.current = isDarkRef.current;

        map.addControl(new maplibregl.NavigationControl({ visualize_pitch: true }), "top-right");
        map.on("error", (e: any) => {
          console.error(LOG, "maplibre error event:", e?.error ?? e);
        });

        const applyOverlays = () => {
          const current = mapRef.current;
          if (!current || !current.isStyleLoaded()) {
            console.info(LOG, "applyOverlays skipped — style not loaded yet");
            return;
          }
          const dark = isDarkRef.current;
          const palette = PAINT[dark ? "dark" : "light"];

          // 3D buildings (fill-extrusion)
          try {
            const style = current.getStyle();
            const vectorSourceEntry = Object.entries(style?.sources ?? {}).find(
              ([, source]) => source.type === "vector"
            );
            console.info(LOG, "style sources:", Object.keys(style?.sources ?? {}), "vector source:", vectorSourceEntry?.[0] ?? "NONE", "layers:", style?.layers?.length);
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
              console.info(LOG, "added cg-3d-buildings layer");
            }
          } catch (bErr: any) {
            console.warn(LOG, "3d buildings error:", bErr?.message ?? bErr);
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
            console.info(LOG, "route layers applied");
          } catch (rErr: any) {
            console.warn(LOG, "route layer error:", rErr?.message ?? rErr);
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
            console.info(LOG, "markers placed", { from: [from.lng, from.lat], to: [to.lng, to.lat] });
          } catch (mErr: any) {
            console.warn(LOG, "markers error:", mErr?.message ?? mErr);
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
          } catch (fErr: any) {
            console.warn(LOG, "fitBounds error:", fErr?.message ?? fErr);
          }

          setTimeout(() => current.resize(), 120);
          setTimeout(() => current.resize(), 600);
        };

        applyOverlaysRef.current = applyOverlays;

        map.on("style.load", () => {
          console.info(LOG, "style.load — basemap style ready");
          map.once("idle", () => {
            console.info(LOG, "idle — tiles rendered");
            applyOverlays();
          });
          if (map.isStyleLoaded()) applyOverlays();
        });

        map.on("load", () => {
          console.info(LOG, "load — map ready, applying overlays");
          applyOverlays();
          map.resize();
          if (containerRef.current) {
            resizeObserver = new ResizeObserver(() => map.resize());
            resizeObserver.observe(containerRef.current);
          }
        });

        // If the basemap style never loads (blocked network, bad URL, worker
        // failure), surface it instead of a silently blank container.
        watchdog = setTimeout(() => {
          const current = mapRef.current;
          if (cancelled || !current) return;
          if (!current.isStyleLoaded()) {
            console.error(LOG, "STYLE TIMEOUT — basemap did not load within 15s", { style: styleUrl });
            setMapError("Basemap style failed to load (timeout) — see console");
          }
        }, 15000);
      } catch (err: any) {
        console.error(LOG, "INIT FAILED:", err?.stack ?? err?.message ?? err);
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
          <span className="text-[10.5px] text-ink-3">console logs prefixed [DirectionsMap] have details</span>
        </div>
      )}
    </div>
  );
}
