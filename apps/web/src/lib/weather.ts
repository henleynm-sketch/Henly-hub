import type { LucideIcon } from "lucide-react";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudHail,
} from "lucide-react";

// WMO weather interpretation codes (Open-Meteo `weather_code`) → label + icon.
const WMO: Record<number, { label: string; icon: LucideIcon }> = {
  0: { label: "Clear", icon: Sun },
  1: { label: "Mainly clear", icon: Sun },
  2: { label: "Partly cloudy", icon: CloudSun },
  3: { label: "Overcast", icon: Cloud },
  45: { label: "Fog", icon: CloudFog },
  48: { label: "Rime fog", icon: CloudFog },
  51: { label: "Light drizzle", icon: CloudDrizzle },
  53: { label: "Drizzle", icon: CloudDrizzle },
  55: { label: "Heavy drizzle", icon: CloudDrizzle },
  56: { label: "Freezing drizzle", icon: CloudDrizzle },
  57: { label: "Freezing drizzle", icon: CloudDrizzle },
  61: { label: "Light rain", icon: CloudRain },
  63: { label: "Rain", icon: CloudRain },
  65: { label: "Heavy rain", icon: CloudRain },
  66: { label: "Freezing rain", icon: CloudRain },
  67: { label: "Freezing rain", icon: CloudRain },
  71: { label: "Light snow", icon: CloudSnow },
  73: { label: "Snow", icon: CloudSnow },
  75: { label: "Heavy snow", icon: CloudSnow },
  77: { label: "Snow grains", icon: CloudSnow },
  80: { label: "Light showers", icon: CloudRain },
  81: { label: "Showers", icon: CloudRain },
  82: { label: "Violent showers", icon: CloudRain },
  85: { label: "Snow showers", icon: CloudSnow },
  86: { label: "Snow showers", icon: CloudSnow },
  95: { label: "Thunderstorm", icon: CloudLightning },
  96: { label: "Thunderstorm w/ hail", icon: CloudHail },
  99: { label: "Thunderstorm w/ hail", icon: CloudHail },
};

export function wmo(code: number | null | undefined): { label: string; icon: LucideIcon } {
  return WMO[code ?? -1] ?? { label: "—", icon: Cloud };
}

export type Forecast = {
  current: { temp: number; code: number };
  hourly: { time: string; temp: number; code: number; precip: number }[];
  daily: { date: string; max: number; min: number; code: number; precip: number }[];
};

/**
 * Open-Meteo forecast (keyless). Cached 30 min via Next fetch revalidation —
 * never per-render upstream calls. Returns null on any failure (caller shows
 * a quiet unavailable line; stale data is never presented as live).
 */
export async function fetchForecast(lat: number, lng: number): Promise<Forecast | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current=temperature_2m,weather_code` +
    `&hourly=temperature_2m,precipitation_probability,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
    `&timezone=America%2FToronto&forecast_days=7`;
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number; time?: string };
      hourly?: {
        time?: string[];
        temperature_2m?: number[];
        precipitation_probability?: number[];
        weather_code?: number[];
      };
      daily?: {
        time?: string[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: number[];
        weather_code?: number[];
      };
    };
    if (d.current?.temperature_2m === undefined) return null;

    const nowIso = d.current.time ?? new Date().toISOString().slice(0, 13) + ":00";
    const hTimes = d.hourly?.time ?? [];
    const startIdx = Math.max(0, hTimes.findIndex((t) => t >= nowIso));
    const hourly = hTimes.slice(startIdx, startIdx + 12).map((time, i) => ({
      time,
      temp: d.hourly?.temperature_2m?.[startIdx + i] ?? 0,
      code: d.hourly?.weather_code?.[startIdx + i] ?? -1,
      precip: d.hourly?.precipitation_probability?.[startIdx + i] ?? 0,
    }));
    const daily = (d.daily?.time ?? []).map((date, i) => ({
      date,
      max: d.daily?.temperature_2m_max?.[i] ?? 0,
      min: d.daily?.temperature_2m_min?.[i] ?? 0,
      code: d.daily?.weather_code?.[i] ?? -1,
      precip: d.daily?.precipitation_probability_max?.[i] ?? 0,
    }));
    return { current: { temp: d.current.temperature_2m, code: d.current.weather_code ?? -1 }, hourly, daily };
  } catch {
    return null;
  }
}
