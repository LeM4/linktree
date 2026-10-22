(() => {
    const root = document.getElementById('theme-halloween');
    const canvas = root && root.querySelector('.hw-bats');
    const ctx = canvas && canvas.getContext('2d');
    if (!ctx) return;

    const TAU = Math.PI * 2;
    const rand = (a, b) => a + Math.random() * (b - a);
    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Far bats fade into the indigo haze, near bats are pure ink (atmospheric perspective).
    const FAR = [78, 68, 130];
    const NEAR = [8, 6, 16];
    const tone = (d) => `rgb(${FAR.map((c, i) => Math.round(lerp(c, NEAR[i], d))).join(',')})`;

    let W = 0, H = 0, dpr = 1;
    const pointer = { x: -1e4, y: -1e4 };
    const bats = [];

    // ---- moonlit landscape (SVG, generated for the real viewport) -------------------

    const NS = 'http://www.w3.org/2000/svg';
    const land = root.querySelector('.hw-land');
    const r1 = (n) => Math.round(n * 10) / 10;
    const LAYERS = [
        { base: 0.7, amp: 0.035, color: '#3a3266', d: 2 },
        { base: 0.77, amp: 0.04, color: '#262046', d: 5 },
        { base: 0.85, amp: 0.035, color: '#16122a', d: 10 },
        { base: 0.93, amp: 0.025, color: '#08060f', d: 16 },
    ];

    function seeded(seed) {
        return () => {
            seed = (seed + 0x6d2b79f5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /** Gnarled bare tree: recursive, slightly curved branches that taper. */
    function bareTree(rnd, strokes, x, y, len, width, depth, angle = -Math.PI / 2) {
        const x2 = x + Math.cos(angle) * len;
        const y2 = y + Math.sin(angle) * len;
        const cx = (x + x2) / 2 + (rnd() - 0.5) * len * 0.3;
        const cy = (y + y2) / 2 + (rnd() - 0.5) * len * 0.3;
        const key = Math.max(0.6, r1(width));
        strokes.set(key, (strokes.get(key) || '') + `M${r1(x)} ${r1(y)}Q${r1(cx)} ${r1(cy)} ${r1(x2)} ${r1(y2)}`);
        if (depth === 0 || len < 2.5) return;
        const n = rnd() < 0.7 ? 2 : 3;
        for (let i = 0; i < n; i++) {
            const spread = lerp(0.35, 0.7, rnd());
            const a = angle + (i - (n - 1) / 2) * spread + (rnd() - 0.5) * 0.35 - (angle + Math.PI / 2) * 0.15;
            bareTree(rnd, strokes, x2, y2, len * lerp(0.62, 0.8, rnd()), width * 0.64, depth - 1, a);
        }
    }

    function buildLand() {
        if (!land) return;
        const rnd = seeded(1031);
        land.setAttribute('viewBox', `0 0 ${W} ${H}`);
        land.replaceChildren();
        LAYERS.forEach((layer, i) => {
            const waves = [0.6, 0.3, 0.1].map((w, k) => ({ w, f: TAU / (W * [0.85, 0.4, 0.16][k] * lerp(0.8, 1.2, rnd())), p: rnd() * TAU }));
            const ridge = (x) => H * layer.base + H * layer.amp * waves.reduce((s, v) => s + v.w * Math.sin(x * v.f + v.p), 0);
            const g = document.createElementNS(NS, 'g');
            g.setAttribute('class', 'hw-layer');
            g.setAttribute('style', `--d: ${layer.d}`);
            let d = `M-40 ${H + 10}`;
            for (let x = -40; x <= W + 40; x += 12) d += `L${x} ${r1(ridge(x))}`;
            d += `L${W + 40} ${H + 10}Z`;
            const hill = document.createElementNS(NS, 'path');
            hill.setAttribute('d', d);
            hill.setAttribute('fill', layer.color);
            g.appendChild(hill);

            const strokes = new Map();
            const scale = clamp(H / 900, 0.6, 1.3) * [0.35, 0.55, 0.8, 1][i];
            if (i === LAYERS.length - 1) {
                // two big trees frame the composition at the edges
                bareTree(rnd, strokes, W * 0.04, ridge(W * 0.04) + 6, 110 * scale, 14 * scale, 7, -Math.PI / 2 + 0.12);
                bareTree(rnd, strokes, W * 0.97, ridge(W * 0.97) + 6, 80 * scale, 10 * scale, 6, -Math.PI / 2 - 0.15);
            } else if (i > 0) {
                for (let x = rnd() * 80; x < W; x += lerp(90, 260, rnd()) * (i === 1 ? 1.4 : 1)) {
                    if (rnd() < 0.35) continue;
                    bareTree(rnd, strokes, x, ridge(x) + 3, lerp(26, 46, rnd()) * scale, lerp(4, 6, rnd()) * scale, 5, -Math.PI / 2 + (rnd() - 0.5) * 0.2);
                }
            }
            for (const [w, sd] of strokes) {
                const p = document.createElementNS(NS, 'path');
                p.setAttribute('d', sd);
                p.setAttribute('fill', 'none');
                p.setAttribute('stroke', layer.color);
                p.setAttribute('stroke-width', w);
                p.setAttribute('stroke-linecap', 'round');
                g.appendChild(p);
            }
            land.appendChild(g);
        });
    }

    /** Frontal bat silhouette. `w` is the wing phase from -1 (down) to 1 (up). */
    function drawBat(s, w, eyes) {
        const tipY = -w * s * 0.62;
        const wristY = -w * s * 0.28 - s * 0.06;
        const span = 1 - Math.abs(w) * 0.18;
        ctx.beginPath();
        for (const side of [-1, 1]) {
            const tipX = side * s * span;
            ctx.moveTo(0, -s * 0.12);
            ctx.quadraticCurveTo(side * s * 0.3, wristY - s * 0.22, side * s * 0.52 * span, wristY);
            ctx.quadraticCurveTo(side * s * 0.82 * span, tipY - s * 0.12, tipX, tipY);
            // scalloped trailing edge between the "fingers"
            const edge = [
                [tipX * 0.74, lerp(tipY, s * 0.2, 0.55)],
                [tipX * 0.46, lerp(wristY, s * 0.3, 0.8)],
                [tipX * 0.2, s * 0.24],
                [0, s * 0.18],
            ];
            let px = tipX, py = tipY;
            for (const [qx, qy] of edge) {
                ctx.quadraticCurveTo((px + qx) / 2, (py + qy) / 2 - s * 0.13, qx, qy);
                px = qx;
                py = qy;
            }
            ctx.closePath();
        }
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(0, s * 0.05, s * 0.12, s * 0.23, 0, 0, TAU);
        ctx.moveTo(s * 0.1, -s * 0.2);
        ctx.arc(0, -s * 0.2, s * 0.1, 0, TAU);
        ctx.moveTo(-s * 0.095, -s * 0.23);
        ctx.lineTo(-s * 0.075, -s * 0.42);
        ctx.lineTo(-s * 0.015, -s * 0.28);
        ctx.moveTo(s * 0.095, -s * 0.23);
        ctx.lineTo(s * 0.075, -s * 0.42);
        ctx.lineTo(s * 0.015, -s * 0.28);
        ctx.fill();

        if (eyes) {
            ctx.save();
            ctx.fillStyle = '#ffb347';
            ctx.shadowColor = '#ff8a1f';
            ctx.shadowBlur = s * 0.4;
            ctx.beginPath();
            ctx.arc(-s * 0.04, -s * 0.21, s * 0.022, 0, TAU);
            ctx.arc(s * 0.04, -s * 0.21, s * 0.022, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
    }

    class Bat {
        constructor(kind = 'cruise', x, y) {
            this.kind = kind;
            this.depth = kind === 'burst' ? rand(0.7, 1) : kind === 'swoop' ? 1 : Math.pow(Math.random(), 1.5);
            this.size = kind === 'swoop' ? rand(70, 95) : lerp(6, 24, this.depth);
            this.speed = (kind === 'swoop' ? 9 : lerp(0.7, 2.6, this.depth)) * rand(0.85, 1.15);
            this.phase = rand(0, TAU);
            this.flapRate = lerp(19, 10, this.depth) * rand(0.85, 1.15);
            this.wander = rand(0.4, 1.3);
            this.t = rand(0, 100);
            this.panic = kind === 'burst' ? 1 : 0;
            this.wing = 0;
            this.dead = false;

            if (kind === 'burst') {
                const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
                this.x = x;
                this.y = y;
                this.vx = Math.cos(a) * this.speed * 3;
                this.vy = Math.sin(a) * this.speed * 3;
            } else if (kind === 'swoop') {
                const fromLeft = Math.random() < 0.5;
                this.x = fromLeft ? -120 : W + 120;
                this.y = rand(H * 0.55, H * 0.85);
                this.vx = (fromLeft ? 1 : -1) * this.speed;
                this.vy = -rand(3, 5);
            } else {
                this.spawnAtEdge(true);
            }
        }

        spawnAtEdge(anywhere) {
            const fromLeft = Math.random() < 0.5;
            this.x = anywhere ? rand(0, W) : fromLeft ? -40 : W + 40;
            this.y = rand(H * 0.04, H * 0.62);
            this.vx = (fromLeft ? 1 : -1) * this.speed;
            this.vy = rand(-0.3, 0.3);
        }

        update(dt) {
            const k = dt * 60;
            this.t += dt;

            if (this.kind === 'swoop') {
                this.vy += 0.09 * k; // arc up then away
            } else {
                const targetVy = Math.sin(this.t * this.wander + this.phase) * this.speed * 0.55;
                this.vy += (targetVy - this.vy) * 0.025 * k;
                if (this.y > H * 0.68) this.vy -= 0.06 * k;
                if (this.y < 16) this.vy += 0.06 * k;

                const dx = this.x - pointer.x;
                const dy = this.y - pointer.y;
                const R = 150 + this.size * 2;
                const d2 = dx * dx + dy * dy;
                if (d2 < R * R) {
                    const d = Math.sqrt(d2) || 1;
                    const f = (1 - d / R) * 1.4 * k;
                    this.vx += (dx / d) * f;
                    this.vy += (dy / d) * f;
                    this.panic = 1;
                }

                // relax toward cruising speed, faster while panicking
                const sp = Math.hypot(this.vx, this.vy) || 1;
                const target = this.speed * (1 + this.panic * 1.8);
                const r = 1 + (target / sp - 1) * 0.04 * k;
                this.vx *= r;
                this.vy *= r;
                this.panic *= Math.pow(0.975, k);
            }

            this.x += this.vx * k;
            this.y += this.vy * k;

            // occasional glides make the flock look alive instead of mechanical
            const gliding = this.kind === 'cruise' && Math.sin(this.t * 0.35 + this.phase) > 0.82 && this.panic < 0.2;
            this.phase += dt * this.flapRate * (1 + this.panic * 0.8) * (gliding ? 0.15 : 1);
            this.wing = gliding ? lerp(this.wing, 0.25, 0.08) : Math.sin(this.phase);

            const m = this.size + 60;
            const out = this.x < -m || this.x > W + m || this.y < -m || this.y > H + m;
            if (out) {
                if (this.kind === 'cruise') this.spawnAtEdge(false);
                else this.dead = true;
            }
        }

        draw() {
            const facing = this.vx < 0 ? -1 : 1;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(clamp(this.vy * 0.07, -0.45, 0.45) * facing);
            ctx.globalAlpha = this.kind === 'swoop' ? 0.92 : lerp(0.45, 1, this.depth);
            ctx.fillStyle = tone(Math.min(1, this.depth));
            if (this.kind === 'swoop') ctx.filter = 'blur(2px)';
            else if (this.depth > 0.3) {
                // moonlit rim so dark bats still read against the night sky
                ctx.shadowColor = 'rgba(205, 170, 255, 0.55)';
                ctx.shadowBlur = 3 + this.depth * 7;
            }
            drawBat(this.size, this.wing, this.depth > 0.72 && this.kind !== 'swoop');
            ctx.restore();
        }
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const widthChanged = window.innerWidth !== W;
        W = window.innerWidth;
        H = window.innerHeight;
        if (widthChanged) buildLand();
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const wanted = clamp(Math.round((W * H) / 52000), 7, 24);
        const cruising = bats.filter((b) => b.kind === 'cruise');
        while (cruising.length < wanted) {
            const b = new Bat('cruise');
            cruising.push(b);
            bats.push(b);
        }
    }

    function render() {
        ctx.clearRect(0, 0, W, H);
        bats.sort((a, b) => a.depth - b.depth);
        for (const b of bats) b.draw();
    }

    resize();

    if (reduceMotion) {
        bats.forEach((b) => (b.wing = Math.sin(b.phase)));
        render();
        addEventListener('resize', () => (resize(), render()));
        return;
    }

    let last = performance.now();
    let nextSwoop = last + rand(9000, 16000);
    let raf = 0;
    let parallax = 0;

    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const target = pointer.x > -1e3 ? -((pointer.x / W) * 2 - 1) : 0;
        if (Math.abs(target - parallax) > 0.001) {
            parallax += (target - parallax) * 0.05 * dt * 60;
            root.style.setProperty('--px', parallax.toFixed(3));
        }
        if (now > nextSwoop) {
            bats.push(new Bat('swoop'));
            nextSwoop = now + rand(18000, 32000);
        }
        for (let i = bats.length - 1; i >= 0; i--) {
            bats[i].update(dt);
            if (bats[i].dead) bats.splice(i, 1);
        }
        render();
        raf = requestAnimationFrame(frame);
    }

    let resizeTimer = 0;
    addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 120);
    });
    addEventListener('pointermove', (e) => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
    }, { passive: true });
    document.addEventListener('pointerleave', () => {
        pointer.x = pointer.y = -1e4;
    });
    // Tap anywhere to release a small colony.
    addEventListener('pointerdown', (e) => {
        const n = Math.min(9, 60 - bats.length);
        for (let i = 0; i < n; i++) bats.push(new Bat('burst', e.clientX, e.clientY));
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
