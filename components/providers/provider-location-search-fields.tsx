"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { LocationPickerMap } from "@/components/providers/location-picker-map";
import type {
  LocationApiErrorResponse,
  LocationAutocompleteResponse,
  LocationReverseResponse,
  ResolvedSearchLocation,
} from "@/lib/location/types";

type ProviderLocationSearchFieldsProps = {
  initialProvinceCode: string;
  initialProvinceName: string | null;
  initialRegionId: string;
  initialRegionName: string | null;
};

type LocationStatus = {
  kind: "idle" | "loading" | "resolved" | "error";
  message: string;
};

type CoordinateResolveSource = "device" | "map";

const inputClassName =
  "h-12 w-full rounded-md border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";

const secondaryButtonClassName =
  "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60";

async function resolveLocation(
  body:
    | { mode: "autocomplete"; query: string }
    | { mode: "reverse"; latitude: number; longitude: number },
  signal: AbortSignal,
) {
  const response = await fetch("/api/location/resolve", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    signal,
  });
  const payload = (await response.json()) as
    | LocationAutocompleteResponse
    | LocationReverseResponse
    | LocationApiErrorResponse;

  if (!response.ok || "error" in payload) {
    throw new Error(
      "error" in payload
        ? payload.error.message
        : "Location could not be resolved.",
    );
  }

  return payload;
}

export function ProviderLocationSearchFields({
  initialProvinceCode,
  initialProvinceName,
  initialRegionId,
  initialRegionName,
}: ProviderLocationSearchFieldsProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteControllerRef = useRef<AbortController | null>(null);
  const reverseControllerRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ResolvedSearchLocation[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isSuggestionListOpen, setIsSuggestionListOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] =
    useState<ResolvedSearchLocation | null>(null);
  const [coordinates, setCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [provinceCode, setProvinceCode] = useState(initialProvinceCode);
  const [regionId, setRegionId] = useState(initialRegionId);
  const [status, setStatus] = useState<LocationStatus>(
    initialRegionId && initialRegionName
      ? {
          kind: "resolved",
          message: `Current search area: ${initialRegionName}${
            initialProvinceName ? `, ${initialProvinceName}` : ""
          }.`,
        }
      : {
          kind: "idle",
          message: "Enter a Canadian address or postal code, or place the pin.",
    },
  );
  const [isLocatingDevice, setIsLocatingDevice] = useState(false);

  useEffect(() => {
    return () => {
      autocompleteControllerRef.current?.abort();
      reverseControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (
      !normalizedQuery ||
      normalizedQuery === selectedLocation?.address ||
      normalizedQuery.length < 3
    ) {
      autocompleteControllerRef.current?.abort();
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      autocompleteControllerRef.current?.abort();
      autocompleteControllerRef.current = controller;
      setStatus({
        kind: "loading",
        message: "Searching Canadian addresses...",
      });

      try {
        const payload = await resolveLocation(
          {
            mode: "autocomplete",
            query: normalizedQuery,
          },
          controller.signal,
        );

        if (!("suggestions" in payload)) {
          return;
        }

        setSuggestions(payload.suggestions);
        setActiveSuggestionIndex(payload.suggestions.length > 0 ? 0 : -1);
        setIsSuggestionListOpen(payload.suggestions.length > 0);

        if (payload.suggestions.length === 0) {
          setStatus({
            kind: "error",
            message: payload.rejectedOutsideCanada
              ? "That location is outside Canada. Enter a Canadian address or postal code."
              : "No Canadian address was found. Check the address or place the map pin.",
          });
        } else {
          setStatus({
            kind: "idle",
            message: `${payload.suggestions.length} Canadian address suggestion${
              payload.suggestions.length === 1 ? "" : "s"
            } found.`,
          });
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSuggestions([]);
        setIsSuggestionListOpen(false);
        setStatus({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Address search is temporarily unavailable.",
        });
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedLocation?.address]);

  function clearResolvedLocation() {
    setSelectedLocation(null);
    setCoordinates(null);
    setProvinceCode("");
    setRegionId("");
  }

  function applyLocation(location: ResolvedSearchLocation) {
    setSelectedLocation(location);
    setCoordinates({
      latitude: location.latitude,
      longitude: location.longitude,
    });
    setProvinceCode(location.provinceCode);
    setRegionId(location.regionId);
    setQuery(location.address);
    setSuggestions([]);
    setIsSuggestionListOpen(false);
    setActiveSuggestionIndex(-1);
    inputRef.current?.setCustomValidity("");
    setStatus({
      kind: "resolved",
      message: `Matched to ${location.regionName}, ${location.provinceName}.`,
    });
  }

  async function handleCoordinatesChange(
    nextCoordinates: {
      latitude: number;
      longitude: number;
    },
    source: CoordinateResolveSource = "map",
  ) {
    reverseControllerRef.current?.abort();
    const controller = new AbortController();
    reverseControllerRef.current = controller;
    setCoordinates(nextCoordinates);
    setSelectedLocation(null);
    setProvinceCode("");
    setRegionId("");
    setSuggestions([]);
    setIsSuggestionListOpen(false);
    setStatus({
      kind: "loading",
      message:
        source === "device"
          ? "Matching your current location to a Canadian service region..."
          : "Matching the map pin to a Canadian service region...",
    });

    try {
      const payload = await resolveLocation(
        {
          mode: "reverse",
          ...nextCoordinates,
        },
        controller.signal,
      );

      if ("location" in payload) {
        applyLocation(payload.location);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "That map location could not be resolved.",
      });
    }
  }

  function isGeolocationError(
    error: unknown,
  ): error is GeolocationPositionError {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as GeolocationPositionError).code === "number"
    );
  }

  function getGeolocationErrorMessage(error: GeolocationPositionError) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return "Location permission was denied. You can still search by address or place the pin manually.";
      case error.POSITION_UNAVAILABLE:
        return "Your device location is unavailable right now. Try an address search or place the pin manually.";
      case error.TIMEOUT:
        return "Your device took too long to return a location. Try again or place the pin manually.";
      default:
        return "Your device location could not be read. Try an address search or place the pin manually.";
    }
  }

  async function handleUseDeviceLocation() {
    if (isLocatingDevice) {
      return;
    }

    if (!navigator.geolocation) {
      setStatus({
        kind: "error",
        message:
          "Device location is not available in this browser. Search by address or place the pin manually.",
      });
      return;
    }

    autocompleteControllerRef.current?.abort();
    setSuggestions([]);
    setIsSuggestionListOpen(false);
    setIsLocatingDevice(true);
    setStatus({
      kind: "loading",
      message: "Asking your browser for your current location...",
    });

    try {
      const nextCoordinates = await new Promise<{
        latitude: number;
        longitude: number;
      }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          reject,
          {
            enableHighAccuracy: true,
            maximumAge: 60_000,
            timeout: 12_000,
          },
        );
      });

      await handleCoordinatesChange(nextCoordinates, "device");
    } catch (error) {
      setStatus({
        kind: "error",
        message: isGeolocationError(error)
          ? getGeolocationErrorMessage(error)
          : "Your device location could not be read. Try an address search or place the pin manually.",
      });
    } finally {
      setIsLocatingDevice(false);
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isSuggestionListOpen || suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((currentIndex) =>
        Math.min(currentIndex + 1, suggestions.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((currentIndex) =>
        Math.max(currentIndex - 1, 0),
      );
    } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      applyLocation(suggestions[activeSuggestionIndex]);
    } else if (event.key === "Escape") {
      setIsSuggestionListOpen(false);
    }
  }

  const isResolving = status.kind === "loading" || isLocatingDevice;

  return (
    <section className="border-b border-stone-200 pb-5">
      <input type="hidden" name="province" value={provinceCode} />
      <input type="hidden" name="region" value={regionId} />

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Project location
          </p>
          <h2 className="mt-2 text-lg font-semibold text-stone-950">
            Search by address or postal code
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Select a Canadian address, use your current location, or move the
            pin on the map.
          </p>

          <div className="relative mt-4">
            <label
              htmlFor="provider-search-address"
              className="grid gap-2 text-sm font-semibold text-stone-900"
            >
              Address or postal code
              <input
                ref={inputRef}
                id="provider-search-address"
                type="search"
                value={query}
                onChange={(event) => {
                  const nextQuery = event.target.value;

                  setQuery(nextQuery);
                  if (nextQuery !== selectedLocation?.address) {
                    clearResolvedLocation();
                  }
                  setSuggestions([]);
                  setIsSuggestionListOpen(false);
                  setActiveSuggestionIndex(-1);
                  setStatus({
                    kind: "idle",
                    message:
                      nextQuery.trim().length > 0 &&
                      nextQuery.trim().length < 3
                        ? "Enter at least 3 characters to search Canadian addresses."
                        : nextQuery.trim()
                          ? "Searching will begin after you pause typing."
                          : "Enter a Canadian address or postal code, or place the pin.",
                  });
                  event.target.setCustomValidity(
                    nextQuery.trim()
                      ? "Select a Canadian address suggestion or place the map pin."
                      : "",
                  );
                }}
                onKeyDown={handleInputKeyDown}
                onFocus={() =>
                  setIsSuggestionListOpen(suggestions.length > 0)
                }
                onBlur={() => {
                  window.setTimeout(() => {
                    setIsSuggestionListOpen(false);
                  }, 100);
                }}
                placeholder="Street address or postal code"
                autoComplete="off"
                className={inputClassName}
                role="combobox"
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-expanded={isSuggestionListOpen}
                aria-activedescendant={
                  activeSuggestionIndex >= 0
                    ? `${listboxId}-${activeSuggestionIndex}`
                    : undefined
                }
              />
            </label>

            {isSuggestionListOpen ? (
              <ul
                id={listboxId}
                role="listbox"
                className="absolute z-[1000] mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white p-2 shadow-xl"
              >
                {suggestions.map((suggestion, index) => (
                  <li
                    key={`${suggestion.address}-${suggestion.latitude}-${suggestion.longitude}`}
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={index === activeSuggestionIndex}
                  >
                    <button
                      type="button"
                      className={`w-full rounded-md px-3 py-3 text-left transition ${
                        index === activeSuggestionIndex
                          ? "bg-emerald-50"
                          : "hover:bg-stone-50"
                      }`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                      onClick={() => applyLocation(suggestion)}
                    >
                      <span className="block text-sm font-semibold text-stone-900">
                        {suggestion.address}
                      </span>
                      <span className="mt-1 block text-xs text-emerald-800">
                        {suggestion.regionName}, {suggestion.provinceName}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={handleUseDeviceLocation}
              disabled={isResolving}
            >
              {isLocatingDevice
                ? "Finding your location..."
                : "Use my current location"}
            </button>
            <span className="text-xs leading-5 text-stone-500">
              Browser permission is required. Exact coordinates are not saved
              or submitted with the search.
            </span>
          </div>

          <p
            className={`mt-3 rounded-md border px-3 py-2 text-sm leading-6 ${
              status.kind === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : status.kind === "resolved"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-stone-200 bg-white text-stone-600"
            }`}
            role={status.kind === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {status.message}
          </p>

          <p className="mt-3 text-xs leading-5 text-stone-500">
            Your search location is used only to identify a service region. It
            is not saved or shown to providers.
          </p>
        </div>

        <div>
          <LocationPickerMap
            coordinates={coordinates}
            disabled={isResolving}
            onCoordinatesChange={handleCoordinatesChange}
          />
          <p className="mt-2 text-xs leading-5 text-stone-500">
            Use Recenter, Ontario, or Canada to quickly move the map. Provider
            home addresses are never displayed.
          </p>
        </div>
      </div>
    </section>
  );
}
