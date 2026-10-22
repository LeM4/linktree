(() => {
    const root = document.getElementById('theme-autumn');
    const svg = root && root.querySelector('.af-land');
    const canvas = root && root.querySelector('.af-leaves');
    const ctx = canvas && canvas.getContext('2d');
    if (!svg || !ctx) return;

    const NS = 'http://www.w3.org/2000/svg';
    const TAU = Math.PI * 2;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const r1 = (n) => Math.round(n * 10) / 10;

    // Deterministic randomness so the landscape doesn't reshuffle on every visit.
    function seeded(seed) {
        return () => {
            seed |= 0;
            seed = (seed + 0x6d2b79f5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function hexMix(a, b, t) {
        const p = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
        const [x, y] = [p(a), p(b)];
        return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
    }

    const el = (name, attrs = {}, parent) => {
        const node = document.createElementNS(NS, name);
        for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
        if (parent) parent.appendChild(node);
        return node;
    };

    // ---- landscape ---------------------------------------------------------------

    const SUN = '#ffe2b0';
    const HAZE = '#ffb27a';
    // far -> near: warm haze fading into deep plum (atmospheric perspective)
    const LAYERS = [
        { base: 0.63, amp: 0.028, color: '#e98d62', tree: 0.32, density: 0.15, d: 2 },
        { base: 0.69, amp: 0.036, color: '#c86650', tree: 0.46, density: 0.35, d: 4 },
        { base: 0.755, amp: 0.042, color: '#93424a', tree: 0.64, density: 0.5, d: 7 },
        { base: 0.83, amp: 0.04, color: '#5c2539', tree: 0.86, density: 0.55, d: 11 },
        { base: 0.915, amp: 0.03, color: '#2a1222', tree: 1.15, density: 0.42, d: 16 },
    ];

    let ridges = [];

    function ridgeFn(rand, W, H, layer) {
        const waves = [0.55, 0.3, 0.15].map((w, i) => ({
            w,
            f: TAU / (W * [0.9, 0.42, 0.17][i] * lerp(0.75, 1.25, rand())),
            p: rand() * TAU,
        }));
        const base = H * layer.base;
        const amp = H * layer.amp;
        return (x) => base + amp * waves.reduce((s, v) => s + v.w * Math.sin(x * v.f + v.p), 0);
    }

    // clockwise like the hill polygons, so overlapping subpaths union instead of punching holes
    const circle = (cx, cy, r) => `M${r1(cx - r)} ${r1(cy)}a${r1(r)} ${r1(r)} 0 1 1 ${r1(r * 2)} 0a${r1(r)} ${r1(r)} 0 1 1 ${r1(-r * 2)} 0`;

    function tree(rand, x, y, s, detailed) {
        let d = '';
        if (rand() < 0.62) {
            // broadleaf: an irregular, slightly lopsided cloud of foliage
            const h = s * lerp(0.95, 1.3, rand());
            const crownW = s * lerp(0.42, 0.6, rand());
            const crownH = s * lerp(0.36, 0.5, rand());
            const cy = y - h + crownH;
            const lean = (rand() - 0.5) * s * 0.12;
            const trunkW = Math.max(1.2, s * 0.06);
            d += `M${r1(x - trunkW / 2)} ${r1(y + 2)}L${r1(x - trunkW * 0.35 + lean)} ${r1(cy)}h${r1(trunkW * 0.7)}L${r1(x + trunkW / 2)} ${r1(y + 2)}z`;
            if (detailed) {
                const by = y - (y - cy) * 0.45;
                d += `M${r1(x)} ${r1(by)}l${r1(-s * 0.16)} ${r1(-s * 0.18)}l${r1(trunkW * 0.5)} ${r1(-trunkW * 0.2)}z`;
                d += `M${r1(x)} ${r1(by - s * 0.06)}l${r1(s * 0.14)} ${r1(-s * 0.16)}l${r1(-trunkW * 0.3)} ${r1(-trunkW * 0.5)}z`;
            }
            const puffs = detailed ? 14 : 9;
            for (let i = 0; i < puffs; i++) {
                const a = rand() * TAU;
                const rr = Math.sqrt(rand());
                const px = x + lean + Math.cos(a) * crownW * rr * 0.75;
                const py = cy + Math.sin(a) * crownH * rr * 0.7 - crownH * 0.1;
                d += circle(px, py, s * lerp(0.1, 0.19, rand()) * (1.1 - rr * 0.35));
            }
            d += circle(x + lean, cy - crownH * 0.1, Math.min(crownW, crownH) * 0.62);
        } else {
            // spruce: jagged tiers
            const h = s * lerp(1.15, 1.65, rand());
            const w = s * lerp(0.3, 0.4, rand());
            const tiers = detailed ? 7 : 5;
            d += `M${r1(x)} ${r1(y - h)}`;
            for (let i = 1; i <= tiers; i++) {
                const ty = y - h + (h * 0.92 * i) / tiers;
                const tw = (w * i) / tiers;
                d += `L${r1(x + tw)} ${r1(ty)}L${r1(x + tw * 0.4)} ${r1(ty - h * 0.035)}`;
            }
            d += `L${r1(x + w * 0.08)} ${r1(y + 2)}L${r1(x - w * 0.08)} ${r1(y + 2)}`;
            for (let i = tiers; i >= 1; i--) {
                const ty = y - h + (h * 0.92 * i) / tiers;
                const tw = (w * i) / tiers;
                d += `L${r1(x - tw * 0.4)} ${r1(ty - h * 0.035)}L${r1(x - tw)} ${r1(ty)}`;
            }
            d += 'Z';
        }
        return d;
    }

    /** Distant forest edge: a continuous bumpy canopy reads better than single trees. */
    function canopy(rand, ridge, x0, x1, s) {
        let d = '';
        for (let x = x0; x < x1; x += s * lerp(0.07, 0.13, rand())) {
            if (rand() < 0.08) {
                d += tree(rand, x, ridge(x) + s * 0.1, s * lerp(0.9, 1.2, rand()), false);
                continue;
            }
            const r = s * lerp(0.09, 0.2, rand());
            d += circle(x, ridge(x) - r * lerp(0.1, 1.1, rand()), r);
        }
        return d;
    }

    // ---- pumpkins ----------------------------------------------------------------

    const VARIETIES = {
        orange: { lit: '#e9813f', mid: '#a9461b', crease: '#3a130a' },
        cream: { lit: '#efdcc3', mid: '#b49c84', crease: '#463631' },
        sage: { lit: '#aab4a0', mid: '#6c776c', crease: '#262c2a' },
    };
    let gradId = 0;

    /**
     * Heirloom pumpkin modelled as a lobed, squashed sphere seen slightly from above and
     * projected to SVG. Lobes are painter-sorted and shaded by sky fill + low back light.
     */
    function pumpkin(defs, parent, x, y, rx, h, variety, stemTilt, ribs, ribDepth) {
        const c = VARIETIES[variety];
        const g = el('g', {}, parent);
        const a = rx;
        const b = h / 2;
        const tilt = 0.34;
        const ce = Math.cos(tilt);
        const se = Math.sin(tilt);
        const dimple = b * 0.32;
        const STEPS = 26;
        const SKY = [-0.25, 0.75, 0.6];
        const BACK = [0.75, 0.35, -0.55];
        const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

        const local = (theta, phi) => {
            const s = 1 - ribDepth * (1 - Math.abs(Math.sin((ribs * phi) / 2)));
            const px = a * s * Math.sin(theta) * Math.sin(phi);
            const pz = a * s * Math.sin(theta) * Math.cos(phi);
            const py = b * Math.cos(theta) - dimple * Math.exp(-((theta / 0.45) ** 2)) + b * 0.12 * Math.exp(-(((Math.PI - theta) / 0.35) ** 2));
            return [px, -(py * ce - pz * se), pz * ce + py * se];
        };

        // fit the projected pumpkin so its lowest point rests on the ground at (x, y)
        let maxY = -Infinity;
        for (let i = 0; i <= 12; i++) for (let j = 0; j < 24; j++) maxY = Math.max(maxY, local((Math.PI * i) / 12, (TAU * j) / 24)[1]);
        const P = (theta, phi) => {
            const [px, py, pz] = local(theta, phi);
            return [x + px, y - maxY + py, pz];
        };
        const strip = (p0, p1) => {
            const down = [];
            const up = [];
            for (let i = 0; i <= STEPS; i++) {
                const th = (Math.PI * i) / STEPS;
                down.push(P(th, p0));
                up.unshift(P(th, p1));
            }
            return [...down, ...up].map(([px, py], i) => `${i ? 'L' : 'M'}${r1(px)} ${r1(py)}`).join('') + 'Z';
        };

        const top = P(0, 0)[1];
        el('ellipse', { cx: r1(x + a * 0.1), cy: r1(y), rx: r1(a * 1.12), ry: r1(Math.max(3, h * 0.1)), fill: '#0d0408', opacity: 0.7, filter: 'url(#af-soft)' }, g);

        const aoId = `af-ao${gradId++}`;
        const ao = el('linearGradient', { id: aoId, gradientUnits: 'userSpaceOnUse', x1: 0, y1: r1(top - b * 0.2), x2: 0, y2: r1(y) }, defs);
        el('stop', { offset: 0, 'stop-color': '#ffffff', 'stop-opacity': 0.1 }, ao);
        el('stop', { offset: 0.5, 'stop-color': '#000000', 'stop-opacity': 0 }, ao);
        el('stop', { offset: 1, 'stop-color': '#12040a', 'stop-opacity': 0.6 }, ao);

        const lobes = Array.from({ length: ribs }, (_, k) => {
            const p0 = (TAU * k) / ribs;
            const p1 = (TAU * (k + 1)) / ribs;
            const mid = (p0 + p1) / 2;
            return { p0, p1, mid, depth: P(Math.PI / 2, mid)[2] };
        }).sort((l, m) => l.depth - m.depth);

        for (const { p0, p1, mid } of lobes) {
            // far lobes are only seen near the crown, where the surface faces the sky
            const th = Math.cos(mid) < 0 ? 0.75 : 1.35;
            const n = [Math.sin(mid) * Math.sin(th), Math.cos(th), Math.cos(mid) * Math.sin(th)];
            const light = clamp(0.12 + 0.62 * Math.max(0, dot(n, SKY)) + 0.75 * Math.max(0, dot(n, BACK)) ** 2, 0, 1);
            const lit = hexMix(c.mid, c.lit, light);
            const [ax, ay] = P(th, p0);
            const [bx, by] = P(th, p1);
            const id = `af-pk${gradId++}`;
            const grad = el('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: r1(ax), y1: r1(ay), x2: r1(bx), y2: r1(by) }, defs);
            el('stop', { offset: 0, 'stop-color': c.crease }, grad);
            el('stop', { offset: 0.22, 'stop-color': hexMix(c.crease, lit, 0.8) }, grad);
            el('stop', { offset: 0.5, 'stop-color': lit }, grad);
            el('stop', { offset: 0.78, 'stop-color': hexMix(c.crease, lit, 0.8) }, grad);
            el('stop', { offset: 1, 'stop-color': c.crease }, grad);
            // sub-strips so the lobe's bulge (not just its creases) shapes the silhouette
            let d = '';
            for (let s = 0; s < 3; s++) d += strip(p0 + ((p1 - p0) * s) / 3, p0 + ((p1 - p0) * (s + 1)) / 3);
            el('path', { d, fill: `url(#${id})` }, g);
            el('path', { d, fill: `url(#${aoId})` }, g);
        }

        // rim light along the projected right silhouette (max x per row), strongest at the shoulder
        const rimPts = [];
        for (let i = 2; i <= STEPS - 4; i++) {
            const th = (Math.PI * i) / STEPS;
            let best = null;
            for (let j = 0; j <= 48; j++) {
                const p = P(th, (TAU * j) / 48);
                if (!best || p[0] > best[0]) best = p;
            }
            rimPts.push([best[0] - a * 0.025, best[1]]);
        }
        const rimD = rimPts.map(([px, py], i) => `${i ? 'L' : 'M'}${r1(px)} ${r1(py)}`).join('');
        const rimId = `af-rim${gradId++}`;
        const rimGrad = el('linearGradient', { id: rimId, gradientUnits: 'userSpaceOnUse', x1: 0, y1: r1(top), x2: 0, y2: r1(y) }, defs);
        el('stop', { offset: 0, 'stop-color': SUN, 'stop-opacity': 0 }, rimGrad);
        el('stop', { offset: 0.3, 'stop-color': SUN, 'stop-opacity': 0.7 }, rimGrad);
        el('stop', { offset: 0.85, 'stop-color': SUN, 'stop-opacity': 0 }, rimGrad);
        el('path', { d: rimD, fill: 'none', stroke: `url(#${rimId})`, 'stroke-width': r1(Math.max(0.8, a * 0.02)), 'stroke-linecap': 'round' }, g);

        // stem: flared, ridged and slightly curved, rising out of the sunken crown
        const [sx, sy] = P(0, 0);
        const sh = h * 0.36;
        const sw = rx * 0.08;
        const lean = stemTilt * sh;
        el('path', {
            d: `M${r1(sx - sw * 1.7)} ${r1(sy + sw * 0.4)}C${r1(sx - sw)} ${r1(sy - sh * 0.2)} ${r1(sx - sw * 0.6 + lean * 0.5)} ${r1(sy - sh * 0.75)} ${r1(sx - sw * 0.55 + lean)} ${r1(sy - sh)}` +
                `L${r1(sx + sw * 0.55 + lean)} ${r1(sy - sh * 0.96)}C${r1(sx + sw * 0.7 + lean * 0.5)} ${r1(sy - sh * 0.7)} ${r1(sx + sw)} ${r1(sy - sh * 0.2)} ${r1(sx + sw * 1.8)} ${r1(sy + sw * 0.4)}Z`,
            fill: '#33281a',
        }, g);
        el('path', {
            d: `M${r1(sx + sw * 1.2)} ${r1(sy + sw * 0.1)}C${r1(sx + sw * 0.75)} ${r1(sy - sh * 0.3)} ${r1(sx + sw * 0.6 + lean * 0.5)} ${r1(sy - sh * 0.7)} ${r1(sx + sw * 0.5 + lean)} ${r1(sy - sh * 0.95)}`,
            fill: 'none', stroke: '#b89a62', 'stroke-width': r1(Math.max(0.8, sw * 0.28)), opacity: 0.8,
        }, g);
        el('ellipse', { cx: r1(sx + lean), cy: r1(sy - sh * 0.98), rx: r1(sw * 0.62), ry: r1(sw * 0.24), fill: '#9c8558' }, g);
        return g;
    }

    /** Blades of grass in front of the pumpkins so they sit *in* the ground. */
    function grass(rand, x0, x1, groundY, size) {
        let d = '';
        for (let x = x0; x < x1; x += size * lerp(0.025, 0.06, rand())) {
            const bh = size * lerp(0.03, 0.09, rand());
            const lean = (rand() - 0.5) * bh * 0.9;
            const w = Math.max(0.6, size * 0.011);
            const gy = groundY(x) + size * 0.02;
            d += `M${r1(x - w)} ${r1(gy)}Q${r1(x + lean * 0.3)} ${r1(gy - bh * 0.6)} ${r1(x + lean)} ${r1(gy - bh)}Q${r1(x + lean * 0.4 + w)} ${r1(gy - bh * 0.55)} ${r1(x + w)} ${r1(gy)}Z`;
        }
        return d;
    }

    // ---- build -------------------------------------------------------------------

    let W = 0;
    let H = 0;

    function build() {
        W = window.innerWidth;
        H = window.innerHeight;
        const rand = seeded(20241031);
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.replaceChildren();
        const defs = el('defs', {}, svg);
        const soft = el('filter', { id: 'af-soft', x: '-20%', y: '-50%', width: '140%', height: '200%' }, defs);
        el('feGaussianBlur', { stdDeviation: 4 }, soft);
        const bloom = el('filter', { id: 'af-bloom', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
        el('feGaussianBlur', { stdDeviation: 2.2 }, bloom);

        // sun + glow, partly set behind the far hills
        const sunX = W * (W < 700 ? 0.78 : 0.7);
        const sunY = H * (W < 700 ? 0.665 : 0.625);
        const sunR = clamp(Math.min(W, H) * 0.06, 28, 64);
        const glow = el('radialGradient', { id: 'af-glow' }, defs);
        el('stop', { offset: 0, 'stop-color': SUN, 'stop-opacity': 0.7 }, glow);
        el('stop', { offset: 0.22, 'stop-color': HAZE, 'stop-opacity': 0.32 }, glow);
        el('stop', { offset: 1, 'stop-color': HAZE, 'stop-opacity': 0 }, glow);
        const disc = el('radialGradient', { id: 'af-disc' }, defs);
        el('stop', { offset: 0, 'stop-color': '#fffaf0' }, disc);
        el('stop', { offset: 0.78, 'stop-color': '#ffe7bf' }, disc);
        el('stop', { offset: 1, 'stop-color': '#ffd59a', 'stop-opacity': 0 }, disc);
        const sun = el('g', { class: 'af-layer af-sun', style: '--d: 1' }, svg);
        el('circle', { cx: r1(sunX), cy: r1(sunY), r: r1(sunR * 8), fill: 'url(#af-glow)' }, sun);
        el('circle', { cx: r1(sunX), cy: r1(sunY), r: r1(sunR * 1.12), fill: 'url(#af-disc)' }, sun);

        // long stratus clouds, lit from below by the setting sun
        const cloudGrad = el('linearGradient', { id: 'af-cloud', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
        el('stop', { offset: 0, 'stop-color': '#7a3a4c', 'stop-opacity': 0 }, cloudGrad);
        el('stop', { offset: 0.55, 'stop-color': '#c86a5c', 'stop-opacity': 0.45 }, cloudGrad);
        el('stop', { offset: 1, 'stop-color': '#ffc08a', 'stop-opacity': 0.75 }, cloudGrad);
        const cloudBlur = el('filter', { id: 'af-cloud-blur', x: '-10%', y: '-100%', width: '120%', height: '300%' }, defs);
        el('feGaussianBlur', { stdDeviation: '6 2.5' }, cloudBlur);
        const clouds = el('g', { class: 'af-layer af-clouds', style: '--d: 1.5', filter: 'url(#af-cloud-blur)' }, svg);
        for (let i = 0; i < 4; i++) {
            const cy = H * lerp(0.3, 0.52, i / 3) + (rand() - 0.5) * H * 0.04;
            const cx = W * lerp(0.15, 0.85, rand());
            const len = W * lerp(0.18, 0.36, rand());
            const thick = H * lerp(0.006, 0.014, rand());
            for (let j = 0; j < 3; j++) {
                el('ellipse', {
                    cx: r1(cx + (j - 1) * len * 0.32 + (rand() - 0.5) * len * 0.1),
                    cy: r1(cy + (rand() - 0.5) * thick * 1.2),
                    rx: r1(len * lerp(0.28, 0.45, rand())),
                    ry: r1(thick * lerp(0.7, 1.2, rand())),
                    fill: 'url(#af-cloud)',
                }, clouds);
            }
        }

        ridges = [];
        const treeBase = clamp(H * 0.05, 22, 48);
        LAYERS.forEach((layer, i) => {
            const ridge = ridgeFn(rand, W, H, layer);
            ridges.push(ridge);

            const fillId = `af-l${i}`;
            const lg = el('linearGradient', { id: fillId, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
            el('stop', { offset: 0, 'stop-color': hexMix(layer.color, HAZE, 0.14 - i * 0.025) }, lg);
            el('stop', { offset: 1, 'stop-color': hexMix(layer.color, '#12060c', 0.25 + i * 0.05) }, lg);

            let d = `M-40 ${H + 10}`;
            for (let x = -40; x <= W + 40; x += 12) d += `L${x} ${r1(ridge(x))}`;
            d += `L${W + 40} ${H + 10}Z`;

            // groves and clearings instead of an even comb of trees
            const groveF = TAU / (W * lerp(0.25, 0.45, rand()));
            const groveP = rand() * TAU;
            const grove = (x) => Math.sin(x * groveF + groveP) * 0.5 + 0.5;
            const s = treeBase * layer.tree;
            if (i <= 2) {
                let start = null;
                for (let x = -40; x <= W + 40; x += 8) {
                    const inGrove = grove(x) > 1 - layer.density * 1.3;
                    if (inGrove && start === null) start = x;
                    if ((!inGrove || x >= W + 40) && start !== null) {
                        d += canopy(rand, ridge, start, x, s);
                        start = null;
                    }
                }
            } else {
                for (let x = -30; x < W + 30; x += s * lerp(0.45, 0.8, rand())) {
                    if (rand() > grove(x) * layer.density * 1.5) continue;
                    d += tree(rand, x, ridge(x) + s * 0.12, s * lerp(0.8, 1.2, rand()), i === LAYERS.length - 1);
                }
            }

            const g = el('g', { class: 'af-layer', style: `--d: ${layer.d}` }, svg);
            el('path', { d, fill: `url(#${fillId})` }, g);

            // haze pooling in the valley between this layer and the next one
            if (i < LAYERS.length - 1) {
                const mistId = `af-m${i}`;
                const mg = el('linearGradient', { id: mistId, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
                el('stop', { offset: 0, 'stop-color': HAZE, 'stop-opacity': 0 }, mg);
                el('stop', { offset: 1, 'stop-color': HAZE, 'stop-opacity': 0.3 - i * 0.05 }, mg);
                const next = H * LAYERS[i + 1].base;
                el('rect', { x: -40, y: r1(next - H * 0.075), width: W + 80, height: r1(H * 0.075 + H * LAYERS[i + 1].amp), fill: `url(#${mistId})` }, g);
            }
        });

        // heirloom trio resting in the grass on the nearest hill, away from the sun
        const near = ridges[ridges.length - 1];
        const R = clamp(Math.min(W * 0.08, H * 0.085), 32, 84);
        const px = W < 700 ? W * 0.17 : W * 0.14;
        const sink = (x) => near(x) + R * 0.42;
        const patch = el('g', { class: 'af-layer', style: '--d: 20' }, svg);
        pumpkin(defs, patch, px - R * 1.08, sink(px - R * 1.08) - R * 0.03, R * 0.64, R * 0.92, 'cream', -0.4, 12, 0.06);
        pumpkin(defs, patch, px + R * 1.34, sink(px + R * 1.34) + R * 0.05, R * 0.64, R * 0.62, 'sage', 0.25, 16, 0.11);
        pumpkin(defs, patch, px + R * 0.12, sink(px) + R * 0.12, R, R * 1.12, 'orange', 0.5, 12, 0.075);
        el('path', { d: grass(rand, px - R * 2, px + R * 2.2, sink, R), fill: '#22101a' }, patch);
    }

    // ---- leaves ------------------------------------------------------------------

    const COLORS = ['#e2582b', '#c2410c', '#f59e0b', '#d97706', '#b45309', '#9f1239', '#ca8a04', '#ea580c', '#7c2d12'];
    const SPRITE = 64;
    const rnd = (a, b) => a + Math.random() * (b - a);

    const shapes = {
        maple(g) {
            g.beginPath();
            for (let i = 0; i <= 200; i++) {
                const t = (i / 200) * TAU;
                const lobes = Math.pow(Math.abs(Math.cos(((t + Math.PI / 2) * 5) / 2)), 0.7);
                let r = 15 + 12 * lobes + 1.6 * Math.sin(t * 36);
                r *= 1 - 0.7 * Math.exp(-((t - Math.PI / 2) ** 2) / 0.05);
                i ? g.lineTo(Math.cos(t) * r, Math.sin(t) * r) : g.moveTo(Math.cos(t) * r, Math.sin(t) * r);
            }
            g.closePath();
        },
        oak(g) {
            g.beginPath();
            for (let i = 0; i <= 160; i++) {
                const t = (i / 160) * TAU;
                const r = 25 * (0.78 + 0.2 * Math.sin(t * 7 + 0.6));
                i ? g.lineTo(Math.cos(t) * r * 0.6, Math.sin(t) * r) : g.moveTo(Math.cos(t) * r * 0.6, Math.sin(t) * r);
            }
            g.closePath();
        },
        beech(g) {
            g.beginPath();
            g.moveTo(0, 24);
            g.bezierCurveTo(-22, 10, -18, -16, 0, -28);
            g.bezierCurveTo(18, -16, 22, 10, 0, 24);
            g.closePath();
        },
    };

    function makeSprite(shape, color, back) {
        const c = document.createElement('canvas');
        c.width = c.height = SPRITE;
        const g = c.getContext('2d');
        g.translate(SPRITE / 2, SPRITE / 2);
        const grad = g.createLinearGradient(-26, -26, 26, 26);
        grad.addColorStop(0, hexMix(color, '#ffffff', 0.22));
        grad.addColorStop(0.55, color);
        grad.addColorStop(1, hexMix(color, '#000000', 0.3));
        g.fillStyle = grad;
        shapes[shape](g);
        g.fill();
        g.strokeStyle = 'rgba(70, 25, 5, 0.35)';
        g.lineWidth = 1.2;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(0, 30);
        g.lineTo(0, -22);
        for (const [x, y] of [[-14, -8], [14, -8], [-11, 6], [11, 6]]) {
            g.moveTo(0, y + 6);
            g.lineTo(x, y);
        }
        g.stroke();
        if (back) {
            g.globalCompositeOperation = 'source-atop';
            g.fillStyle = 'rgba(40, 10, 0, 0.3)';
            g.fillRect(-SPRITE / 2, -SPRITE / 2, SPRITE, SPRITE);
        }
        return c;
    }

    const sprites = [];
    for (const shape of Object.keys(shapes)) {
        for (const color of COLORS) sprites.push({ front: makeSprite(shape, color, false), back: makeSprite(shape, color, true) });
    }

    const leaves = [];
    const pointer = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0, nx: 0 };
    const wind = { base: 0.5, target: 0.5, gust: 0, gustTarget: 0 };
    const groundAt = (x) => {
        const near = ridges[ridges.length - 1];
        const far = ridges[ridges.length - 2];
        return near && far ? lerp(far(x), H, Math.random() * 0.9) : H - 20;
    };

    class Leaf {
        constructor(burst, x, y) {
            this.sprite = sprites[(Math.random() * sprites.length) | 0];
            this.depth = burst ? rnd(0.6, 1) : Math.pow(Math.random(), 1.3);
            this.size = lerp(12, 34, this.depth);
            this.burst = burst;
            this.rot = rnd(0, TAU);
            this.spin = rnd(-0.03, 0.03);
            this.tumble = rnd(0, TAU);
            this.tumbleRate = rnd(0.02, 0.07) * (Math.random() < 0.5 ? -1 : 1);
            this.swayPhase = rnd(0, TAU);
            this.swayRate = rnd(0.6, 1.4);
            this.fall = lerp(0.45, 1.25, this.depth) * rnd(0.8, 1.2);
            this.alpha = lerp(0.5, 0.95, this.depth);
            this.t = 0;
            this.resting = false;
            this.rest = 0;
            this.dead = false;
            this.fade = 1;
            this.ground = groundAt(0);
            if (burst) {
                this.x = x;
                this.y = y;
                this.vx = rnd(-3.5, 3.5);
                this.vy = -rnd(3, 7);
                this.ground = groundAt(x);
            } else {
                this.respawn(true);
            }
        }

        respawn(anywhere) {
            this.x = rnd(-0.15 * W, W);
            this.y = anywhere ? rnd(-H, H * 0.8) : rnd(-80, -30);
            this.vx = 0;
            this.vy = this.fall;
            this.resting = false;
            this.fade = 1;
            this.ground = groundAt(this.x);
        }

        update(dt) {
            const k = dt * 60;
            this.t += dt;
            const dx = this.x - pointer.x;
            const dy = this.y - pointer.y;
            const d2 = dx * dx + dy * dy;
            const near = d2 < 150 * 150 ? 1 - Math.sqrt(d2) / 150 : 0;

            if (this.resting) {
                this.rest -= dt;
                const lift = (near > 0 && Math.hypot(pointer.vx, pointer.vy) > 4) || Math.abs(wind.gust) > 2.4 * (1 - this.depth * 0.4);
                if (lift && Math.random() < 0.15) {
                    this.resting = false;
                    this.vy = -rnd(2, 5);
                    this.vx = (near ? pointer.vx * 0.35 : wind.gust) + rnd(-1, 1);
                }
                if (this.rest < 1.2) this.fade = Math.max(0, this.rest / 1.2);
                if (this.rest <= 0) this.burst ? (this.dead = true) : this.respawn(false);
                return;
            }

            // edge-on leaves lose lift and drop, then catch the air again
            const flat = Math.abs(Math.cos(this.tumble));
            const sway = Math.sin(this.t * this.swayRate + this.swayPhase) * (1.3 * flat + 0.2);
            this.vx += ((wind.base + wind.gust) * lerp(0.5, 1.2, this.depth) + sway - this.vx) * 0.04 * k;
            this.vy += (this.fall * (0.55 + (1 - flat) * 1.1) - this.vy) * (this.vy < 0 ? 0.035 : 0.05) * k;
            if (near) {
                this.vx += pointer.vx * 0.06 * near * k;
                this.vy += pointer.vy * 0.06 * near * k;
            }
            this.x += this.vx * k;
            this.y += this.vy * k;
            this.rot += (this.spin + this.vx * 0.004) * k;
            this.tumble += this.tumbleRate * k * (1 + Math.abs(wind.gust) * 0.3);

            if (this.y >= this.ground && this.vy > 0) {
                this.resting = true;
                this.rest = rnd(5, 12);
                this.tumble = Math.round(this.tumble / Math.PI) * Math.PI + rnd(-0.6, 0.6);
            }
            if (this.x > W + 60) this.x = -50;
            if (this.x < -60 && this.vx < 0) this.x = W + 50;
        }

        draw() {
            const c = Math.cos(this.tumble);
            ctx.save();
            ctx.globalAlpha = this.alpha * this.fade;
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rot);
            ctx.scale(Math.max(Math.abs(c), 0.08), 1);
            ctx.drawImage(c >= 0 ? this.sprite.front : this.sprite.back, -this.size / 2, -this.size / 2, this.size, this.size);
            ctx.restore();
        }
    }

    function resizeCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const wanted = clamp(Math.round((W * H) / 42000), 10, 32);
        let current = leaves.filter((l) => !l.burst).length;
        while (current++ < wanted) leaves.push(new Leaf(false));
        leaves.sort((a, b) => a.depth - b.depth);
        for (const l of leaves) l.ground = groundAt(l.x);
    }

    function render() {
        ctx.clearRect(0, 0, W, H);
        for (const l of leaves) l.draw();
    }

    build();
    resizeCanvas();

    if (reduceMotion) {
        render();
        addEventListener('resize', () => (build(), resizeCanvas(), render()));
        return;
    }

    let last = performance.now();
    let nextWind = last + 4000;
    let nextGust = last + rnd(8000, 14000);
    let gustEnd = 0;
    let raf = 0;
    let parallax = 0;

    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        const k = dt * 60;
        last = now;

        if (now > nextWind) {
            wind.target = rnd(-0.3, 1.2);
            nextWind = now + rnd(3500, 8000);
        }
        if (now > nextGust) {
            wind.gustTarget = rnd(2.2, 3.6) * (Math.random() < 0.8 ? 1 : -1);
            gustEnd = now + rnd(1400, 2600);
            nextGust = now + rnd(14000, 26000);
        }
        if (now > gustEnd) wind.gustTarget = 0;
        wind.base += (wind.target - wind.base) * 0.008 * k;
        wind.gust += (wind.gustTarget - wind.gust) * 0.03 * k;
        pointer.vx *= Math.pow(0.85, k);
        pointer.vy *= Math.pow(0.85, k);

        const target = pointer.x > -1e3 ? -pointer.nx : 0;
        if (Math.abs(target - parallax) > 0.001) {
            parallax += (target - parallax) * 0.05 * k;
            root.style.setProperty('--px', parallax.toFixed(3));
        }

        for (let i = leaves.length - 1; i >= 0; i--) {
            leaves[i].update(dt);
            if (leaves[i].dead) leaves.splice(i, 1);
        }
        render();
        raf = requestAnimationFrame(frame);
    }

    let resizeTimer = 0;
    let lastWidth = W;
    addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // mobile URL bars change the height constantly; only rebuild for real resizes
            if (window.innerWidth !== lastWidth || Math.abs(window.innerHeight - H) > 120) {
                lastWidth = window.innerWidth;
                build();
            }
            W = window.innerWidth;
            H = window.innerHeight;
            resizeCanvas();
        }, 150);
    });
    addEventListener('pointermove', (e) => {
        const now = performance.now();
        const dt = Math.max(16, now - pointer.t);
        if (pointer.x > -1e3) {
            pointer.vx = clamp(((e.clientX - pointer.x) / dt) * 16, -30, 30);
            pointer.vy = clamp(((e.clientY - pointer.y) / dt) * 16, -30, 30);
        }
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.nx = (e.clientX / W) * 2 - 1;
        pointer.t = now;
    }, { passive: true });
    document.addEventListener('pointerleave', () => {
        pointer.x = pointer.y = -1e4;
    });
    addEventListener('pointerdown', (e) => {
        const n = Math.min(10, 110 - leaves.length);
        for (let i = 0; i < n; i++) {
            const leaf = new Leaf(true, e.clientX + rnd(-12, 12), e.clientY + rnd(-8, 8));
            const at = leaves.findIndex((l) => l.depth > leaf.depth);
            leaves.splice(at < 0 ? leaves.length : at, 0, leaf);
        }
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
        cancelAnimationFrame(raf);
        if (!document.hidden) {
            last = performance.now();
            raf = requestAnimationFrame(frame);
        }
    });

    raf = requestAnimationFrame(frame);
})();
