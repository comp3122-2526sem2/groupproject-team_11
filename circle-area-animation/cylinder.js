gsap.registerPlugin(ScrollTrigger);

// ──────────────────────────────────────────────
// Canvas setup
// ──────────────────────────────────────────────
const canvas = document.getElementById('cyl-canvas');
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

// ──────────────────────────────────────────────
// Cylinder geometry
// ──────────────────────────────────────────────
const NUM   = 36;        // number of vertical strips
const CYL_R = 80;        // radius of the cylinder cross-section
const CYL_H = 200;       // cylinder height
const ELLIP = 0.35;      // elliptical perspective ratio for the top/bottom caps

// ──────────────────────────────────────────────
// Calculate strip data
// ──────────────────────────────────────────────
// Each strip is a thin rectangle on the cylinder surface.
// We compute its 3D-projected position AND its final flat position.

const strips = [];
const flatStripW = (2 * Math.PI * CYL_R) / NUM;
const totalFlatW = flatStripW * NUM;

for (let i = 0; i < NUM; i++) {
    const a1 = (i / NUM) * Math.PI * 2;
    const a2 = ((i + 1) / NUM) * Math.PI * 2;
    const midA = (a1 + a2) / 2;

    // 3D projected X positions on the cylinder (orthographic side view)
    const x1_3d = Math.sin(a1) * CYL_R;
    const x2_3d = Math.sin(a2) * CYL_R;

    // Z-depth for painter's algorithm
    const z = -Math.cos(midA);

    // Whether this strip is on the front face of the cylinder
    const isFront = z <= 0; // cos < 0 means front (facing viewer)

    // Brightness based on facing direction (Lambertian-ish)
    const brightness = isFront
        ? 45 + 30 * Math.abs(Math.sin(midA))
        : 18 + 10 * Math.abs(Math.sin(midA));

    // Top/bottom Y offsets due to elliptical cap curvature
    const topY1 = -Math.cos(a1) * CYL_R * ELLIP;
    const topY2 = -Math.cos(a2) * CYL_R * ELLIP;

    // Flat rectangle destination
    const flatX = i * flatStripW - totalFlatW / 2;

    strips.push({
        i, a1, a2, midA, z,
        x1_3d, x2_3d,
        topY1, topY2,
        isFront, brightness,
        flatX, flatStripW
    });
}

// Sort by Z for painter's algorithm (draw back strips first)
strips.sort((a, b) => b.z - a.z);

// ──────────────────────────────────────────────
// Animation state
// ──────────────────────────────────────────────
const state = {
    progress: 0,       // 0 = cylinder, 1 = fully unrolled rectangle
    labelAlpha: 0      // dimension label opacity
};

// ──────────────────────────────────────────────
// Drawing
// ──────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(t) { return Math.max(0, Math.min(1, t)); }

function draw() {
    if (!cW) return;
    ctx.clearRect(0, 0, cW, cH);

    const t = state.progress;
    const cx = cW / 2;
    const cy = cH / 2;

    // ── 1. Draw all strips ─────────────────────
    strips.forEach(s => {
        // Each strip individually transitions from its 3D cylinder position
        // to its flat rectangle position.
        // We stagger the transition: strips near the "cut" start peeling first.

        // The "cut" is at the back of the cylinder (angle = PI, i.e. furthest from viewer).
        // Strips close to PI start unrolling earliest, those at 0 (front center) last.
        // This creates a "peeling from the back" look.

        // Normalised angular distance from the cut point (back center = angle PI)
        const distFromCut = Math.abs(((s.midA + Math.PI) % (2 * Math.PI)) - Math.PI) / Math.PI; // 0..1
        // Stagger: strips near the cut (dist=0) start at t=0, far strips (dist=1) start at t=0.4
        const stripStart = distFromCut * 0.4;
        const stripEnd   = stripStart + 0.55;
        const st = clamp01((t - stripStart) / (stripEnd - stripStart)); // this strip's local progress 0..1

        // ── Interpolate positions ──
        // 3D positions (centred at cx, cy)
        const left3d  = cx + s.x1_3d;
        const right3d = cx + s.x2_3d;
        const width3d = Math.abs(right3d - left3d);

        // Flat positions
        const leftFlat  = cx + s.flatX;
        const widthFlat = s.flatStripW;

        // Current interpolated values
        const curLeft  = lerp(Math.min(left3d, right3d), leftFlat, st);
        const curWidth = lerp(Math.max(width3d, 0.5), widthFlat, st);

        // Top ellipse offset interpolates to zero
        const topOffset1 = lerp(s.topY1, 0, st);
        const topOffset2 = lerp(s.topY2, 0, st);

        // Y positions
        const topY = cy - CYL_H / 2;
        const botY = cy + CYL_H / 2;

        // Colour: from shaded cylinder to uniform flat grey-white
        const flatBright = 72;
        const curBright = lerp(s.brightness, flatBright, st);
        const fill = `hsl(0, 0%, ${curBright}%)`;

        // Border between strips
        const borderAlpha = lerp(0, 0.25, st);

        // Draw the strip as a trapezoid (accounts for ellipse cap curvature)
        ctx.beginPath();
        ctx.moveTo(curLeft,            topY + topOffset1);
        ctx.lineTo(curLeft + curWidth, topY + topOffset2);
        ctx.lineTo(curLeft + curWidth, botY - topOffset2);
        ctx.lineTo(curLeft,            botY - topOffset1);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${borderAlpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Grid lines on the surface (horizontal) - only when still mostly cylindrical
        if (st < 0.8) {
            const gridAlpha = (1 - st / 0.8) * 0.15;
            ctx.strokeStyle = `rgba(255,255,255,${gridAlpha})`;
            ctx.lineWidth = 0.5;
            for (let g = 1; g <= 3; g++) {
                const gy = topY + (CYL_H * g / 4);
                const gTopOff = lerp(topOffset1, topOffset2, g / 4);
                ctx.beginPath();
                ctx.moveTo(curLeft, gy + gTopOff * (1 - g / 4));
                ctx.lineTo(curLeft + curWidth, gy + gTopOff * (1 - g / 4));
                ctx.stroke();
            }
        }
    });

    // ── 2. Top & bottom cap ellipses (fade out as unrolling) ──
    const capAlpha = Math.max(0, 1 - t * 2.5);
    if (capAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = capAlpha;

        // Top cap
        ctx.beginPath();
        ctx.ellipse(cx, cy - CYL_H / 2, CYL_R, CYL_R * ELLIP, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(0, 0%, 90%, 0.55)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Bottom cap (only the front half visible)
        ctx.beginPath();
        ctx.ellipse(cx, cy + CYL_H / 2, CYL_R, CYL_R * ELLIP, 0, 0, Math.PI);
        ctx.fillStyle = 'hsla(0, 0%, 25%, 0.7)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.stroke();

        ctx.restore();
    }

    // ── 3. Cut line indicator ──
    if (t > 0.01 && t < 0.35) {
        const alpha = Math.min(1, Math.min((t - 0.01) * 15, (0.35 - t) * 8));
        ctx.save();
        ctx.globalAlpha = alpha;

        // The cut is at the back of the cylinder (x = cx, which is the back center in our projection)
        // Actually back center maps to sin(PI) = 0, so x = cx
        const cutX = cx;
        const cutTop = cy - CYL_H / 2 - CYL_R * ELLIP;
        const cutBot = cy + CYL_H / 2 + CYL_R * ELLIP;

        ctx.setLineDash([8, 5]);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cutX, cutTop);
        ctx.lineTo(cutX, cutBot);
        ctx.stroke();
        ctx.setLineDash([]);

        // Scissors emoji
        ctx.font = 'bold 28px serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('✂', cutX, cutTop - 8);

        ctx.restore();
    }

    // ── 4. Arrows showing peeling direction ──
    if (t > 0.15 && t < 0.55) {
        const alpha = Math.min(1, Math.min((t - 0.15) * 8, (0.55 - t) * 5));
        ctx.save();
        ctx.globalAlpha = alpha * 0.7;

        // Two curved arrows pointing left and right from the cut
        const arrowY = cy - CYL_H / 2 - 40;
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle   = '#ffffff';
        ctx.lineWidth   = 2;

        // Left arrow
        ctx.beginPath();
        ctx.moveTo(cx - 5,  arrowY);
        ctx.lineTo(cx - 50, arrowY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 50, arrowY);
        ctx.lineTo(cx - 42, arrowY - 6);
        ctx.lineTo(cx - 42, arrowY + 6);
        ctx.fill();

        // Right arrow
        ctx.beginPath();
        ctx.moveTo(cx + 5,  arrowY);
        ctx.lineTo(cx + 50, arrowY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 50, arrowY);
        ctx.lineTo(cx + 42, arrowY - 6);
        ctx.lineTo(cx + 42, arrowY + 6);
        ctx.fill();

        ctx.restore();
    }

    // ── 5. Final rectangle outline + dimension labels ──
    const la = state.labelAlpha;
    if (la > 0.01) {
        ctx.save();
        ctx.globalAlpha = la;

        const rectLeft  = cx - totalFlatW / 2;
        const rectRight = cx + totalFlatW / 2;
        const rectTop   = cy - CYL_H / 2;
        const rectBot   = cy + CYL_H / 2;

        // Dashed rectangle border for emphasis
        ctx.setLineDash([10, 6]);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 2.5;
        ctx.strokeRect(rectLeft, rectTop, totalFlatW, CYL_H);
        ctx.setLineDash([]);

        // Width brace (top)
        const braceY = rectTop - 20;
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(rectLeft,  rectTop - 5);
        ctx.lineTo(rectLeft,  braceY);
        ctx.lineTo(rectRight, braceY);
        ctx.lineTo(rectRight, rectTop - 5);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font      = 'bold 20px "Noto Sans TC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('展開長度 = 2πr（底圓的周長）', cx, braceY - 10);

        // Height brace (right)
        const braceX = rectRight + 20;
        ctx.beginPath();
        ctx.moveTo(rectRight + 5, rectTop);
        ctx.lineTo(braceX,        rectTop);
        ctx.lineTo(braceX,        rectBot);
        ctx.lineTo(rectRight + 5, rectBot);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillText('高度 = h', braceX + 8, cy + 6);

        // Area formula below
        ctx.textAlign = 'center';
        ctx.font = 'bold 24px "Noto Sans TC", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('側面積 = 2πr × h', cx, rectBot + 45);

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
        start:   'top top',
        end:     'bottom bottom',
        scrub:   1,
        onUpdate(self) {
            const p = self.progress;
            document.querySelectorAll('.step').forEach((el, idx) => {
                const active =
                    (idx === 0 && p < 0.15) ||
                    (idx === 1 && p >= 0.15 && p < 0.40) ||
                    (idx === 2 && p >= 0.40 && p < 0.75) ||
                    (idx === 3 && p >= 0.75);
                el.classList.toggle('active', active);
            });
        }
    }
});

// Phase 1: Unroll the cylinder (strips peel outward staggered)
tl.to(state, {
    progress: 1,
    duration: 3,
    ease: 'none',
    onUpdate: draw
});

// Phase 2: Fade in dimension labels
tl.to(state, {
    labelAlpha: 1,
    duration: 1,
    ease: 'power1.out',
    onUpdate: draw
});
