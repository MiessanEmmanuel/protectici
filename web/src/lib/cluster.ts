/** Regroupement de marqueurs par grille en pixels (Web Mercator). Pur et testable. */

export interface Point {
  slug: string;
  name: string;
  lat: number;
  lng: number;
}

export interface Cluster {
  key: string;
  lat: number;
  lng: number;
  count: number;
  members: Point[];
}

function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = 256 * 2 ** zoom;
  const sin = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

export function clusterPoints(points: Point[], zoom: number, cellPx = 60): Cluster[] {
  const cells = new Map<string, Point[]>();
  for (const p of points) {
    const { x, y } = project(p.lat, p.lng, zoom);
    const key = `${Math.floor(x / cellPx)}:${Math.floor(y / cellPx)}`;
    const bucket = cells.get(key);
    if (bucket) bucket.push(p);
    else cells.set(key, [p]);
  }
  return Array.from(cells.entries()).map(([key, members]) => ({
    key,
    lat: members.reduce((n, m) => n + m.lat, 0) / members.length,
    lng: members.reduce((n, m) => n + m.lng, 0) / members.length,
    count: members.length,
    members,
  }));
}
