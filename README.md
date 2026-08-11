# BILH-Exeter — Inpatient Bed Recapitalization Program

Planning / conditions dashboard for the **BILH — Exeter Hospital** main campus, 5 Alumni Drive, Exeter NH,
against the *Inpatient Bed Recapitalization Program* RFP (18 June 2026). Derived from the Burlington
dashboard (`Burlington Plans`, v0.5) — same visual system, export/import and print behaviour.

**Open `index.html` in a browser.** Everything is offline and self-contained.

## v0.3 (2026-08-11) — East Wing, CUP, exact hover shapes

- **East Wing** (4 levels) and **CUP / Facilities Engineering** (2 levels) added from the 11 Aug
  drawings. These sheets are printed at **1/16"**, not 1/8", so scale is now stored **per plan**
  (`ftPerUnit`, `cellSf`) and the placement engine carries block budgets in square feet — a block can
  span a 1/8" plate and a 1/16" plate and still measure correctly.
- **East Wing Addition is gone as a separate building**: the drawings show it is simply East Wing
  Level 1, so it folds into East Wing (which measures **118,800 GSF**, close to the 120,000 that was
  assumed). CUP measures **12,500 GSF** against 34,000 assumed — a real correction.
- **Hover outlines are whole-building silhouettes.** They are traced from a stripped copy of the axon
  containing only the pink building fills and the bold division polylines (`Layer_4`/`15` +
  `Layer_11`/`13`) — every internal massing line is dropped, so a connected component is the entire
  extruded building rather than one floor band. The division lines yield four silhouettes; Facilities
  Engineering / NW Wing and Perry / OCC / MOB are then split geodesically inside theirs. CFOM and
  Saltonstall come from the white footprints. Same idea on the site plan.
- The home-page axon shows the **whole site**, not a crop of the buildings. The map frame stretches to
  the height of the inventory table beside it, with the site centred inside; **scroll to zoom about
  the cursor, drag to pan, double-click to reset**. Labels follow the RFP figure's convention: a red
  diamond on the building, a short **vertical** leader, and the name stacked above or below it,
  wrapped onto two balanced lines when long. Leader lengths are staggered per building so the crowded
  centre of the campus stays legible. Label type, leaders and diamonds are sized in **screen pixels**
  and converted to drawing units at layout time, so they hold their size at any zoom level.
- **Facilities Engineering corrected on the site plan.** It is the detached L-shaped block west of the
  Northwest Wing, not the plate between OCC and the NW Wing — confirmed by shape-matching the CUP
  floor plan against each candidate footprint (IoU 0.78 vs 0.61). That plate is grouped with the
  Northwest Wing; if it is actually its own building, say so and it gets its own entry.
- GSF sub-labels removed from the axon — the numbers live in the inventory table, where the
  measured/assumed distinction is visible.
- Only **CFOM** and **Saltonstall** are still assumed. The measured inpatient hospital totals well
  under the RFP's ≈390,000 SF; the drawings cover occupied floors only, so the difference is a
  question for BILH rather than something to invent.

## v0.2 (2026-08-10) — real drawings in

The 2026-08-10 drawing package (`Burlington Updated/Site&Floor`) replaced the placeholder graphics:

- **Vector site axon + site plan** (`assets/site/`), displayed with an interactive overlay: hover a
  building and it highlights along with its row in the inventory table (and vice-versa); labels are
  drawn in the RFP Figure 1 style (red diamond pins + leader lines). Clicking a building that has
  floor plans jumps to its Floor Plans view.
- **Measured floor plates** for OCC, MOB, Perry, West Wing and Northwest Wing, from the 1/8"-scale
  outline SVGs (`assets/floors/`). These flip their inventory rows from *assumed* to *measured*
  (per-level GSF in the tooltip) and drive the stacking capacities on the Bed Recap tab.
- **New Floor Plans tab** — the Burlington Site Scenarios interaction rebuilt for Exeter. Left panel:
  program blocks with true-to-area swatches — the existing units (+ observation) are ready-made; each
  unit type band has a “+” that adds a new block sized by an editable beds field (beds × BGSF/room),
  and custom SF blocks can be added the same way. Right: building picker + compact per-level canvases
  in a grid; drop a block and it auto-fills the white usable area from the drop point in 3-ft cells
  (grey = unusable, ⚠ = truncated), drag to move, double-click to return. **📐 Draw Section** drags a
  cut line (45° snap) across any level; the line shows on every level of the building and a stacked
  section renders below (grey band = floor plate, colour = placed program, editable floor-to-floor).
  Everything is per-scenario and travels with Export JSON.
- **Key Buildings** is itself a toggle: it switches to an **all-buildings site view** — one drawing
  per campus level with every building that has a plan at that level laid out together, so program
  can be dropped across buildings without changing views. Offsets come from each building's centroid
  on the vector site plan (relaxed so the un-rotated plates don't collide), so the arrangement reads
  as the real campus; plates keep their own sheet orientation, so this is a diagram, not a survey.
- Narrow **link corridors** protruding from a plate are excluded from the fillable area by a
  morphological opening, so blocks never fill down a 10-ft connector.
- **NW Wing Level 1** now uses a cleaned outline (`NW WING L1 clean.svg`) instead of the furnished
  CAD sheet, matching the other plates.

  URL helpers: `?fldemo=1#floors` seeds a demo layout, `?flsite=1#floors` opens the site view,
  `?flbldg=nw#floors` opens a specific building.

## Tabs

| Tab | What it does |
|---|---|
| **Project Assumptions** | RFP hard constraints, the interactive campus axon + plan with hover-synced building inventory (measured vs assumed chips, reconciliation against the RFP portfolio totals), grossing chain, order-of-magnitude cost model, procurement schedule. |
| **Inpatient Program** | Figure 2 bed count verbatim with per-unit private-conversion control; the demand model sizing licensed beds + the observation unit; the 32-bed Med/Surg space program converting rooms to area. |
| **Floor Plans** | The placement tool on the real floor plates (West, NW, Perry, OCC, MOB — East series pending). |
| **Bed Recap & Phasing** | Stacking (against measured plates where available), campus plan tinted by phase state, draggable phasing timeline, bed gain/loss chart vs licence + operating floor, phase schedule with costs. |

## The arithmetic that matters

Conversion buys private rooms with licensed beds, not square feet: rooms stay at 81, beds go
100 → 81 at 100% private, floor area unchanged. Demand ≈ 75 licensed beds, so the licence is not
the binding constraint — **area is**, and the measured plates sharpen that point: West Wing's L3/L4
plates are ~6,000–7,800 SF usable while a converted all-private unit at 1,338 BGSF/room wants
12,000–17,400 SF. The renovated program physically cannot return to the same floor — which is the
strongest possible argument for the relocation/decanting strategy the RFP asks for. The 14-bed
observation unit (~13,100 BGSF) has the same problem, visible by dropping it onto any plate on the
Floor Plans tab.

## Files

```
index.html              shell, styles, state, Assumptions + Inpatient Program tabs, site-graphic builder
js/site-graphic.js      generated: viewBox crops, per-building hover polygons, label anchors
js/floor-plans.js       generated: per-level file refs, measured GSF/usable SF, 3-ft cell masks
js/floors-tab.js        Floor Plans tab (placement tool)
js/recap.js             Bed Recap & Phasing tab
assets/site/            vector site plan + axon (2026-08-10 package)
assets/floors/          1/8"-scale floor outline SVGs (2026-08-10 package)
assets/source/          RFP + the two program workbooks
```

## Regenerating when the next drawings land (East Wing etc.)

1. Drop the new outline SVGs into `assets/floors/` (same convention: 2592×1728 viewBox, thick black
   outline, grey `#c6c6c6` = unusable, 1/8" scale).
2. The measurement pipeline is offline Python (raster → seal leaks → flood-fill interior → measure +
   3-ft cell mask → regenerate `js/floor-plans.js`); the same session that produced v0.2 can rerun it —
   the steps are: rasterize at 2592×1728, classify (dark = wall, grey = unusable), close dashed gaps,
   flood from the border, patch any open outline with hand segments, then emit `FLOOR_SRC` /
   `FLOOR_MASKS` / `FLOOR_LEVELS`.
3. Add the new levels to `FLOOR_LEVELS` (`key → [srcKey, buildingId, "Level n"]`) and update the
   building's `floorGSF` in `index.html`.

## Still assumed / to verify

- **Building identities on the site graphics.** The wings were identified by cross-referencing the
  new drawings against RFP Figure 1 (affine matching + footprint areas). Confirm once with Carolyn's
  team — especially the OCC / MOB split of the curved north-east pair and the NW / Perry split of the
  centre masses.
- East Wing, East Wing Addition, Facilities Engineering, CFOM, Saltonstall: levels + GSF assumed.
- NW Wing L1 was measured off the furnished CAD sheet (cropped); its clean outline will supersede it.
- All demand volumes, $/GSF rates, the 78-bed operating floor, and which existing function occupies
  East L1 (assumed available for the observation unit).
