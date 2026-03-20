gsap.registerPlugin(ScrollTrigger);

// ──────────────────────────────────────────────
// Canvas setup
// ──────────────────────────────────────────────
const canvas = document.getElementById('cyl-canvas');
const ctx    = canvas.getContext('2d');

function resize() {
    const panel = canvas.parentElement.getBoundingClientRect();
    canvas.width  = panel.width  * devicePixelRatio;
    canvas.height = panel.height * devicePixelRatio;
    canvas.style.width  = panel.width  + 'px';
    canvas.style.height = panel.height + 'px';
    ctx.scale(devicePixelRatio, devicePixelRatio);
    draw();
}
window.addEventListener('resize', resize);

// ──────────────────────────────────────────────
// Cylinder geometry (all in "virtual" CSS px)
// ──────────────────────────────────────────────
const CYL_R  = 90;   // x-radius of cylinder cross-section
const CYL_RY = 28;   // y-radius of top / bottom ellipse (perspective squish)
const CYL_H  = 220;  // full visual height of the cylinder

// Animation state – controlled by GSAP
const state = {
    unroll: 0,      // 0 = full cylinder, 1 = fully flat rectangle
    labelOpacity: 0
};

// ──────────────────────────────────────────────
// Draw helpers
// ──────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t; }

/** Draw a filled ellipse */
function ellipse(cx, cy, rx, ry, fill, stroke) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    if (fill)   { ctx.fillStyle   = fill;   ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}

/**
 * Main render function. 
 * When t=0: draws a 3-D looking cylinder.
 * When t=1: draws the unrolled flat rectangle.
 * Intermediate values show the unrolling in progress.
 */
function draw() {
    const W = canvas.width  / devicePixelRatio;
    const H = canvas.height / devicePixelRatio;

    ctx.clearRect(0, 0, W, H);

    const t = state.unroll;  // 0..1 animation progress

    // ── Centering offsets ─────────────────────
    // In cylinder state  → centred at W * 0.5
    // In rectangle state → also centred but wider
    const rectW = 2 * Math.PI * CYL_R;  // ~565 px at RR=90
    const cx = W / 2;
    const cy = H / 2;

    // ── The "unrolling" concept ───────────────
    // We visualise unrolling as a transition where:
    //  • the curved body straightens out horizontally
    //  • the top / bottom ellipses tilt flat and become straight lines 
    //
    // Animated via a single progress value [0, 1].

    // ─────────────────────────────────────────
    // 1. BODY (the curved rectangle wrap)
    // ─────────────────────────────────────────

    // Current left / right x extents
    const bodyLeft  = cx - lerp(CYL_R,  rectW / 2, t);
    const bodyRight = cx + lerp(CYL_R,  rectW / 2, t);
    const bodyTop   = cy - CYL_H / 2;
    const bodyBot   = cy + CYL_H / 2;

    // Gradient on the body: cylindrical shading → flat colour
    const grad = ctx.createLinearGradient(bodyLeft, 0, bodyRight, 0);
    if (t < 0.5) {
        // cylindrical shading (light from left)
        const fade = t * 2;  // 0..1 during first half
        grad.addColorStop(0,     `hsl(199,89%,${lerp(28, 55, fade)}%)`);
        grad.addColorStop(0.30,  `hsl(199,89%,${lerp(55, 65, fade)}%)`);
        grad.addColorStop(0.50,  `hsl(199,89%,${lerp(70, 65, fade)}%)`);
        grad.addColorStop(0.75,  `hsl(199,89%,${lerp(40, 55, fade)}%)`);
        grad.addColorStop(1,     `hsl(199,89%,${lerp(18, 45, fade)}%)`);
    } else {
        // Flat uniform rectangle colour
        const fade = (t - 0.5) * 2;  // 0..1 during second half
        const l = lerp(55, 55, fade);
        grad.addColorStop(0,   `hsl(199,89%,${l}%)`);
        grad.addColorStop(0.5, `hsl(199,89%,${l + 8}%)`);
        grad.addColorStop(1,   `hsl(199,89%,${l}%)`);
    }

    ctx.fillStyle = grad;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;

    // Body rectangle (top edge curves in cylinder, stays flat in rect)
    const topCurve  = lerp(CYL_RY, 0, t);  // how much the top/bottom cups curve

    // Draw body as a path
    ctx.beginPath();
    ctx.moveTo(bodyLeft,  bodyTop + topCurve);
    // Top edge: ellipse arc (left half only → right half)
    // Simulate curvature via a quadratic bezier control point at cy - CYL_H/2
    ctx.bezierCurveTo(
        bodyLeft,  bodyTop,
        bodyRight, bodyTop,
        bodyRight, bodyTop + topCurve
    );
    ctx.lineTo(bodyRight, bodyBot - topCurve);
    // Bottom edge
    ctx.bezierCurveTo(
        bodyRight, bodyBot,
        bodyLeft,  bodyBot,
        bodyLeft,  bodyBot - topCurve
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ─────────────────────────────────────────
    // 2. CUT LINE GUIDE (appears briefly at t≈0.05)
    // ─────────────────────────────────────────
    if (t > 0.02 && t < 0.35) {
        const alpha = Math.min(1, Math.min(t, 0.35 - t) * 12);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bodyLeft, bodyTop);
        ctx.lineTo(bodyLeft, bodyBot);
        ctx.stroke();
        ctx.setLineDash([]);
        // Scissors icon hint
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 22px serif';
        ctx.fillText('✂', bodyLeft - 20, cy - 10);
        ctx.restore();
    }

    // ─────────────────────────────────────────
    // 3. TOP ELLIPSE CAP
    // ─────────────────────────────────────────
    const topY  = cy - CYL_H / 2;
    const topRY = lerp(CYL_RY, 1.5, t);      // squishes flat as t→1
    const topRX = lerp(CYL_R,  rectW / 2, t); // widens as t→1

    ellipse(cx, topY, topRX, topRY,
        `hsla(199,100%,80%,${lerp(0.75, 0.15, t)})`,
        `rgba(255,255,255,${lerp(0.45, 0.1, t)})`);

    // ─────────────────────────────────────────
    // 4. BOTTOM ELLIPSE CAP
    // ─────────────────────────────────────────
    const botY  = cy + CYL_H / 2;
    const botRY = lerp(CYL_RY, 1.5, t);
    const botRX = topRX;

    ellipse(cx, botY, botRX, botRY,
        `hsla(199,100%,35%,${lerp(0.90, 0.15, t)})`,
        `rgba(255,255,255,${lerp(0.3, 0.1, t)})`);

    // ─────────────────────────────────────────
    // 5. VERTICAL HIGHLIGHT LINE (cylinder shine)
    // ─────────────────────────────────────────
    if (t < 0.6) {
        const alpha = (1 - t / 0.6) * 0.4;
        const hx = cx + lerp(CYL_R * 0.3, 0, t);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = 'white';
        ctx.lineWidth   = lerp(3, 0, t);
        ctx.beginPath();
        ctx.moveTo(hx, topY + topRY);
        ctx.lineTo(hx, botY - botRY);
        ctx.stroke();
        ctx.restore();
    }

    // ─────────────────────────────────────────
    // 6. DIMENSION LABELS (fade in at t>0.85)
    // ─────────────────────────────────────────
    const la = state.labelOpacity;
    if (la > 0) {
        ctx.save();
        ctx.globalAlpha = la;

        // Width brace above rectangle
        const braceY = topY - 22;
        ctx.strokeStyle = '#fcd34d';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(bodyLeft,  topY - 6);
        ctx.lineTo(bodyLeft,  braceY);
        ctx.lineTo(bodyRight, braceY);
        ctx.lineTo(bodyRight, topY - 6);
        ctx.stroke();

        ctx.fillStyle   = '#fcd34d';
        ctx.font        = 'bold 20px "Noto Sans TC", sans-serif';
        ctx.textAlign   = 'center';
        ctx.fillText('展開長度 = 2πr (底圓周長)', cx, braceY - 8);

        // Height brace to the right
        const braceX = bodyRight + 22;
        ctx.beginPath();
        ctx.moveTo(bodyRight + 6, topY);
        ctx.lineTo(braceX,        topY);
        ctx.lineTo(braceX,        botY);
        ctx.lineTo(bodyRight + 6, botY);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillText('高 = h', braceX + 6, cy + 7);

        ctx.restore();
    }
}

// ──────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────
resize();

// ──────────────────────────────────────────────
// GSAP ScrollTrigger
// ──────────────────────────────────────────────
const tl = gsap.timeline({
    scrollTrigger: {
        trigger: '.scroll-container',
        start: 'top top',
        end:   'bottom bottom',
        scrub: 1,
        onUpdate(self) {
            const p = self.progress;
            document.querySelectorAll('.step').forEach((el, i) => {
                const active =
                    (i === 0 && p < 0.18) ||
                    (i === 1 && p >= 0.18 && p < 0.46) ||
                    (i === 2 && p >= 0.46 && p < 0.78) ||
                    (i === 3 && p >= 0.78);
                el.classList.toggle('active', active);
            });
        }
    }
});

// Animate `state.unroll` 0 → 1 over most of the scroll
tl.to(state, {
    unroll: 1,
    duration: 3,
    ease: 'power1.inOut',
    onUpdate: draw
})
// Then fade in labels
.to(state, {
    labelOpacity: 1,
    duration: 1,
    ease: 'power1.out',
    onUpdate: draw
});
