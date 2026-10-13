import type { PcbBounds } from "./get-bounds-of-pcb-elements"

export interface Point {
  x: number
  y: number
}

/**
 * Computes axis-aligned bounding box for a stroked polyline path
 * adhering to SVG standards: butt endpoints, miter joins with miter limit.
 */
export function getStrokedPathBounds(
  points: Array<{ x: number; y: number }>,
  strokeWidth: number,
  miterLimit = 4,
): PcbBounds | null {
  if (!points || points.length === 0) return null

  const validPoints: Array<{ x: number; y: number }> = []
  for (const pt of points) {
    if (
      pt &&
      typeof pt.x === "number" &&
      !Number.isNaN(pt.x) &&
      typeof pt.y === "number" &&
      !Number.isNaN(pt.y)
    ) {
      validPoints.push({ x: pt.x, y: pt.y })
    }
  }

  if (validPoints.length === 0) return null

  if (strokeWidth <= 0) {
    return {
      minX: Math.min(...validPoints.map((p) => p.x)),
      minY: Math.min(...validPoints.map((p) => p.y)),
      maxX: Math.max(...validPoints.map((p) => p.x)),
      maxY: Math.max(...validPoints.map((p) => p.y)),
    }
  }

  // Deduplicate consecutive identical points
  const filtered: Array<{ x: number; y: number }> = []
  for (const p of validPoints) {
    const prev = filtered[filtered.length - 1]
    if (!prev || prev.x !== p.x || prev.y !== p.y) {
      filtered.push(p)
    }
  }

  if (filtered.length <= 1) {
    return {
      minX: filtered[0]?.x ?? validPoints[0]!.x,
      minY: filtered[0]?.y ?? validPoints[0]!.y,
      maxX: filtered[0]?.x ?? validPoints[0]!.x,
      maxY: filtered[0]?.y ?? validPoints[0]!.y,
    }
  }

  const r = strokeWidth / 2
  const segments: Array<{
    p1: { x: number; y: number }
    p2: { x: number; y: number }
    len: number
    ux: number
    uy: number
    nx: number
    ny: number
  }> = []

  for (let i = 0; i < filtered.length - 1; i++) {
    const p1 = filtered[i]!
    const p2 = filtered[i + 1]!
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const len = Math.hypot(dx, dy)
    if (len === 0) continue
    const ux = dx / len
    const uy = dy / len
    const nx = -uy
    const ny = ux
    segments.push({ p1, p2, len, ux, uy, nx, ny })
  }

  if (segments.length === 0) {
    return {
      minX: filtered[0]!.x,
      minY: filtered[0]!.y,
      maxX: filtered[0]!.x,
      maxY: filtered[0]!.y,
    }
  }

  const candidates: Array<{ x: number; y: number }> = []

  // Segment stroke rectangle corners (butt endpoints)
  for (const seg of segments) {
    candidates.push({ x: seg.p1.x + r * seg.nx, y: seg.p1.y + r * seg.ny })
    candidates.push({ x: seg.p1.x - r * seg.nx, y: seg.p1.y - r * seg.ny })
    candidates.push({ x: seg.p2.x + r * seg.nx, y: seg.p2.y + r * seg.ny })
    candidates.push({ x: seg.p2.x - r * seg.nx, y: seg.p2.y - r * seg.ny })
  }

  // Intermediate vertex miter joins
  for (let i = 0; i < segments.length - 1; i++) {
    const s1 = segments[i]!
    const s2 = segments[i + 1]!
    const cross = s1.ux * s2.uy - s1.uy * s2.ux
    if (Math.abs(cross) < 1e-9) continue

    const s = Math.sign(cross)
    const n1x = -s * s1.nx
    const n1y = -s * s1.ny
    const n2x = -s * s2.nx
    const n2y = -s * s2.ny

    const dot = n1x * n2x + n1y * n2y
    if (1 + dot > 1e-9) {
      const miterRatio = Math.sqrt(2 / (1 + dot))
      if (miterRatio <= miterLimit) {
        const k = r / (1 + dot)
        candidates.push({
          x: s1.p2.x + k * (n1x + n2x),
          y: s1.p2.y + k * (n1y + n2y),
        })
      }
    }
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const c of candidates) {
    if (c.x < minX) minX = c.x
    if (c.x > maxX) maxX = c.x
    if (c.y < minY) minY = c.y
    if (c.y > maxY) maxY = c.y
  }

  return { minX, minY, maxX, maxY }
}
