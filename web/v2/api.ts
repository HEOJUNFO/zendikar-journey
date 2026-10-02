import type { WorldV2View } from '../../sim/footprint.ts';

export async function getWorldV2(): Promise<WorldV2View> {
  const res = await fetch('/api/v2/world');
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as WorldV2View;
}

export const refUrl = (image: string) => `/api/v2/ref/${encodeURIComponent(image)}`;
