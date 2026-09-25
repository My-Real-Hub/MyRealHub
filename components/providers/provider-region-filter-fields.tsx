"use client";

import { useMemo, useState } from "react";
import type {
  ServiceRegionOption,
  SubdivisionOption,
} from "@/lib/service-regions";

type ProviderRegionFilterFieldsProps = {
  initialProvinceCode?: string;
  initialRegionId?: string;
  regions: ServiceRegionOption[];
  subdivisions: SubdivisionOption[];
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
        subdivisions.map((subdivision, index) => [
          subdivision.code,
          `Region group ${index + 1}`,
        ]),
      ),
    [subdivisions],
  );
  const provinceRegions = regions.filter(
    (region) => region.province_code === provinceCode,
  );
  const isHomepage = variant === "homepage";
  const labelClassName = isHomepage
    ? "flex min-w-0 flex-col gap-2 text-sm font-semibold text-stone-700"
    : "flex flex-col gap-2 text-sm font-medium text-stone-800";
  const labelTextClassName = "";
  const homepageFocusClassName = "focus:border-teal-700 focus:ring-teal-100";
  const searchFocusClassName = "focus:border-emerald-700 focus:ring-emerald-100";
  const selectClassName = `${
    isHomepage ? "h-12" : "h-11"
  } w-full min-w-0 rounded-md border ${
    isHomepage ? "border-stone-300 px-3 text-base" : "border-stone-300 px-3 text-sm"
  } bg-white text-stone-950 outline-none transition ${
    isHomepage ? homepageFocusClassName : searchFocusClassName
  } focus:ring-4 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500`;
  const provinceName = provinceByCode.get(provinceCode);

  return (
    <>
      <label htmlFor={`${variant}-provider-province`} className={labelClassName}>
        <span className={labelTextClassName}>Region group</span>
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
          <option value="">All region groups</option>
          {subdivisions.map((subdivision, index) => (
            <option key={subdivision.code} value={subdivision.code}>
              Region group {index + 1}
            </option>
          ))}
        </select>
      </label>

      <label
        htmlFor={`${variant}-provider-service-region`}
        className={labelClassName}
      >
        <span className={labelTextClassName}>
          {isHomepage ? "Area" : "Service region"}
        </span>
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
              : isHomepage
                ? "Select region group first"
                : "Select a region group first"}
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
