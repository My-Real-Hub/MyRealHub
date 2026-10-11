"use client";

import { useActionState, useMemo, useState } from "react";
import { saveProviderServiceRegions } from "@/app/settings/actions";
import {
  MAX_PROVIDER_SERVICE_REGIONS,
  type ServiceRegionOption,
  type SubdivisionOption,
} from "@/lib/service-regions";

type ProviderServiceRegionsFormProps = {
  providerProfileId: string | null;
  regions: ServiceRegionOption[];
  selectedRegionIds: string[];
  subdivisions: SubdivisionOption[];
};

const initialState = {
  status: "idle" as const,
  message: "",
  fieldError: "",
};

const inputClassName = "settings-input";

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
  const hasReachedLimit = selectedIds.length >= MAX_PROVIDER_SERVICE_REGIONS;

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
      className="settings-section settings-card"
    >
      {selectedIds.map((regionId) => (
        <input
          key={regionId}
          type="hidden"
          name="serviceRegionIds"
          value={regionId}
        />
      ))}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">
            Service areas
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">
            Choose up to {MAX_PROVIDER_SERVICE_REGIONS} regions where customers
            can find your services.
          </p>
        </div>
        <span className="w-fit shrink-0 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-600">
          {selectedIds.length} of {MAX_PROVIDER_SERVICE_REGIONS} selected
        </span>
      </div>

      {state.status !== "idle" ? (
        <p
          className={`mt-5 rounded-xl border px-4 py-3 text-sm leading-6 ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
      {!providerProfileId ? (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Save your{" "}
          <a
            href="#provider-business"
            className="font-semibold underline underline-offset-2"
          >
            business listing
          </a>{" "}
          before choosing service regions.
        </p>
      ) : null}

      <div className="mt-5 rounded-xl bg-stone-50 p-4">
        <h3 className="text-sm font-medium text-stone-700">
          Your selected regions
        </h3>
        <div className="mt-3 flex min-h-9 flex-wrap gap-2">
          {selectedRegions.length > 0 ? (
            selectedRegions.map((region) => (
              <span
                key={region.id}
                className="inline-flex max-w-full items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-1 pl-3 pr-1 text-sm font-medium text-emerald-900"
              >
                <span className="min-w-0 break-words">{region.name}</span>
                <button
                  type="button"
                  onClick={() => toggleRegion(region.id)}
                  disabled={pending}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-lg text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={`Remove ${region.name}`}
                >
                  ×
                </button>
              </span>
            ))
          ) : (
            <p className="text-sm leading-6 text-stone-500">
              No regions selected yet.
            </p>
          )}
        </div>
        {hasReachedLimit ? (
          <p className="mt-2 text-xs leading-5 text-stone-500">
            Remove a selected region to choose another.
          </p>
        ) : null}
        {state.fieldError ? (
          <p className="mt-2 text-sm font-medium text-red-700" role="alert">
            {state.fieldError}
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid min-w-0 gap-2 text-sm font-medium text-stone-800">
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
        <label className="grid min-w-0 gap-2 text-sm font-medium text-stone-800">
          Search service regions
          <input
            type="search"
            value={regionSearch}
            onChange={(event) => setRegionSearch(event.target.value)}
            placeholder="Search by region name"
            className={inputClassName}
            disabled={!providerProfileId || pending}
          />
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className="mb-3 text-sm font-medium text-stone-800">
          Available service regions
        </legend>
        <div className="grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-stone-200 p-2 sm:grid-cols-2">
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
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${isDisabled ? "cursor-not-allowed text-stone-400" : "cursor-pointer text-stone-700 hover:bg-emerald-50"} ${isSelected ? "bg-emerald-50 text-emerald-900" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => toggleRegion(region.id)}
                    className="size-4 shrink-0 rounded border-stone-300 accent-emerald-700 focus:ring-emerald-100"
                  />
                  <span className="min-w-0">{region.name}</span>
                </label>
              );
            })
          ) : (
            <p className="col-span-full px-3 py-8 text-center text-sm text-stone-500">
              No service regions match your search.
            </p>
          )}
        </div>
      </fieldset>

      <div className="mt-6 flex flex-col gap-3 border-t border-stone-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-stone-500">
          These regions appear on your listing and in directory searches.
        </p>
        <button
          type="submit"
          disabled={!providerProfileId || pending}
          className="settings-primary-button shrink-0"
        >
          {pending ? "Saving regions..." : "Save service regions"}
        </button>
      </div>
    </form>
  );
}
