/**
 * Body regions calibrated to body-front.webp and body-back.webp (both 1024 x 1536).
 * Shapes are authored in image pixels, then converted to percentage polygons.
 *
 * Left/right is the PATIENT's side:
 *  - front view: the patient's right is the viewer's left (x < 512)
 *  - back view:  the patient's left is the viewer's left (x < 512)
 */
export type View = 'front' | 'back'
export type Pt = [number, number]

export interface Region {
  id: string
  /** Display name, e.g. "Right knee" */
  name: string
  view: View
  /** Polygon in percentage coordinates (0-100) of the image */
  polygon: Pt[]
}

const W = 1024
const H = 1536
const CX = 512
const pct = (p: Pt): Pt => [+((p[0] / W) * 100).toFixed(2), +((p[1] / H) * 100).toFixed(2)]
const mirror = (poly: Pt[]): Pt[] => poly.map(([x, y]) => [W - x, y] as Pt).reverse()

/** A tapered limb segment from a to b with widths wa and wb, slightly extended so neighbours overlap. */
function seg(a: Pt, b: Pt, wa: number, wb: number): Pt[] {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux
  const ext = 4
  const a2: Pt = [a[0] - ux * ext, a[1] - uy * ext]
  const b2: Pt = [b[0] + ux * ext, b[1] + uy * ext]
  return [
    [a2[0] + (nx * wa) / 2, a2[1] + (ny * wa) / 2],
    [b2[0] + (nx * wb) / 2, b2[1] + (ny * wb) / 2],
    [b2[0] - (nx * wb) / 2, b2[1] - (ny * wb) / 2],
    [a2[0] - (nx * wa) / 2, a2[1] - (ny * wa) / 2],
  ]
}

interface Def {
  id: string
  /** viewer-left / viewer-right label prefix handled by `side` */
  label: string
  poly: Pt[]
  /** 'pair': authored on the viewer-left (x < 512) and mirrored to the viewer-right */
  kind: 'pair' | 'single'
}

const pair = (id: string, label: string, poly: Pt[]): Def => ({ id, label, poly, kind: 'pair' })
const single = (id: string, label: string, poly: Pt[]): Def => ({ id, label, poly, kind: 'single' })

// Shared limb geometry (identical on both images)
const limbs = (shin: string): Def[] => [
  pair('ear', 'ear', [[438, 210], [458, 210], [458, 270], [444, 266]]),
  pair('hand', 'hand', seg([270, 782], [256, 892], 62, 58)),
  pair('forearm', 'forearm', seg([326, 658], [268, 790], 60, 46)),
  pair('elbow', 'elbow', seg([338, 596], [325, 668], 70, 62)),
  pair('upper-arm', 'upper arm', seg([374, 446], [338, 606], 64, 68)),
  pair('foot', 'foot', [[386, 1392], [472, 1392], [476, 1458], [382, 1458]]),
  pair('ankle', 'ankle', seg([434, 1330], [432, 1396], 46, 44)),
  pair(shin, shin, seg([441, 1116], [434, 1336], 68, 46)),
  pair('knee', 'knee', seg([443, 1024], [440, 1124], 80, 68)),
  pair('thigh', 'thigh', seg([456, 850], [444, 1034], 106, 80)),
]

const FRONT: Def[] = [
  ...limbs('shin'),
  pair('shoulder', 'shoulder', [[444, 364], [398, 372], [346, 394], [330, 452], [404, 458], [424, 402]]),
  pair('hip', 'hip', [[386, 745], [416, 745], [446, 852], [440, 872], [398, 862]]),
  pair('neck', 'neck', [[468, 330], [492, 340], [488, 392], [432, 382]]),
  single('throat', 'throat', [[491, 338], [533, 338], [538, 390], [486, 390]]),
  single('jaw', 'jaw', [[466, 298], [558, 298], [536, 342], [488, 342]]),
  single('face', 'face', [[458, 204], [566, 204], [562, 300], [462, 300]]),
  single('head', 'head', [[470, 128], [555, 128], [580, 172], [582, 206], [444, 206], [444, 172]]),
  single('pelvis', 'pelvis', [[414, 745], [610, 745], [582, 852], [512, 874], [442, 852]]),
  single('lower-stomach', 'lower stomach', [[404, 640], [620, 640], [610, 745], [414, 745]]),
  single('upper-stomach', 'upper stomach', [[404, 545], [620, 545], [620, 640], [404, 640]]),
  single('chest', 'chest', [[408, 392], [616, 392], [622, 545], [402, 545]]),
]

const BACK: Def[] = [
  ...limbs('calf'),
  pair('shoulder', 'shoulder', [[444, 364], [398, 372], [346, 394], [330, 452], [404, 458], [424, 402]]),
  pair('hip', 'hip', [[388, 690], [414, 700], [420, 852], [398, 862]]),
  single('neck', 'neck', [[468, 330], [556, 330], [572, 380], [450, 380]]),
  single('head', 'head', [[470, 128], [555, 128], [580, 172], [582, 206], [570, 305], [455, 305], [444, 206], [444, 172]]),
  single('buttocks', 'buttocks', [[414, 700], [610, 700], [606, 852], [512, 868], [418, 852]]),
  single('lower-back', 'lower back', [[406, 568], [618, 568], [612, 700], [412, 700]]),
  single('upper-back', 'upper back', [[408, 380], [616, 380], [620, 568], [404, 568]]),
]

function build(view: View, defs: Def[]): Region[] {
  const side = (viewerLeft: boolean) => {
    // front: viewer-left is the patient's right. back: viewer-left is the patient's left.
    const patientRight = view === 'front' ? viewerLeft : !viewerLeft
    return patientRight ? 'Right' : 'Left'
  }
  const out: Region[] = []
  for (const d of defs) {
    if (d.kind === 'single') {
      out.push({ id: d.id, name: cap(d.label), view, polygon: d.poly.map(pct) })
    } else {
      out.push({ id: `${d.id}-r`, name: `${side(true)} ${d.label}`, view, polygon: d.poly.map(pct) })
      out.push({ id: `${d.id}-l`, name: `${side(false)} ${d.label}`, view, polygon: mirror(d.poly).map(pct) })
    }
  }
  // region ids encode the patient's side, so rewrite r/l to the patient's side
  return out.map((r) => {
    if (r.id.endsWith('-r') || r.id.endsWith('-l')) {
      const base = r.id.slice(0, -2)
      const patientSide = r.name.startsWith('Right') ? 'right' : 'left'
      return { ...r, id: `${base}-${patientSide}-${view}` }
    }
    return { ...r, id: `${r.id}-${view}` }
  })
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const REGIONS: Record<View, Region[]> = {
  front: build('front', FRONT),
  back: build('back', BACK),
}

export function pointInPolygon([x, y]: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const centroid = (poly: Pt[]): Pt => [
  poly.reduce((s, p) => s + p[0], 0) / poly.length,
  poly.reduce((s, p) => s + p[1], 0) / poly.length,
]

/**
 * Find the region at a point given in percentages. First matching polygon wins (list order is
 * most-specific first). If none match, take the nearest region centre within a small tolerance.
 */
export function detectRegion(view: View, x: number, y: number): Region | null {
  const list = REGIONS[view]
  const hit = list.find((r) => pointInPolygon([x, y], r.polygon))
  if (hit) return hit
  let best: Region | null = null
  let bestD = 7
  for (const r of list) {
    const c = centroid(r.polygon)
    const d = Math.hypot((c[0] - x) * (W / H), c[1] - y)
    if (d < bestD) {
      bestD = d
      best = r
    }
  }
  return best
}

/** "my right knee", "my chest", "my upper stomach" */
export function regionPhrase(r: Pick<Region, 'name'>): string {
  return `my ${r.name.charAt(0).toLowerCase()}${r.name.slice(1)}`
}

export const BODY_CENTER_X = (CX / W) * 100
