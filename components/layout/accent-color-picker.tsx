"use client";

import { useEffect, useSyncExternalStore } from "react";

type AccentScale = {
  50: string;
  100: string;
  200: string;
  300: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
};

type AccentShade = keyof AccentScale;

type AccentPreset = {
  id: string;
  name: string;
  scale: AccentScale;
};

const accentStorageKey = "myrealhub-accent";
const customAccentStorageKey = "myrealhub-custom-accent";
const defaultAccentId = "green";
const defaultCustomAccent = "#047857";
const accentPreferenceChangedEvent = "myrealhub-accent-preference-changed";
const accentShades: AccentShade[] = [
  50,
  100,
  200,
  300,
  600,
  700,
  800,
  900,
  950,
];

const accentPresets: AccentPreset[] = [
  {
    id: "green",
    name: "Green",
    scale: {
      50: "#ecfdf5",
      100: "#d1fae5",
      200: "#a7f3d0",
      300: "#6ee7b7",
      600: "#059669",
      700: "#047857",
      800: "#065f46",
      900: "#064e3b",
      950: "#022c22",
    },
  },
  {
    id: "blue",
    name: "Blue",
    scale: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
      950: "#172554",
    },
  },
  {
    id: "slate",
    name: "Slate",
    scale: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
      950: "#020617",
    },
  },
  {
    id: "wine",
    name: "Wine",
    scale: {
      50: "#fff1f2",
      100: "#ffe4e6",
      200: "#fecdd3",
      300: "#fda4af",
      600: "#e11d48",
      700: "#be123c",
      800: "#9f1239",
      900: "#881337",
      950: "#4c0519",
    },
  },
  {
    id: "amber",
    name: "Amber",
    scale: {
      50: "#fffbeb",
      100: "#fef3c7",
      200: "#fde68a",
      300: "#fcd34d",
      600: "#d97706",
      700: "#b45309",
      800: "#92400e",
      900: "#78350f",
      950: "#451a03",
    },
  },
];

type Rgb = {
  b: number;
  g: number;
  r: number;
};

type Hsl = {
  h: number;
  l: number;
  s: number;
};

function normalizeHexColor(value: string) {
  const trimmedValue = value.trim();

  if (/^#[0-9a-f]{6}$/i.test(trimmedValue)) {
    return trimmedValue.toLowerCase();
  }

  if (/^#[0-9a-f]{3}$/i.test(trimmedValue)) {
    return `#${trimmedValue
      .slice(1)
      .split("")
      .map((character) => `${character}${character}`)
      .join("")}`.toLowerCase();
  }

  return null;
}

function hexToRgb(value: string): Rgb {
  const normalizedValue = normalizeHexColor(value) ?? defaultCustomAccent;
  const numberValue = Number.parseInt(normalizedValue.slice(1), 16);

  return {
    r: (numberValue >> 16) & 255,
    g: (numberValue >> 8) & 255,
    b: numberValue & 255,
  };
}

function rgbToHex({ r, g, b }: Rgb) {
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(Math.max(0, Math.min(255, channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness };
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5
      ? delta / (2 - max - min)
      : delta / (max + min);
  let hue = 0;

  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return { h: hue / 6, s: saturation, l: lightness };
}

function hueToRgb(p: number, q: number, t: number) {
  let nextT = t;

  if (nextT < 0) {
    nextT += 1;
  }

  if (nextT > 1) {
    nextT -= 1;
  }

  if (nextT < 1 / 6) {
    return p + (q - p) * 6 * nextT;
  }

  if (nextT < 1 / 2) {
    return q;
  }

  if (nextT < 2 / 3) {
    return p + (q - p) * (2 / 3 - nextT) * 6;
  }

  return p;
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const channel = l * 255;

    return { r: channel, g: channel, b: channel };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: hueToRgb(p, q, h + 1 / 3) * 255,
    g: hueToRgb(p, q, h) * 255,
    b: hueToRgb(p, q, h - 1 / 3) * 255,
  };
}

function createCustomAccentScale(color: string): AccentScale {
  const hsl = rgbToHsl(hexToRgb(color));
  const lightnessByShade: AccentScale = {
    50: "",
    100: "",
    200: "",
    300: "",
    600: "",
    700: "",
    800: "",
    900: "",
    950: "",
  };
  const shadeLightness: Record<AccentShade, number> = {
    50: 0.96,
    100: 0.91,
    200: 0.82,
    300: 0.68,
    600: 0.42,
    700: 0.34,
    800: 0.27,
    900: 0.2,
    950: 0.13,
  };

  accentShades.forEach((shade) => {
    lightnessByShade[shade] = rgbToHex(
      hslToRgb({
        h: hsl.h,
        l: shadeLightness[shade],
        s: hsl.s,
      }),
    );
  });

  return lightnessByShade;
}

function getRgbChannels(hexColor: string) {
  const { r, g, b } = hexToRgb(hexColor);

  return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
}

function applyAccentTheme(id: string, scale: AccentScale) {
  const root = document.documentElement;

  accentShades.forEach((shade) => {
    const color = scale[shade];

    root.style.setProperty(`--accent-${shade}`, color);
    root.style.setProperty(`--accent-${shade}-rgb`, getRgbChannels(color));
  });

  root.dataset.accentTheme = id;
}

function getPresetById(id: string | null) {
  return (
    accentPresets.find((preset) => preset.id === id) ?? accentPresets[0]
  );
}

function getAccentPreferenceSnapshot() {
  if (typeof window === "undefined") {
    return `${defaultAccentId}|${defaultCustomAccent}`;
  }

  const savedAccentId = window.localStorage.getItem(accentStorageKey);
  const savedCustomAccent =
    normalizeHexColor(
      window.localStorage.getItem(customAccentStorageKey) ?? "",
    ) ?? defaultCustomAccent;
  const savedPreset = accentPresets.find((preset) => preset.id === savedAccentId);
  const selectedAccentId =
    savedAccentId === "custom" || savedPreset
      ? (savedAccentId ?? defaultAccentId)
      : defaultAccentId;

  return `${selectedAccentId}|${savedCustomAccent}`;
}

function subscribeToAccentPreference(listener: () => void) {
  window.addEventListener(accentPreferenceChangedEvent, listener);

  return () => {
    window.removeEventListener(accentPreferenceChangedEvent, listener);
  };
}

function saveAccentPreference(id: string, customAccent: string) {
  window.localStorage.setItem(accentStorageKey, id);
  window.localStorage.setItem(customAccentStorageKey, customAccent);
  window.dispatchEvent(new Event(accentPreferenceChangedEvent));
}

function getAccentScale(id: string, customAccent: string) {
  if (id === "custom") {
    return createCustomAccentScale(customAccent);
  }

  return getPresetById(id).scale;
}

export function AccentColorPicker() {
  const accentPreference = useSyncExternalStore(
    subscribeToAccentPreference,
    getAccentPreferenceSnapshot,
    () => `${defaultAccentId}|${defaultCustomAccent}`,
  );
  const [selectedAccentId = defaultAccentId, customAccent = defaultCustomAccent] =
    accentPreference.split("|");
  const normalizedCustomAccent =
    normalizeHexColor(customAccent) ?? defaultCustomAccent;

  useEffect(() => {
    applyAccentTheme(
      selectedAccentId,
      getAccentScale(selectedAccentId, normalizedCustomAccent),
    );
  }, [normalizedCustomAccent, selectedAccentId]);

  function selectPreset(preset: AccentPreset) {
    saveAccentPreference(preset.id, normalizedCustomAccent);
    applyAccentTheme(preset.id, preset.scale);
  }

  function selectCustomAccent(value: string) {
    const nextAccent = normalizeHexColor(value);

    if (!nextAccent) {
      return;
    }

    saveAccentPreference("custom", nextAccent);
    applyAccentTheme("custom", createCustomAccentScale(nextAccent));
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-2 py-1.5">
      <span className="text-xs font-semibold text-stone-600">Accent</span>
      <div
        className="flex items-center gap-1.5"
        role="radiogroup"
        aria-label="Accent color"
      >
        {accentPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`size-5 rounded-full border border-white shadow-sm ring-offset-2 transition focus:outline-none focus:ring-2 focus:ring-stone-900 ${
              selectedAccentId === preset.id
                ? "ring-2 ring-stone-900"
                : "ring-1 ring-stone-300"
            }`}
            style={{ backgroundColor: preset.scale[700] }}
            onClick={() => selectPreset(preset)}
            aria-label={`${preset.name} accent`}
            aria-pressed={selectedAccentId === preset.id}
            title={preset.name}
          />
        ))}
        <label
          className={`relative grid size-6 cursor-pointer place-items-center rounded-full border border-white shadow-sm ring-offset-2 transition focus-within:ring-2 focus-within:ring-stone-900 ${
            selectedAccentId === "custom"
              ? "ring-2 ring-stone-900"
              : "ring-1 ring-stone-300"
          }`}
          title="Custom"
        >
          <span
            className="size-full rounded-full"
            style={{ backgroundColor: normalizedCustomAccent }}
            aria-hidden="true"
          />
          <input
            type="color"
            value={normalizedCustomAccent}
            onChange={(event) => selectCustomAccent(event.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label="Custom accent color"
          />
        </label>
      </div>
    </div>
  );
}
