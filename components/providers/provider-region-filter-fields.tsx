"use client";

import { useMemo, useState } from "react";
import type {
  CanadianSubdivisionOption,
  ServiceRegionOption,
} from "@/lib/service-regions";

type ProviderRegionFilterFieldsProps = {
  initialProvinceCode?: string;
  initialRegionId?: string;
  regions: ServiceRegionOption[];
  subdivisions: CanadianSubdivisionOption[];
  variant?: "homepage" | "search";
};

export function ProviderRegionFilterFields({
  initialProvinceCode = "",
  initialRegionId = "",
  regions,
  subdivisions,
  variant = "search",
}: ProviderRegionFilterFieldsProps) {
  const initialRegion = regions.find((region) => region.id === initialRegionId);
  const safeInitialProvinceCode = subdivisions.some(
    (subdivision) => subdivision.code === initialProvinceCode,
  )
    ? initialProvinceCode
    : (initialRegion?.province_code ?? "");
  const safeInitialRegionId =
    initialRegion?.province_code === safeInitialProvinceCode
      ? initialRegion.id
      : "";
  const [provinceCode, setProvinceCode] = useState(safeInitialProvinceCode);
  const [regionId, setRegionId] = useState(safeInitialRegionId);
  const provinceByCode = useMemo(
    () =>
      new Map(
        subdivisions.map((subdivision) => [
          subdivision.code,
          subdivision.name,
        ]),
      ),
    [subdivisions],
  );
  const provinceRegions = regions.filter(
    (region) => region.province_code === provinceCode,
  );
  const isHomepage = variant === "homepage";
  const labelClassName = isHomepage
    ? "min-w-0"
    : "flex flex-col gap-2 text-sm font-medium text-stone-800";
  const labelTextClassName = isHomepage ? "sr-only" : "";
  const selectClassName = `${
    isHomepage ? "h-12" : "h-11"
  } w-full min-w-0 rounded-md border ${
    isHomepage ? "border-stone-200 px-4 text-base" : "border-stone-300 px-3 text-sm"
  } bg-white text-stone-950 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500`;
  const provinceName = provinceByCode.get(provinceCode);

  return (
    <>
      <label htmlFor={`${variant}-provider-province`} className={labelClassName}>
        <span className={labelTextClassName}>Province or territory</span>
        <select
          id={`${variant}-provider-province`}
          name="province"
          value={provinceCode}
          onChange={(event) => {
            setProvinceCode(event.target.value);
            setRegionId("");
          }}
          className={selectClassName}
        >
          <option value="">All provinces and territories</option>
          {subdivisions.map((subdivision) => (
            <option key={subdivision.code} value={subdivision.code}>
              {subdivision.name}
            </option>
          ))}
        </select>
      </label>

      <label
        htmlFor={`${variant}-provider-service-region`}
        className={labelClassName}
      >
        <span className={labelTextClassName}>Service region</span>
        <select
          id={`${variant}-provider-service-region`}
          name="region"
          value={regionId}
          onChange={(event) => setRegionId(event.target.value)}
          className={selectClassName}
          disabled={!provinceCode}
        >
          <option value="">
            {provinceName
              ? `All regions in ${provinceName}`
              : "Select a province or territory first"}
          </option>
          {provinceRegions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
