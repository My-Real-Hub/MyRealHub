"use client";

import { useActionState, useMemo, useState } from "react";
import { saveProviderServiceRegions } from "@/app/settings/actions";
import {
  MAX_PROVIDER_SERVICE_REGIONS,
  type CanadianSubdivisionOption,
  type ServiceRegionOption,
} from "@/lib/service-regions";

type ProviderServiceRegionsFormProps = {
  providerProfileId: string | null;
  regions: ServiceRegionOption[];
  selectedRegionIds: string[];
  subdivisions: CanadianSubdivisionOption[];
};

const initialState = {
  status: "idle" as const,
  message: "",
  fieldError: "",
};

const inputClassName =
  "h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";

export function ProviderServiceRegionsForm({
  providerProfileId,
  regions,
  selectedRegionIds,
  subdivisions,
}: ProviderServiceRegionsFormProps) {
  const initialProvinceCode =
    regions.find((region) => selectedRegionIds.includes(region.id))
      ?.province_code ??
    subdivisions.find((subdivision) => subdivision.code === "ON")?.code ??
    subdivisions[0]?.code ??
    "";
  const [state, formAction, pending] = useActionState(
    saveProviderServiceRegions,
    initialState,
  );
  const [provinceCode, setProvinceCode] = useState(initialProvinceCode);
  const [regionSearch, setRegionSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(
    Array.from(new Set(selectedRegionIds)).slice(
      0,
      MAX_PROVIDER_SERVICE_REGIONS,
    ),
  );
  const regionById = useMemo(
    () => new Map(regions.map((region) => [region.id, region])),
    [regions],
  );
  const subdivisionByCode = useMemo(
    () =>
      new Map(
        subdivisions.map((subdivision) => [
          subdivision.code,
          subdivision,
        ]),
      ),
    [subdivisions],
  );
  const normalizedSearch = regionSearch.trim().toLocaleLowerCase("en-CA");
  const visibleRegions = regions.filter(
    (region) =>
      region.province_code === provinceCode &&
      (!normalizedSearch ||
        region.name.toLocaleLowerCase("en-CA").includes(normalizedSearch)),
  );
  const selectedRegions = selectedIds
    .map((regionId) => regionById.get(regionId))
    .filter((region): region is ServiceRegionOption => Boolean(region));
  const hasReachedLimit =
    selectedIds.length >= MAX_PROVIDER_SERVICE_REGIONS;

  function toggleRegion(regionId: string) {
    setSelectedIds((currentIds) => {
      if (currentIds.includes(regionId)) {
        return currentIds.filter((currentId) => currentId !== regionId);
      }

      if (currentIds.length >= MAX_PROVIDER_SERVICE_REGIONS) {
        return currentIds;
      }

      return [...currentIds, regionId];
    });
  }

  return (
    <form
      id="service-areas"
      action={formAction}
      className="scroll-mt-28 rounded-lg border border-stone-200 bg-stone-50 p-5"
    >
      {selectedIds.map((regionId) => (
        <input
          key={regionId}
          type="hidden"
          name="serviceRegionIds"
          value={regionId}
        />
      ))}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Service areas
          </p>
          <h3 className="mt-2 text-lg font-semibold text-stone-950">
            Canadian regions you serve
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Choose up to {MAX_PROVIDER_SERVICE_REGIONS} regions. These appear
            on your public profile and help clients find you in search.
          </p>
        </div>
        <span className="w-fit rounded-md bg-white px-3 py-1 text-xs font-semibold text-stone-600 ring-1 ring-inset ring-stone-200">
          {selectedIds.length}/{MAX_PROVIDER_SERVICE_REGIONS} selected
        </span>
      </div>

      {state.status !== "idle" ? (
        <p
          className={`mt-5 rounded-md border px-4 py-3 text-sm leading-6 ${
            state.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}

      {!providerProfileId ? (
        <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Save your public listing details below before choosing service
          regions.
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-stone-900">
          Province or territory
          <select
            value={provinceCode}
            onChange={(event) => {
              setProvinceCode(event.target.value);
              setRegionSearch("");
            }}
            className={inputClassName}
            disabled={!providerProfileId || pending}
          >
            {subdivisions.map((subdivision) => (
              <option key={subdivision.code} value={subdivision.code}>
                {subdivision.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-semibold text-stone-900">
          Search this province or territory
          <input
            type="search"
            value={regionSearch}
            onChange={(event) => setRegionSearch(event.target.value)}
            placeholder="Search service regions"
            className={inputClassName}
            disabled={!providerProfileId || pending}
          />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="sr-only">Available service regions</legend>
        <div className="grid max-h-56 gap-2 overflow-y-auto rounded-md border border-stone-200 bg-white p-2 sm:grid-cols-2">
          {visibleRegions.length > 0 ? (
            visibleRegions.map((region) => {
              const isSelected = selectedIds.includes(region.id);
              const isDisabled =
                !providerProfileId ||
                pending ||
                (hasReachedLimit && !isSelected);

              return (
                <label
                  key={region.id}
                  className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                    isDisabled
                      ? "cursor-not-allowed text-stone-400"
                      : "cursor-pointer text-stone-800 hover:bg-emerald-50"
                  } ${isSelected ? "bg-emerald-50 text-emerald-950" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => toggleRegion(region.id)}
                    className="size-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-100"
                  />
                  <span>{region.name}</span>
                </label>
              );
            })
          ) : (
            <p className="col-span-full px-3 py-8 text-center text-sm text-stone-600">
              No service regions match your search.
            </p>
          )}
        </div>
      </fieldset>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Selected regions
        </p>
        <div className="mt-2 flex min-h-10 flex-wrap gap-2">
          {selectedRegions.length > 0 ? (
            selectedRegions.map((region) => (
              <span
                key={region.id}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-950"
              >
                <span>
                  {region.name},{" "}
                  {subdivisionByCode.get(region.province_code)?.code}
                </span>
                <button
                  type="button"
                  onClick={() => toggleRegion(region.id)}
                  disabled={pending}
                  className="rounded text-emerald-700 transition hover:text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  aria-label={`Remove ${region.name}`}
                >
                  ×
                </button>
              </span>
            ))
          ) : (
            <p className="text-sm text-stone-500">
              No service regions selected.
            </p>
          )}
        </div>
        {state.fieldError ? (
          <p className="mt-2 text-sm font-medium text-red-700" role="alert">
            {state.fieldError}
          </p>
        ) : null}
        {hasReachedLimit ? (
          <p className="mt-2 text-xs font-medium text-stone-500">
            Remove a selected region before choosing another.
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex justify-end border-t border-stone-200 pt-5">
        <button
          type="submit"
          disabled={!providerProfileId || pending}
          className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {pending ? "Saving regions..." : "Save service regions"}
        </button>
      </div>
    </form>
  );
}
