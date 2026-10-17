import { LAND } from "./land-dots";

/**
 * A plain equirectangular projection of the Europe – Gulf – East Asia corridor.
 * The frame (VIEW) runs lon −35…128, lat 62…−2; land outside it is still drawn
 * so the map can bleed past the frame on wide screens.
 */
const KX = 9.6; // 1.25° land step → 12 units, so dots fall on a whole-number grid
const KY = 12;
const LON0 = -35;
const LAT0 = 62;

export const VIEW = { w: (128 - LON0) * KX, h: (LAT0 - -2) * KY };

export type Pt = [x: number, y: number];

export function project(lon: number, lat: number): Pt {
  return [(lon - LON0) * KX, (LAT0 - lat) * KY];
}

/**
 * Land as one path. Each run of land cells in a latitude band is a single
 * segment; a "0 12" dash with round caps turns it into a row of dots.
 */
export const LAND_DOT_GAP = LAND.step * KX;
export const landPath = LAND.rows
  .map((row, r) => {
    if (!row) return "";
    const lat = LAND.lat0 - r * LAND.step;
    return row
      .split(" ")
      .map((run) => {
        const [s, n] = run.split(".").map((v) => parseInt(v, 36));
        const [x, y] = project(LAND.lon0 + s * LAND.step, lat);
        return `M${x.toFixed(1)} ${y.toFixed(1)}h${((n - 1) * LAND_DOT_GAP).toFixed(1)}`;
      })
      .join("");
  })
  .join("");

/** Catmull-Rom through the points, as cubic Béziers. */
export function smoothPath(points: Pt[]) {
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** A bowed arc between two points; positive bow lifts it to the left of travel. */
export function arc(a: Pt, b: Pt, bow: number) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const c: Pt = [mx + dy * bow, my - dx * bow];
  const mid: Pt = [0.25 * a[0] + 0.5 * c[0] + 0.25 * b[0], 0.25 * a[1] + 0.5 * c[1] + 0.25 * b[1]];
  return { d: `M${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`, mid };
}

const ll = (pts: [number, number][]) => pts.map(([lon, lat]) => project(lon, lat));

/** Fictional case geography for CASE-0142 (real places, invented companies). */
export const places = {
  ningbo: { label: "Ningbo", cc: "CN", lon: 121.55, lat: 29.87 },
  jebelAli: { label: "Jebel Ali", cc: "AE", lon: 55.03, lat: 25.01 },
  felixstowe: { label: "Felixstowe", cc: "GB", lon: 1.35, lat: 51.96 },
  tamworth: { label: "Tamworth", cc: "GB", lon: -1.69, lat: 52.63 },
  plzen: { label: "Plzeň", cc: "CZ", lon: 13.38, lat: 49.75 },
} as const;
export type PlaceId = keyof typeof places;
export const at = (id: PlaceId) => project(places[id].lon, places[id].lat);

/** Stylised sea lanes: the goods hug the coasts; the money does not. */
export const goodsLegs = {
  first: smoothPath([
    at("ningbo"),
    ...ll([[122.6, 27], [119.8, 24], [114, 17], [108, 9.5], [104.2, 2.2], [99.5, 4.6], [92, 6], [81, 5.4], [71, 11], [61, 20.5], [57, 25.6]]),
    at("jebelAli"),
  ]),
  second: smoothPath([
    at("jebelAli"),
    ...ll([[56.8, 26.3], [59, 22.6], [52, 14.6], [45, 12.2], [42.6, 14.2], [38, 20.6], [34.4, 27.4], [32.5, 30.4], [28, 33.2], [18, 34.9], [8, 37.6], [-1, 36.6], [-6.2, 35.9], [-10.2, 38.4], [-9.9, 43.6], [-5, 47.9], [-1.4, 50.2]]),
    at("felixstowe"),
  ]),
};

export const moneyArcs = {
  in: arc(at("tamworth"), at("jebelAli"), 0.03),
  maker: arc(at("jebelAli"), at("ningbo"), 0.16),
  out: arc(at("jebelAli"), at("plzen"), -0.3),
  owner: arc(at("jebelAli"), at("plzen"), -0.55),
};
