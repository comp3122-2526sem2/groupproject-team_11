gsap.registerPlugin(ScrollTrigger);

// ═══════════════════════════════════════════════
// Canvas Setup
// ═══════════════════════════════════════════════
const canvas = document.getElementById('circle-canvas');
const ctx    = canvas.getContext('2d');
let cW, cH;

function resize() {
    const panel = canvas.parentElement.getBoundingClientRect();
    cW = panel.width;
    cH = panel.height;
    canvas.width  = cW * devicePixelRatio;
    canvas.height = cH * devicePixelRatio;
    canvas.style.width  = cW + 'px';
    canvas.style.height = cH + 'px';
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    draw();
}
window.addEventListener('resize', resize);

// ═══════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════
const N           = 16;
const R           = 130;
const SLICE_ANGLE = (2 * Math.PI) / N;

const COL_EVEN_A = '#06b6d4';
const COL_EVEN_B = '#3b82f6';
const COL_ODD_A  = '#d946ef';
const COL_ODD_B  = '#8b5cf6';

// Half-chord width of one slice at its arc edge
const W = 2 * R * Math.sin(SLICE_ANGLE / 2);

// ═══════════════════════════════════════════════
// Animation State (GSAP drives these)
// ═══════════════════════════════════════════════
const state = {
    tiltX:           15,   // 3D perspective tilt (degrees)
    cutLineProgress: 0,    // 0→1: cut lines appear
    separation:      0,    // 0→1: slices separate along radial direction
    explosion:       0,    // 0→1: slices fly further out
    elevation:       0,    // shadow offset for 3D depth effect
    rowArrange:      0,    // 0→1: sort into two rows
    interlock:       0,    // 0→1: two rows merge into rectangle
    labelAlpha:      0     // final labels
};

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════
function lerp(a, b, t)  { return a + (b - a) * t; }
function clamp01(t)     { return Math.max(0, Math.min(1, t)); }

// Normalise angle into [−PI, PI]
function normAngle(a) {
    while (a >  Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
}

// ═══════════════════════════════════════════════
// Draw a pie-slice path at the ORIGIN
//   tip at (0,0), symmetric about angle=−PI/2 (i.e. pointing up)
//   then the caller translate/rotate to place it.
// ═══════════════════════════════════════════════
function slicePath_atOrigin(r, halfAngle, scaleY) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const steps = 24;
    for (let s = 0; s <= steps; s++) {
        const a = -halfAngle + (2 * halfAngle) * (s / steps);
        // slice tip points "up" → angle = −PI/2
        const px = Math.sin(a) * r;   // sin ↔ x spread
        const py = -Math.cos(a) * r * scaleY;  // −cos → upward
        ctx.lineTo(px, py);
    }
    ctx.closePath();
}

// ═══════════════════════════════════════════════
// Per-slice transform for each phase
// ═══════════════════════════════════════════════
function getSliceState(i) {
    const isEven   = i % 2 === 0;
    const midAngle = -Math.PI / 2 + (i + 0.5) * SLICE_ANGLE; // world direction of this slice

    const cx = cW / 2;
    const cy = cH / 2;

    // ── Circle / separated / exploded position ──
    const sepDist = state.separation * 30  + state.explosion * 130;
    const circX   = cx + Math.cos(midAngle) * sepDist;
    const circY   = cy + Math.sin(midAngle) * sepDist;
    // Rotation so the slice "points outward" from center (tip at center, arc outward)
    const circRot = midAngle + Math.PI / 2;

    // ── Row target position ──
    const k         = Math.floor(i / 2);
    const numPairs  = N / 2; // 8
    const totalW    = numPairs * W;
    const offsetX   = -totalW / 2;

    // Even slices: tip points DOWN (rotation = PI), placed in top row
    // Odd slices:  tip points UP   (rotation = 0),  placed in bottom row
    const rowX   = cx + offsetX + (isEven ? k * W + W / 2 : k * W + W);
    const rowGap = R + 80;
    const rowY   = isEven ? cy - rowGap / 2 : cy + rowGap / 2;
    const rowRot = isEven ? Math.PI : 0;

    // ── Interlock target ──
    // Same X, but Y collapses to center
    const lockY = isEven ? cy - R * 0.02 : cy + R * 0.02;

    // ── Interpolate ──
    const tR = state.rowArrange;
    const tL = state.interlock;
    const tiltRad = state.tiltX * Math.PI / 180;

    let x, y, rot, scaleY;

    if (tR <= 0 && tL <= 0) {
        // Phase 2–3: circle / explosion
        x      = circX;
        y      = circY;
        rot    = circRot;
        scaleY = Math.cos(tiltRad);
    } else if (tL <= 0) {
        // Phase 4: transition to row
        // Smoothly interpolate rotation (shortest path)
        let targetRot = rowRot;
        let srcRot    = circRot;
        // Normalise difference
        let diff = normAngle(targetRot - srcRot);
        rot    = srcRot + diff * tR;

        x      = lerp(circX, rowX, tR);
        y      = lerp(circY, rowY, tR);
        scaleY = lerp(Math.cos(tiltRad), 1, tR);
    } else {
        // Phase 5: interlock
        x      = rowX;
        y      = lerp(rowY, lockY, tL);
        rot    = rowRot;
        scaleY = 1;
    }

    return { x, y, rot, scaleY, isEven, index: i, midAngle };
}

// ═══════════════════════════════════════════════
// Gradient for a slice (in local coords after translate/rotate)
// ═══════════════════════════════════════════════
function makeSliceGrad(isEven) {
    const a = isEven ? COL_EVEN_A : COL_ODD_A;
    const b = isEven ? COL_EVEN_B : COL_ODD_B;
    const grad = ctx.createLinearGradient(0, 0, 0, -R);
    grad.addColorStop(0, a);
    grad.addColorStop(1, b);
    return grad;
}

// ═══════════════════════════════════════════════
// Main draw
// ═══════════════════════════════════════════════
function draw() {
    if (!cW) return;
    ctx.clearRect(0, 0, cW, cH);

    const cx = cW / 2;
    const cy = cH / 2;
    const tiltRad = state.tiltX * Math.PI / 180;
    const scaleY  = Math.cos(tiltRad);
    const halfA   = SLICE_ANGLE / 2;

    const separated = state.separation > 0.005 || state.rowArrange > 0.005;

    // ════════════════════════════════════════
    // A) Full / cut circle  (Phases 0–1)
    // ════════════════════════════════════════
    if (!separated) {
        // -- Drop shadow --
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx + 3, cy + 10, R + 2, (R + 2) * scaleY, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();
        ctx.restore();

        // -- Filled circle (alternating colours) --
        for (let i = 0; i < N; i++) {
            const sA = -Math.PI / 2 + i * SLICE_ANGLE;
            const eA = sA + SLICE_ANGLE;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            const steps = 20;
            for (let s = 0; s <= steps; s++) {
                const a = sA + (eA - sA) * (s / steps);
                ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R * scaleY);
            }
            ctx.closePath();
            const isEven = i % 2 === 0;
            const colA = isEven ? COL_EVEN_A : COL_ODD_A;
            const colB = isEven ? COL_EVEN_B : COL_ODD_B;
            const g = ctx.createLinearGradient(cx, cy, cx + Math.cos((sA+eA)/2)*R, cy + Math.sin((sA+eA)/2)*R*scaleY);
            g.addColorStop(0, colA);
            g.addColorStop(1, colB);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.restore();
        }

        // -- 3D rim highlights --
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, R, R * scaleY, 0, Math.PI, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, R, R * scaleY, 0, 0, Math.PI);
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // -- Outer edge --
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, R, R * scaleY, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // -- Phase 1: animated cut lines --
        if (state.cutLineProgress > 0.005) {
            const total   = state.cutLineProgress * N;
            const nFull   = Math.floor(total);
            const partial = total - nFull;

            for (let i = 0; i < N && i <= nFull; i++) {
                const angle = -Math.PI / 2 + i * SLICE_ANGLE;
                const len   = (i < nFull) ? R : R * partial;
                const ex    = cx + Math.cos(angle) * len;
                const ey    = cy + Math.sin(angle) * len * scaleY;

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(ex, ey);
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth   = 2;
                ctx.setLineDash([4, 3]);
                ctx.shadowColor = '#fbbf24';
                ctx.shadowBlur  = 8;
                ctx.stroke();
                ctx.restore();
            }

            // Scissors at the tip of the latest partial line
            if (nFull < N) {
                const angle = -Math.PI / 2 + nFull * SLICE_ANGLE;
                const len   = R * partial;
                const sx    = cx + Math.cos(angle) * len;
                const sy    = cy + Math.sin(angle) * len * scaleY;
                ctx.save();
                ctx.font      = '24px serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('✂️', sx, sy);
                ctx.restore();
            }
        }

        // Center dot
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
        ctx.restore();

    } else {
        // ════════════════════════════════════════
        // B) Separated slices  (Phases 2–5)
        // ════════════════════════════════════════
        const slices = [];
        for (let i = 0; i < N; i++) slices.push(getSliceState(i));

        // Painter sort: draw furthest-from-viewer first (use Y as proxy)
        slices.sort((a, b) => a.y - b.y);

        slices.forEach(s => {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.rot);

            // ── Shadow ──
            const elev = state.elevation;
            if (elev > 0.01) {
                ctx.save();
                ctx.globalAlpha = 0.2 * clamp01(elev);
                slicePath_atOrigin(R, halfA, s.scaleY);
                ctx.translate(4, 6 + elev * 12);
                slicePath_atOrigin(R, halfA, s.scaleY);
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fill();
                ctx.restore();
            }

            // ── Slice body ──
            slicePath_atOrigin(R, halfA, s.scaleY);
            ctx.fillStyle = makeSliceGrad(s.isEven);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // ── 3D arc highlight ──
            if (s.scaleY < 0.97) {
                ctx.beginPath();
                const arcSteps = 16;
                for (let k = 0; k <= arcSteps; k++) {
                    const a = -halfA + 2 * halfA * (k / arcSteps);
                    const px = Math.sin(a) * R;
                    const py = -Math.cos(a) * R * s.scaleY;
                    if (k === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            ctx.restore();
        });
    }

    // ════════════════════════════════════════
    // C) Dimension labels  (Phase 6)
    // ════════════════════════════════════════
    const la = state.labelAlpha;
    if (la > 0.01) {
        ctx.save();
        ctx.globalAlpha = la;

        const totalW   = (N / 2) * W;
        const rectLeft = cx - totalW / 2;
        const rectRight= cx + totalW / 2;
        const halfH    = R;
        const rectTop  = cy - halfH;
        const rectBot  = cy + halfH;

        // Dashed rectangle
        ctx.setLineDash([10, 6]);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth   = 2.5;
        ctx.strokeRect(rectLeft, rectTop, totalW, halfH * 2);
        ctx.setLineDash([]);

        // Top brace
        const brY = rectTop - 22;
        ctx.strokeStyle = '#fcd34d';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(rectLeft,  rectTop - 5);
        ctx.lineTo(rectLeft,  brY);
        ctx.lineTo(rectRight, brY);
        ctx.lineTo(rectRight, rectTop - 5);
        ctx.stroke();

        ctx.fillStyle = '#fcd34d';
        ctx.font      = 'bold 20px "Noto Sans TC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('長度 = πr（半周長）', cx, brY - 12);

        // Right brace
        const brX = rectRight + 22;
        ctx.beginPath();
        ctx.moveTo(rectRight + 5, rectTop);
        ctx.lineTo(brX,           rectTop);
        ctx.lineTo(brX,           rectBot);
        ctx.lineTo(rectRight + 5, rectBot);
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.fillText('高 = r', brX + 8, cy + 6);

        // Formula
        ctx.textAlign = 'center';
        ctx.font      = 'bold 26px "Noto Sans TC", sans-serif';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('面積 A = πr × r = πr²', cx, rectBot + 50);

        ctx.restore();
    }
}

// ═══════════════════════════════════════════════
// Boot
// ═══════════════════════════════════════════════
resize();

// ═══════════════════════════════════════════════
// GSAP ScrollTrigger Timeline
// ═══════════════════════════════════════════════
const tl = gsap.timeline({
    scrollTrigger: {
        trigger: '.scroll-container',
        start:   'top top',
        end:     'bottom bottom',
        scrub:   1.2,
        onUpdate(self) {
            const p = self.progress;
            document.querySelectorAll('.step').forEach((el, idx) => {
                const active =
                    (idx === 0 && p < 0.10)  ||
                    (idx === 1 && p >= 0.10 && p < 0.22) ||
                    (idx === 2 && p >= 0.22 && p < 0.36) ||
                    (idx === 3 && p >= 0.36 && p < 0.50) ||
                    (idx === 4 && p >= 0.50 && p < 0.65) ||
                    (idx === 5 && p >= 0.65 && p < 0.82) ||
                    (idx === 6 && p >= 0.82);
                el.classList.toggle('active', active);
            });
        }
    }
});

// Phase 0 — gentle 3D tilt hold
tl.to(state, { tiltX: 12,  duration: 0.8,  ease: 'power1.inOut', onUpdate: draw });

// Phase 1 — cut lines sweep around the circle
tl.to(state, { cutLineProgress: 1, tiltX: 5, duration: 1.5, ease: 'none', onUpdate: draw });

// Phase 2 — slices pop apart slightly
tl.to(state, { separation: 1, tiltX: 3, elevation: 0.6, duration: 1.2, ease: 'power2.out', onUpdate: draw });

// Phase 3 — full explosion outward
tl.to(state, { explosion: 1, elevation: 1, tiltX: 0, duration: 1.5, ease: 'power2.inOut', onUpdate: draw });

// Phase 4 — rearrange into two rows
tl.to(state, { rowArrange: 1, elevation: 0.3, duration: 2, ease: 'power2.inOut', onUpdate: draw });

// Phase 5 — interlock into rectangle
tl.to(state, { interlock: 1, elevation: 0, duration: 1.8, ease: 'back.out(1.2)', onUpdate: draw });

// Phase 6 — dimension labels
tl.to(state, { labelAlpha: 1, duration: 1, ease: 'power1.out', onUpdate: draw });
