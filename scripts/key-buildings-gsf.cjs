// Recalculate the homepage inventory from the composite Key Buildings SVGs.
//
// The composite sheets are 72 SVG units/in and are interpreted at 1/8" = 1'-0",
// so their physical scale is 1/9 ft per SVG unit. Many building groups share open
// boundary segments with their neighbours; the calibrated single-plan -> composite
// transforms in js/floors-tab.js provide the closed-plate area without inventing
// closure lines. Area changes by sx * sy under that transform.

const compositeFtPerUnit = 1 / 9;

const plates = [
  // campusLevel, building, label, source GSF, source ft/SVG-unit, sx, sy
  [1, 'mob', 'L1', 15000, 1 / 9, 1, 1],
  [1, 'occ', 'L1', 17800, 1 / 9, 1, 1],
  [1, 'perry', 'L1', 15600, 1 / 9, 1, 1],
  [2, 'east', 'Ground', 38400, 0.127983, 1, 1],
  [2, 'perry', 'L2', 10600, 1 / 9, 1, 1],
  [2, 'occ', 'L2', 10900, 1 / 9, 1, 1],
  [2, 'mob', 'L2', 13500, 1 / 9, 1, 1],
  [2, 'nw', 'Basement', 14800, 1 / 9, 1, 1],
  [3, 'east', 'L1', 38400, 2 / 9, 1.698, 1.698],
  [3, 'perry', 'L3', 10600, 1 / 9, 1, 1],
  [3, 'west', 'L1', 12400, 1 / 9, 0.993437085, 0.993437085],
  [3, 'occ', 'L3', 10900, 1 / 9, 1, 1],
  [3, 'mob', 'L3', 13500, 1 / 9, 1, 1],
  [4, 'occ', 'L4', 10900, 1 / 9, 1, 1],
  [4, 'mob', 'L4', 12100, 1 / 9, 1, 1],
  [4, 'west', 'L2', 9500, 1 / 9, 0.987999233, 0.987999233],
  [4, 'east', 'L2', 40200, 2 / 9, 1.734114607, 1.735208573],
  [5, 'east', 'L3', 24200, 2 / 9, 1.756979449, 1.756979449],
  [5, 'west', 'L3', 7500, 1 / 9, 1, 1],
  [6, 'west', 'L4', 7500, 1 / 9, 1, 1],
  [6, 'east', 'L4', 16000, 2 / 9, 1.756979449, 1.756979449]
];

function keyGsf(sourceGsf, sourceFtPerUnit, sx, sy) {
  const scaleRatio = compositeFtPerUnit / sourceFtPerUnit;
  return sourceGsf * sx * sy * scaleRatio * scaleRatio;
}

const rows = plates.map(([campusLevel, building, label, sourceGsf, sourceFtPerUnit, sx, sy]) => {
  const exactGsf = keyGsf(sourceGsf, sourceFtPerUnit, sx, sy);
  return {
    campusLevel,
    building,
    label,
    exactGsf: Math.round(exactGsf),
    roundedGsf: Math.round(exactGsf / 100) * 100
  };
});

const buildings = {};
for (const row of rows) {
  if (!buildings[row.building]) buildings[row.building] = { levels: 0, gsf: 0, floorGSF: {} };
  const b = buildings[row.building];
  b.levels += 1;
  b.gsf += row.roundedGsf;
  b.floorGSF[b.levels] = row.roundedGsf;
}

process.stdout.write(`${JSON.stringify({
  scale: '1/8in = 1ft',
  compositeFtPerUnit,
  rows,
  buildings,
  absentFromKeyBuildings: ['faceng', 'cfom', 'salt']
}, null, 2)}\n`);
