import "server-only";

/**
 * Keyless geocoding via Nominatim (OpenStreetMap). Usage policy: descriptive
 * User-Agent required, max 1 req/sec — geocoding is on-demand per job and the
 * result is persisted on Project; NEVER call this per page load or in bulk.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "HenleyHub/1.0 (hello@henleycontracting.com)";

export class GeocodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeocodeError";
  }
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const q = address.trim();
  if (!q) return null;
  const url = `${NOMINATIM_URL}?format=jsonv2&q=${encodeURIComponent(q)}&limit=1&countrycodes=ca`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) throw new GeocodeError(`Nominatim HTTP ${res.status}: ${text.slice(0, 300)}`);
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new GeocodeError(`Nominatim returned non-JSON: ${text.slice(0, 200)}`);
    }
    const first = Array.isArray(data) ? (data[0] as { lat?: string; lon?: string } | undefined) : undefined;
    if (!first?.lat || !first?.lon) return null;
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  } catch (err) {
    if (err instanceof GeocodeError) throw err;
    throw new GeocodeError(err instanceof Error ? err.message : "Geocoding failed");
  } finally {
    clearTimeout(timer);
  }
}

export function googleMapsUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address ?? "")}`;
}

export function osmEmbedUrl(lat: number, lng: number): string {
  const d = 0.004; // ~400m box
  const bbox = [lng - d, lat - d, lng + d, lat + d].map((n) => n.toFixed(6)).join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lng.toFixed(6)}`;
}
