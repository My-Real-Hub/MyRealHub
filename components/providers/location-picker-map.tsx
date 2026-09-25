"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type {
  Map as LeafletMap,
  Marker as LeafletMarker,
} from "leaflet";

type MapCoordinates = {
  latitude: number;
  longitude: number;
};

type LocationPickerMapProps = {
  className?: string;
  coordinates: MapCoordinates | null;
  disabled?: boolean;
  onCoordinatesChange: (coordinates: MapCoordinates) => void;
};

const SUPPORTED_AREA_CENTER: [number, number] = [56.1304, -106.3468];
const SUPPORTED_AREA_BOUNDS: [[number, number], [number, number]] = [
  [41.4, -141.5],
  [83.4, -52],
];
const SUPPORTED_AREA_ZOOM = 3;
const DEFAULT_LOCAL_CENTER: [number, number] = [43.6532, -79.3832];
const DEFAULT_LOCAL_ZOOM = 11;
const PRIMARY_AREA_CENTER: [number, number] = [50.0007, -85.0002];
const PRIMARY_AREA_ZOOM = 5;
const SELECTED_LOCATION_ZOOM = 13;
const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function LocationPickerMap({
  className = "h-64",
  coordinates,
  disabled = false,
  onCoordinatesChange,
}: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const onCoordinatesChangeRef = useRef(onCoordinatesChange);
  const disabledRef = useRef(disabled);
  const [mapError, setMapError] = useState("");
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    onCoordinatesChangeRef.current = onCoordinatesChange;
  }, [onCoordinatesChange]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    let disposed = false;

    async function initializeMap() {
      if (!containerRef.current || mapRef.current) {
        return;
      }

      try {
        const leaflet = await import("leaflet");

        if (disposed || !containerRef.current) {
          return;
        }

        leafletRef.current = leaflet;
        const map = leaflet
          .map(containerRef.current, {
            boxZoom: true,
            center: DEFAULT_LOCAL_CENTER,
            doubleClickZoom: "center",
            dragging: true,
            inertia: true,
            keyboard: true,
            keyboardPanDelta: 120,
            maxBounds: SUPPORTED_AREA_BOUNDS,
            maxBoundsViscosity: 0.65,
            minZoom: SUPPORTED_AREA_ZOOM,
            scrollWheelZoom: "center",
            touchZoom: "center",
            wheelDebounceTime: 30,
            wheelPxPerZoomLevel: 90,
            worldCopyJump: true,
            zoom: DEFAULT_LOCAL_ZOOM,
            zoomAnimation: true,
            zoomControl: false,
            zoomDelta: 0.5,
            zoomSnap: 0.5,
          })
          .setView(DEFAULT_LOCAL_CENTER, DEFAULT_LOCAL_ZOOM);
        const tileUrl =
          process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim() || DEFAULT_TILE_URL;
        const attribution =
          process.env.NEXT_PUBLIC_MAP_ATTRIBUTION?.trim() ||
          DEFAULT_ATTRIBUTION;

        leaflet
          .tileLayer(tileUrl, {
            attribution,
            crossOrigin: true,
            maxZoom: 19,
          })
          .addTo(map);

        map.on("click", (event) => {
          if (disabledRef.current) {
            return;
          }

          onCoordinatesChangeRef.current({
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          });
        });

        mapRef.current = map;
        setIsMapReady(true);
      } catch {
        setMapError("The map could not be loaded.");
      }
    }

    void initializeMap();

    return () => {
      disposed = true;
      markerRef.current = null;
      leafletRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;

    if (!map || !leaflet) {
      return;
    }

    if (!coordinates) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }

    const point: [number, number] = [
      coordinates.latitude,
      coordinates.longitude,
    ];

    if (!markerRef.current) {
      const icon = leaflet.divIcon({
        className: "myrealhub-map-pin-container",
        html: '<span class="myrealhub-map-pin" aria-hidden="true"></span>',
        iconAnchor: [16, 38],
        iconSize: [32, 40],
      });
      const marker = leaflet
        .marker(point, {
          alt: "Selected property location",
          autoPan: true,
          draggable: !disabled,
          icon,
          keyboard: true,
          title: "Drag to change the property location",
        })
        .addTo(map);

      marker.on("dragend", () => {
        const nextPoint = marker.getLatLng();

        onCoordinatesChangeRef.current({
          latitude: nextPoint.lat,
          longitude: nextPoint.lng,
        });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(point);
      if (disabled) {
        markerRef.current.dragging?.disable();
      } else {
        markerRef.current.dragging?.enable();
      }
    }

    map.flyTo(point, Math.max(map.getZoom(), SELECTED_LOCATION_ZOOM), {
      animate: true,
      duration: 0.6,
    });
  }, [coordinates, disabled, isMapReady]);

  function stopMapControlPropagation(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  function zoomIn() {
    mapRef.current?.zoomIn(0.5);
  }

  function zoomOut() {
    mapRef.current?.zoomOut(0.5);
  }

  function resetToSupportedArea() {
    mapRef.current?.setView(SUPPORTED_AREA_CENTER, SUPPORTED_AREA_ZOOM, {
      animate: true,
    });
  }

  function resetToDefaultLocalArea() {
    mapRef.current?.setView(DEFAULT_LOCAL_CENTER, DEFAULT_LOCAL_ZOOM, {
      animate: true,
    });
  }

  function resetToPrimaryArea() {
    mapRef.current?.setView(PRIMARY_AREA_CENTER, PRIMARY_AREA_ZOOM, {
      animate: true,
    });
  }

  function recenterSelectedLocation() {
    if (!coordinates) {
      resetToDefaultLocalArea();
      return;
    }

    const map = mapRef.current;

    if (!map) {
      return;
    }

    map.setView(
      [coordinates.latitude, coordinates.longitude],
      Math.max(map.getZoom(), SELECTED_LOCATION_ZOOM),
      {
        animate: true,
      },
    );
  }

  const controlButtonClassName =
    "rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800 shadow-sm transition hover:border-teal-800 hover:text-teal-900 focus:outline-none focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="relative overflow-hidden rounded-lg border border-stone-300 bg-stone-100 shadow-sm">
      <div
        ref={containerRef}
        className={`myrealhub-location-map w-full ${className}`}
        aria-label="Map for choosing a property location"
      />
      <div
        className="absolute right-2 top-2 z-[500] flex max-w-[calc(100%-1rem)] flex-wrap justify-end gap-1.5"
        aria-label="Map controls"
        onPointerDown={stopMapControlPropagation}
      >
        <button
          type="button"
          className={`${controlButtonClassName} min-w-8 text-base leading-none`}
          onClick={zoomIn}
          disabled={!isMapReady}
          aria-label="Zoom map in"
        >
          +
        </button>
        <button
          type="button"
          className={`${controlButtonClassName} min-w-8 text-base leading-none`}
          onClick={zoomOut}
          disabled={!isMapReady}
          aria-label="Zoom map out"
        >
          −
        </button>
        <button
          type="button"
          className={controlButtonClassName}
          onClick={recenterSelectedLocation}
          disabled={!isMapReady}
        >
          Recenter
        </button>
        <button
          type="button"
          className={controlButtonClassName}
          onClick={resetToPrimaryArea}
          disabled={!isMapReady}
        >
          Primary area
        </button>
        <button
          type="button"
          className={controlButtonClassName}
          onClick={resetToSupportedArea}
          disabled={!isMapReady}
        >
          All areas
        </button>
      </div>
      {mapError ? (
        <div className="absolute inset-0 grid place-items-center bg-stone-100 p-6 text-center text-sm font-medium text-red-700">
          {mapError}
        </div>
      ) : null}
    </div>
  );
}
