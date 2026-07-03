import { fetchForecast, wmo } from "@/lib/weather";

// Server component. Renders only when coords exist (the Location card owns
// the geocode CTA). Open-Meteo response is cached 30 min via fetch
// revalidation; failures show one quiet line — never stale-as-live.
export default async function WeatherCard({ lat, lng }: { lat: number; lng: number }) {
  const f = await fetchForecast(lat, lng);

  if (!f) {
    return (
      <section className="hh-panel p-5">
        <h2 className="hh-label">Site weather</h2>
        <p className="hh-secondary mt-2">Weather unavailable.</p>
      </section>
    );
  }

  const now = wmo(f.current.code);
  const NowIcon = now.icon;

  return (
    <section className="hh-panel p-5 flex flex-col gap-4">
      <h2 className="hh-label">Site weather</h2>

      <div className="flex items-center gap-3">
        <NowIcon size={36} className="opacity-80" />
        <div>
          <div className="hh-display text-3xl font-bold text-ink">{Math.round(f.current.temp)}°C</div>
          <div className="hh-secondary">{now.label}</div>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {f.hourly.map((h) => {
          const w = wmo(h.code);
          const HourIcon = w.icon;
          const hour = new Date(h.time).toLocaleTimeString("en-CA", { hour: "numeric", hour12: true });
          return (
            <div key={h.time} className="flex flex-col items-center gap-1 shrink-0 w-12" title={w.label}>
              <span className="hh-caption">{hour}</span>
              <HourIcon size={16} className="opacity-70" />
              <span className="hh-secondary tabular-nums">{Math.round(h.temp)}°</span>
              {h.precip > 20 && <span className="hh-caption tabular-nums">{h.precip}%</span>}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 border-t border-glass-border pt-3">
        {f.daily.map((d) => {
          const w = wmo(d.code);
          const DayIcon = w.icon;
          const day = new Date(d.date + "T12:00:00").toLocaleDateString("en-CA", { weekday: "short" });
          return (
            <div key={d.date} className="flex flex-col items-center gap-1 shrink-0 w-14" title={w.label}>
              <span className="hh-caption uppercase">{day}</span>
              <DayIcon size={16} className="opacity-70" />
              <span className="hh-secondary tabular-nums">
                {Math.round(d.max)}° <span className="opacity-60">{Math.round(d.min)}°</span>
              </span>
              <span className="hh-caption tabular-nums">{d.precip}%</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
