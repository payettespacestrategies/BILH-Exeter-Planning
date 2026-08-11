const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function svgInfo(svg) {
  const m = svg.match(/viewBox=["']([^"']+)["']/i);
  const vb = (m ? m[1] : '0 0 2592 1728').trim().split(/[ ,]+/).map(Number);
  return { vb, width: vb[2], height: vb[3] };
}

function extractGroup(svg, id) {
  const startRe = new RegExp('<g\\b[^>]*\\bid=["\']' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\'][^>]*>', 'i');
  const hit = startRe.exec(svg);
  if (!hit) throw new Error('Missing group #' + id);
  const tokenRe = /<\/?g\b[^>]*>/gi;
  tokenRe.lastIndex = hit.index;
  let depth = 0;
  let token;
  while ((token = tokenRe.exec(svg))) {
    if (/^<\/g/i.test(token[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) return svg.slice(hit.index, tokenRe.lastIndex);
  }
  throw new Error('Unclosed group #' + id);
}

function isolate(svg, id) {
  const { vb } = svgInfo(svg);
  const styles = (svg.match(/<style\b[\s\S]*?<\/style>/gi) || []).join('\n');
  const defs = (svg.match(/<defs\b[\s\S]*?<\/defs>/gi) || []).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}">${styles}${defs}${extractGroup(svg, id)}</svg>`;
}

function maskDrawing(svg, id) {
  const { vb } = svgInfo(svg);
  const base = id ? extractGroup(svg, id) : svg;
  const defs = (svg.match(/<defs\b[\s\S]*?<\/defs>/gi) || []).join('\n');
  const outline = extractGroup(base, 'Layer_2').replace(
    /<(path|polygon|polyline|rect)\b/gi,
    '<$1 style="fill:#fff;stroke:#000"'
  );
  const obstacles = extractGroup(base, 'Layer_3');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}">${defs}${outline}${obstacles}</svg>`;
}

async function pixels(svg, targetWidth) {
  return sharp(Buffer.from(svg), { density: 72 })
    .resize({ width: targetWidth })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

async function alphaBBox(svg, targetWidth = 1800) {
  const info = svgInfo(svg);
  const rendered = await pixels(svg, targetWidth);
  const { data } = rendered;
  const w = rendered.info.width;
  const h = rendered.info.height;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const sx = info.width / w;
  const sy = info.height / h;
  return [
    info.vb[0] + minX * sx,
    info.vb[1] + minY * sy,
    (maxX - minX + 1) * sx,
    (maxY - minY + 1) * sy
  ];
}

async function makeMask(svg, spec) {
  const info = svgInfo(svg);
  const rendered = await pixels(svg, spec.renderWidth || Math.ceil(info.width * 0.5));
  const { data } = rendered;
  const pw = rendered.info.width;
  const ph = rendered.info.height;
  const sampleN = spec.sampleN || 7;
  const threshold = spec.threshold || 0.8;
  const rows = [];
  let usableCells = 0;
  for (let gy = 0; gy < spec.h; gy += 1) {
    let row = '';
    for (let gx = 0; gx < spec.w; gx += 1) {
      let white = 0;
      let opaque = 0;
      for (let sy = 0; sy < sampleN; sy += 1) {
        for (let sx = 0; sx < sampleN; sx += 1) {
          const ux = spec.ox + (gx + (sx + 0.5) / sampleN) * spec.cell;
          const uy = spec.oy + (gy + (sy + 0.5) / sampleN) * spec.cell;
          const px = Math.max(0, Math.min(pw - 1, Math.floor((ux - info.vb[0]) / info.width * pw)));
          const py = Math.max(0, Math.min(ph - 1, Math.floor((uy - info.vb[1]) / info.height * ph)));
          const i = (py * pw + px) * 4;
          const a = data[i + 3];
          if (a > 24) {
            opaque += 1;
            if (data[i] > 238 && data[i + 1] > 238 && data[i + 2] > 238) white += 1;
          }
        }
      }
      const total = sampleN * sampleN;
      if (white / total >= threshold) {
        row += '0';
        usableCells += 1;
      } else if (opaque / total >= 0.12) row += '1';
      else row += '2';
    }
    rows.push(row);
  }
  return { ox: spec.ox, oy: spec.oy, cell: spec.cell, w: spec.w, h: spec.h, rows, usableCells };
}

async function main() {
  const east1 = read('assets/floors/EAST WING L1.svg');
  const east2 = read('assets/floors/EAST WING L2.svg');
  const level2 = read('assets/key-buildings/LEVEL 2.svg');
  const level3 = read('assets/key-buildings-as-supplied/LEVEL 3.svg');
  const level4 = read('assets/key-buildings/LEVEL 4.svg');
  const groundSvg = isolate(level2, 'east_wing_ground');
  const level3EastSvg = isolate(level3, 'east_wing_L1');
  const level4EastSvg = isolate(level4, 'EAST_WING_LEVEL_4');
  const level4WestSvg = isolate(level4, 'WEST_WING_L2');
  const boxes = {
    east1: await alphaBBox(east1),
    east2: await alphaBBox(east2),
    level2Ground: await alphaBBox(groundSvg),
    level3East: await alphaBBox(level3EastSvg),
    level4East: await alphaBBox(level4EastSvg),
    level4West: await alphaBBox(level4WestSvg)
  };

  const cell = 14 * 1.736292428;
  const b = boxes.level2Ground;
  const ox = Math.floor((b[0] - cell) / cell) * cell;
  const oy = Math.floor((b[1] - cell) / cell) * cell;
  const w = Math.ceil((b[0] + b[2] + cell - ox) / cell);
  const h = Math.ceil((b[1] + b[3] + cell - oy) / cell);
  const groundMask = await makeMask(maskDrawing(level2, 'east_wing_ground'), { ox, oy, cell, w, h, threshold: 0.82, sampleN: 7, renderWidth: 3487 });
  const east1Mask = await makeMask(maskDrawing(east1), { ox: 748, oy: 201, cell: 14, w: 72, h: 91, threshold: 0.82, sampleN: 7, renderWidth: 2592 });
  const east2Mask = await makeMask(maskDrawing(east2), { ox: 682, oy: 201, cell: 14, w: 71, h: 96, threshold: 0.82, sampleN: 7, renderWidth: 2592 });

  // The composite Level 3 East L1 outline is not an affine copy of the
  // single-building East L1 outline. Use a composite-native grid for the Key
  // Buildings canvas so program fill follows the supplied boundary. Normalize
  // its cell area to the same total usable SF as the single-plan grid, keeping
  // placements synchronized between the two views.
  const siteCell = 28; // 28 SVG units at 1/8" scale = 14 units at 1/16" scale
  const eb = boxes.level3East;
  const siteOx = Math.floor((eb[0] - siteCell) / siteCell) * siteCell;
  const siteOy = Math.floor((eb[1] - siteCell) / siteCell) * siteCell;
  const siteW = Math.ceil((eb[0] + eb[2] + siteCell - siteOx) / siteCell);
  const siteH = Math.ceil((eb[1] + eb[3] + siteCell - siteOy) / siteCell);
  const siteEast1Mask = await makeMask(maskDrawing(level3, 'east_wing_L1'), {
    ox: siteOx, oy: siteOy, cell: siteCell, w: siteW, h: siteH,
    threshold: 0.82, sampleN: 7, renderWidth: 3487
  });
  siteEast1Mask.cellSf = east1Mask.usableCells * 9.679 / siteEast1Mask.usableCells;

  const out = { boxes, groundMask, east1Mask, east2Mask, siteEast1Mask };
  const outPath = path.join(root, 'scripts', 'key-buildings-calibration.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  const groundPlanPath = path.join(root, 'assets', 'floors', 'EAST WING GROUND.svg');
  fs.writeFileSync(groundPlanPath, groundSvg);
  const groundUsable = Math.round(groundMask.usableCells * 9.679);
  const dataJs = `// Generated by scripts/key-buildings-calibrate.cjs from the supplied KeyBuildings SVGs.\n` +
`FLOOR_SRC.EAST_WING_GROUND = ${JSON.stringify({
    file: 'assets/floors/EAST WING GROUND.svg',
    vb: [3380, 3105, 1740, 2170],
    sheetSize: [6973.28, 5874.38],
    gsf: 38400,
    usable: groundUsable,
    ftPerUnit: 0.127983,
    cellSf: 9.679
  })};\n` +
`FLOOR_MASKS.EAST_WING_GROUND = ${JSON.stringify({ ox: groundMask.ox, oy: groundMask.oy, cell: groundMask.cell, w: groundMask.w, h: groundMask.h, rows: groundMask.rows })};\n` +
`FLOOR_LEVELS.east_g = ["EAST_WING_GROUND","east","Ground"];\n` +
`FLOOR_MASKS.EAST_WING_L1 = ${JSON.stringify({ ox: east1Mask.ox, oy: east1Mask.oy, cell: east1Mask.cell, w: east1Mask.w, h: east1Mask.h, rows: east1Mask.rows })};\n` +
`FLOOR_MASKS.EAST_WING_L2 = ${JSON.stringify({ ox: east2Mask.ox, oy: east2Mask.oy, cell: east2Mask.cell, w: east2Mask.w, h: east2Mask.h, rows: east2Mask.rows })};\n`;
  const dataPath = path.join(root, 'js', 'key-buildings-data.js');
  fs.writeFileSync(dataPath, dataJs);
  const siteDataPath = path.join(root, 'js', 'key-buildings-site-data.js');
  fs.writeFileSync(siteDataPath,
    '// Generated by scripts/key-buildings-calibrate.cjs for composite-specific floor masks.\n' +
    `var FL_SITE_MASKS = { LEVEL3_EAST_L1: ${JSON.stringify({ ox: siteEast1Mask.ox, oy: siteEast1Mask.oy, cell: siteEast1Mask.cell, cellSf: siteEast1Mask.cellSf, w: siteEast1Mask.w, h: siteEast1Mask.h, rows: siteEast1Mask.rows })} };\n`);
  console.log(JSON.stringify({ boxes, counts: {
    ground: groundMask.usableCells,
    east1: east1Mask.usableCells,
    east2: east2Mask.usableCells,
    siteEast1: siteEast1Mask.usableCells
  }, outPath, dataPath, siteDataPath, groundPlanPath }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
