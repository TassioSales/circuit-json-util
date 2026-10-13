import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbNotePath } from "circuit-json"
import {
  getBoundsOfPcbElements,
  getPcbElementBounds,
  getPcbElementsWithinBounds,
} from "../lib/get-bounds-of-pcb-elements"
import { getStrokedPathBounds } from "../lib/get-stroked-path-bounds"

test("pcb_note_path with route (-4,0) to (4,0) participates in range selection with stroke width", () => {
  const notePath: PcbNotePath = {
    type: "pcb_note_path",
    pcb_note_path_id: "np1",
    layer: "top",
    stroke_width: 1,
    route: [
      { x: -4, y: 0 },
      { x: 4, y: 0 },
    ],
  }

  const bounds = getPcbElementBounds(notePath)
  expect(bounds).not.toBeNull()
  expect(bounds!.minX).toBe(-4)
  expect(bounds!.maxX).toBe(4)
  expect(bounds!.minY).toBe(-0.5)
  expect(bounds!.maxY).toBe(0.5)

  // Selecting x[-0.1, 0.1], y[0.3, 0.45] should match because stroke reaches y = 0.5
  const selected = getPcbElementsWithinBounds([notePath], {
    minX: -0.1,
    maxX: 0.1,
    minY: 0.3,
    maxY: 0.45,
  })
  expect(selected).toHaveLength(1)
  expect(selected[0]).toEqual(notePath)

  // Selecting outside the stroke (y > 0.5) should NOT match
  const outside = getPcbElementsWithinBounds([notePath], {
    minX: -0.1,
    maxX: 0.1,
    minY: 0.6,
    maxY: 0.8,
  })
  expect(outside).toHaveLength(0)
})

test("getStrokedPathBounds handles diagonal segments with butt endpoints", () => {
  // (0, 0) to (3, 4) length 5, unit (0.6, 0.8), normal (-0.8, 0.6), stroke width 2 (r = 1)
  const bounds = getStrokedPathBounds(
    [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
    ],
    2,
  )
  expect(bounds).not.toBeNull()
  expect(bounds!.minX).toBeCloseTo(-0.8)
  expect(bounds!.maxX).toBeCloseTo(3.8)
  expect(bounds!.minY).toBeCloseTo(-0.6)
  expect(bounds!.maxY).toBeCloseTo(4.6)
})

test("getStrokedPathBounds extends outer miter point on acute turn within miter limit", () => {
  // 60-degree turn: miter ratio = 2 <= 4
  // (0, 0) -> (10, 0) -> (5, 5*sqrt(3)) with stroke width 1 (r = 0.5)
  // Miter tip should extend to x = 10 + 0.5*sqrt(3) ~= 10.866
  const bounds = getStrokedPathBounds(
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 5 * Math.sqrt(3) },
    ],
    1,
    4,
  )
  expect(bounds).not.toBeNull()
  expect(bounds!.minX).toBeCloseTo(0)
  expect(bounds!.maxX).toBeCloseTo(10 + 0.5 * Math.sqrt(3))
  expect(bounds!.minY).toBeCloseTo(-0.5)
  expect(bounds!.maxY).toBeCloseTo(5 * Math.sqrt(3) + 0.25)
})

test("getStrokedPathBounds bevels very sharp acute join exceeding miter limit", () => {
  // Interior angle ~10 degrees: miter ratio ~11.5 > 4 (miter limit)
  // In SVG, this bevels so the miter tip is not drawn beyond the offset segment corners
  const rad = (10 * Math.PI) / 180
  const bounds = getStrokedPathBounds(
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10 - Math.cos(rad), y: Math.sin(rad) },
    ],
    1,
    4,
  )
  expect(bounds).not.toBeNull()
  // With bevel, maxX does not extend far beyond x = 10
  expect(bounds!.maxX).toBeLessThanOrEqual(10.5)
})

test("getStrokedPathBounds handles duplicate, short, and reversed segments", () => {
  // Consecutive duplicate points
  const dupBounds = getStrokedPathBounds(
    [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 0 },
    ],
    1,
  )
  expect(dupBounds).toEqual({ minX: 0, minY: -0.5, maxX: 6, maxY: 0.5 })

  // Reversed segment: (0, 0) -> (5, 0) -> (0, 0)
  const revBounds = getStrokedPathBounds(
    [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 0, y: 0 },
    ],
    1,
  )
  expect(revBounds).toEqual({ minX: 0, minY: -0.5, maxX: 5, maxY: 0.5 })
})

test("getStrokedPathBounds returns single point bounds for 0-length path", () => {
  const single = getStrokedPathBounds([{ x: 2, y: 3 }], 1)
  expect(single).toEqual({ minX: 2, minY: 3, maxX: 2, maxY: 3 })

  const identical = getStrokedPathBounds(
    [
      { x: 2, y: 3 },
      { x: 2, y: 3 },
    ],
    1,
  )
  expect(identical).toEqual({ minX: 2, minY: 3, maxX: 2, maxY: 3 })
})
