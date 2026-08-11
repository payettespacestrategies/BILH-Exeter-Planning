# BILH-Exeter — Inpatient Bed Recapitalization Program

Planning / conditions dashboard for the **BILH — Exeter Hospital** main campus, 5 Alumni Drive, Exeter NH,
against the *Inpatient Bed Recapitalization Program* RFP (18 June 2026). Derived from the Burlington
dashboard (`Burlington Plans`, v0.5) — same visual system, export/import and print behaviour.

**Open `index.html` in a browser.** Everything is offline and self-contained.

## v0.5 (2026-08-11)

- **Levels 2, 3 and 4 re-issued.** Levels 3 and 4 are now separate drawings, so Perry is
  correctly a ghost on Level 4 and both West Wing plates re-solve to a clean 100% fit
  (transforms derived from the named per-building groups the new files carry). One gap is
  left: in `LEVEL 4.svg` the `EAST_WING_LEVEL_4` group holds only its obstacle layer — the
  outline layer every other building has was not exported — so that plate is an open partial
  shape. Flagged in the card header; it needs a re-export, not a transform.
- **Module size is editable and set to 18 beds.** Note the knock-on: at 18 beds the source
  20,577 NSF program gives 1,143 NSF/bed instead of 643, so every BGSF figure roughly
  doubles. Trim the NSF rows to a real 18-bed program to bring it back.
- Defaults synced to the saved state: inpatient occupancy 90%, observation occupancy 85%,
  and the conversion now holds the bed count by default (19 rooms converted, 19 added).
- The demand section keeps its key-metric cards across the top, with the calculation ledger
  under them showing how each number is reached.
- The by-unit-type roll-up moved to the very bottom of the Inpatient Program tab as a
  closing summary, and its Rooms column now counts added rooms.

## v0.4 (2026-08-11)

- **Hold the bed count by adding rooms.** Converting a semi-private room to private
  costs a licensed bed and frees no area. The bed table now has an **Add rooms** column
  and an **Added BGSF** column: add private rooms to win those beds back, and see exactly
  what new area that needs. "Hold bed count" fills every unit in one click — full
  conversion at a constant 100 beds costs **~25,400 BGSF** of new build.
- **The demand model is now a calculation ledger.** One numbered row per equation, the
  editable inputs sitting inside the sentence that uses them and the value they produce on
  the right, in three blocks (inpatient beds, observation beds, supply against demand).
  The arithmetic is followable step by step instead of being split between a driver grid
  and a row of result cards.
- Administrative Office program carried over from the Burlington dashboard, at the bottom
  of the Inpatient Program tab.
- Key Buildings is the default Floor Plans view; its campus drawings now use a bold black
  outline for buildings on the level and a light grey dashed ghost for those that are not,
  with names set clear of the linework.
- Home page: Source column, field notes and card captions removed (notes are tooltips now);
  the campus map matches the inventory table's height, centres itself and supports
  scroll-to-zoom / drag-to-pan / double-click-reset.

**Known drawing issue:** `LEVEL 3.svg` and `LEVEL 4.svg` in the supplied campus set are
byte-identical, and that one drawing carries East Wing L2 + West Wing L1. Campus Level 3
therefore draws the wrong East plate and Level 4 the wrong West plate — flagged in the card
header as *drawing mismatch*. It also explains why Perry appears on Level 4 with no program:
Perry has three levels, and that plate is Level 3's. It needs the missing drawing; no
transform can correct it.

## v0.3 (2026-08-11) — East Wing, CUP, exact hover shapes

- **East Wing** (4 levels) and **CUP** (2 levels) added from the 11 Aug
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
- **CUP corrected on the site plan.** It is the detached L-shaped block west of the
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
  (per-level GSF in the tooltip) and drive the stacking capacities on the Scenario & Phasing tab.
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
| **Scenario & Phasing** | Stacking (against measured plates where available), campus plan tinted by phase state, draggable phasing timeline, bed gain/loss chart vs licence + operating floor, phase schedule with costs. |

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
js/recap.js             Scenario & Phasing tab
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
- East Wing, East Wing Addition, CUP, CFOM, Saltonstall: levels + GSF assumed.
- NW Wing L1 was measured off the furnished CAD sheet (cropped); its clean outline will supersede it.
- All demand volumes, $/GSF rates, the 78-bed operating floor, and which existing function occupies
  East L1 (assumed available for the observation unit).
