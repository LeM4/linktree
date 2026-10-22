// Pre-projects the world map into SVG path strings so the server can render a
// choropleth without shipping a map library to the browser.
import fs from 'fs';
import path from 'path';
import { feature } from 'topojson-client';
import { geoEqualEarth, geoPath } from 'd3-geo';
import countries from 'i18n-iso-countries';
import { ROOT_DIR } from '../lib/config.js';

const WIDTH = 960;
const HEIGHT = 470;
const ANTARCTICA = '010';

const load = (res) => {
  const file = path.join(ROOT_DIR, 'node_modules', 'world-atlas', `countries-${res}.json`);
  const topology = JSON.parse(fs.readFileSync(file, 'utf8'));
  const geo = feature(topology, topology.objects.countries);
  geo.features = geo.features.filter((f) => f.id !== ANTARCTICA);
  return geo;
};
const alpha2 = (f) => (f.id && countries.numericToAlpha2(f.id)) || null;

const coarse = load('110m');
const detailed = load('50m');

const projection = geoEqualEarth().fitExtent(
  [
    [4, 4],
    [WIDTH - 4, HEIGHT - 4],
  ],
  coarse
);
const toPath = geoPath(projection).digits(1);

const shapes = coarse.features
  .map((f) => ({ code: alpha2(f), name: f.properties.name, d: toPath(f) }))
  .filter((s) => s.d);

// Microstates (LI, SG, MT, ...) are missing at 110m; render them as dots instead.
const known = new Set(shapes.map((s) => s.code));
const dots = detailed.features
  .map((f) => ({ code: alpha2(f), name: f.properties.name, f }))
  .filter((s) => s.code && !known.has(s.code))
  .map(({ code, name, f }) => {
    const [x, y] = toPath.centroid(f);
    return { code, name, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  })
  .filter((s) => Number.isFinite(s.x) && Number.isFinite(s.y));

const out = path.join(ROOT_DIR, 'public', 'data', 'world-map.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ width: WIDTH, height: HEIGHT, shapes, dots }));
console.log(
  `world map: ${shapes.length} shapes + ${dots.length} dots, ${(fs.statSync(out).size / 1024).toFixed(0)} KB -> public/data/world-map.json`
);
