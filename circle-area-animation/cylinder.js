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
// Geometry constants
// ──────────────────────────────────────────────
const NUM      = 80;           // strips for smooth rendering
const CYL_R    = 80;           // cylinder radius
const CYL_H    = 190;          // cylinder height
const ELLIP    = 0.35;         // perspective ratio for elliptical caps
const GRID_H   = 5;            // horizontal grid lines
const GRID_V   = 16;           // vertical grid line pairs

const totalFlatW = 2 * Math.PI * CYL_R;
const stripAngle = (2 * Math.PI) / NUM;
const flatStripW = totalFlatW / NUM;

// ──────────────────────────────────────────────
// Animation state  (GSAP drives these)
// ──────────────────────────────────────────────
const state = {
    // Phase 0: slow rotate so students feel the 3D shape
    rotation:        0,       // base rotation angle (radians)
    // Phase 1: highlight circumference
    circumHighlight: 0,       // 0→1 trace the bottom circle
    circumGlow:      0,       // pulsing glow for the circle line
    // Phase 2: scissors cut
    cutProgress:     0,       // 0→1 scissors move top→bottom
    // Phase 3: unfold the surface like opening a book
    unfold:          0,       // 0→1 surface opens flat
    // Phase 4: colour mapping and edge highlight
    mapHighlight:    0,       // 0→1 highlight bottom edge mapping
    // Phase 5: dimension labels + formula
    labelAlpha:      0
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(t)     { return Math.max(0, Math.min(1, t)); }
function easeInOutCubic(t) {
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
}

// ──────────────────────────────────────────────
// Drawing
// ──────────────────────────────────────────────

function draw() {
    if (!cW) return;
    ctx.clearRect(0, 0, cW, cH);

    const cx = cW / 2;
    const cy = cH / 2;
    const baseRot = state.rotation;
    const unfold  = state.unfold;

    // ════════════════════════════════════════════
    // Build strip data for current frame
    // ════════════════════════════════════════════
    const strips = [];
    // The cut is at angle PI (back of cylinder)
    const cutAngle = Math.PI;

    for (let i = 0; i < NUM; i++) {
        const a1 = (i / NUM) * 2 * Math.PI + baseRot;
        const a2 = ((i + 1) / NUM) * 2 * Math.PI + baseRot;
        const midA = (a1 + a2) / 2;

        // normalised index for flat layout (0..NUM-1 mapped to position)
        const flatIdx = i;
        const flatX = flatIdx * flatStripW - totalFlatW / 2;

        // Angular distance from cut point (for unfold ordering)
        // Wrap midA into [0, 2PI]
        let normMid = ((midA % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        // Distance from PI (the cut)
        let distFromCut = Math.abs(normMid - cutAngle);
        if (distFromCut > Math.PI) distFromCut = 2 * Math.PI - distFromCut;
        // normalise: 0 = at cut, 1 = opposite side
        const distNorm = distFromCut / Math.PI;

        // Which side of cut? left or right
        let diff = normMid - cutAngle;
        if (diff > Math.PI) diff -= 2 * Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;
        const side = diff >= 0 ? 1 : -1; // +1 = right of cut, -1 = left

        // ── 3D cylinder positions ──
        const x1_3d = Math.sin(a1) * CYL_R;
        const x2_3d = Math.sin(a2) * CYL_R;
        const z     = -Math.cos(midA); // depth for painter's algo
        const isFront = Math.cos(midA) < 0;

        // Brightness (Lambertian-ish)
        const brightness = isFront
            ? 50 + 28 * Math.abs(Math.sin(midA))
            : 20 + 12 * Math.abs(Math.sin(midA));

        // Top/bottom elliptical offsets
        const topY1 = -Math.cos(a1) * CYL_R * ELLIP;
        const topY2 = -Math.cos(a2) * CYL_R * ELLIP;

        strips.push({
            i, a1, a2, midA, z,
            x1_3d, x2_3d,
            topY1, topY2,
            isFront, brightness,
            flatX, flatStripW,
            distNorm, side, distFromCut
        });
    }

    // Sort by Z for painter's algorithm
    strips.sort((a, b) => b.z - a.z);

    // ════════════════════════════════════════════
    // Render strips
    // ════════════════════════════════════════════
    const topYbase = cy - CYL_H / 2;
    const botYbase = cy + CYL_H / 2;

    strips.forEach(s => {
        // Staggered unfold: strips near cut unfold first, far strips later
        // This creates a "page turning" effect from the cut outward
        const stripDelay = s.distNorm * 0.55;
        const stripDur   = 0.4;
        const st = clamp01((unfold - stripDelay) / stripDur);
        const stSmooth = easeInOutCubic(st);

        // 3D positions
        const left3d  = cx + Math.min(s.x1_3d, s.x2_3d);
        const width3d = Math.abs(s.x2_3d - s.x1_3d);

        // Flat positions
        const leftFlat  = cx + s.flatX;
        const widthFlat = s.flatStripW;

        // Interpolate
        const curLeft  = lerp(left3d, leftFlat, stSmooth);
        const curWidth = lerp(Math.max(width3d, 0.4), widthFlat, stSmooth);

        const topOff1 = lerp(s.topY1, 0, stSmooth);
        const topOff2 = lerp(s.topY2, 0, stSmooth);

        // Color: cylinder shading → uniform flat
        const flatBright = 58;
        const curBright = lerp(s.brightness, flatBright, stSmooth);

        // Add subtle alternating tint for every 5th vertical strip group
        const groupIdx = Math.floor(s.i / (NUM / GRID_V));
        const isAltGroup = groupIdx % 2 === 0;
        const hue = isAltGroup ? 220 : 200;
        const sat = lerp(0, 8, stSmooth);
        const fill = `hsl(${hue}, ${sat}%, ${curBright}%)`;

        // Border visibility
        const borderAlpha = lerp(0, 0.12, stSmooth);

        // Draw strip
        ctx.beginPath();
        ctx.moveTo(curLeft,            topYbase + topOff1);
        ctx.lineTo(curLeft + curWidth, topYbase + topOff2);
        ctx.lineTo(curLeft + curWidth, botYbase - topOff2);
        ctx.lineTo(curLeft,            botYbase - topOff1);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        if (borderAlpha > 0.01) {
            ctx.strokeStyle = `rgba(255,255,255,${borderAlpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }
    });

    // ════════════════════════════════════════════
    // Grid lines on the surface
    // ════════════════════════════════════════════
    const gridAlpha = unfold < 1 ? 0.18 : lerp(0.18, 0.35, state.mapHighlight);

    // Horizontal grid lines
    if (gridAlpha > 0.01) {
        for (let g = 1; g < GRID_H; g++) {
            const gy = topYbase + (CYL_H * g / GRID_H);
            ctx.beginPath();

            if (unfold < 0.01) {
                // On cylinder surface: draw curved line
                const steps = 60;
                for (let s = 0; s <= steps; s++) {
                    const a = (s / steps) * 2 * Math.PI + baseRot;
                    const px = cx + Math.sin(a) * CYL_R;
                    const yOff = -Math.cos(a) * CYL_R * ELLIP;
                    const py = gy + yOff * (1 - g / GRID_H) * 0.3;
                    // Only draw front half
                    if (Math.cos(a) < 0) {
                        if (s === 0 || Math.cos((s-1) / steps * 2 * Math.PI + baseRot) >= 0) {
                            ctx.moveTo(px, py);
                        } else {
                            ctx.lineTo(px, py);
                        }
                    }
                }
            } else {
                // Transitioning / flat: straight line across all visible area
                const leftEdge  = cx - totalFlatW / 2;
                const rightEdge = cx + totalFlatW / 2;
                ctx.moveTo(lerp(cx - CYL_R, leftEdge, clamp01(unfold * 1.2)), gy);
                ctx.lineTo(lerp(cx + CYL_R, rightEdge, clamp01(unfold * 1.2)), gy);
            }

            ctx.strokeStyle = `rgba(255,255,255,${gridAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }

        // Vertical grid lines
        for (let v = 0; v < GRID_V; v++) {
            const vAngle = (v / GRID_V) * 2 * Math.PI + baseRot;
            const normVAngle = ((vAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            const isFrontV = Math.cos(vAngle) < 0;

            if (unfold < 0.01) {
                // On cylinder: only draw front-facing vertical lines
                if (!isFrontV) continue;
                const vx = cx + Math.sin(vAngle) * CYL_R;
                const vTopOff = -Math.cos(vAngle) * CYL_R * ELLIP;
                ctx.beginPath();
                ctx.moveTo(vx, topYbase + vTopOff);
                ctx.lineTo(vx, botYbase - vTopOff);
                ctx.strokeStyle = `rgba(255,255,255,${gridAlpha * 0.7})`;
                ctx.lineWidth = 0.6;
                ctx.stroke();
            } else {
                // Flat: evenly spaced
                const flatVX = cx - totalFlatW / 2 + (v / GRID_V) * totalFlatW;
                const cylVX  = cx + Math.sin(vAngle) * CYL_R;
                const vx = lerp(cylVX, flatVX, clamp01(unfold * 1.5));
                ctx.beginPath();
                ctx.moveTo(vx, topYbase);
                ctx.lineTo(vx, botYbase);
                ctx.strokeStyle = `rgba(255,255,255,${gridAlpha * 0.7})`;
                ctx.lineWidth = 0.6;
                ctx.stroke();
            }
        }
    }

    // ════════════════════════════════════════════
    // Top & bottom cap ellipses (fade as unfolding)
    // ════════════════════════════════════════════
    const capAlpha = Math.max(0, 1 - unfold * 3);
    if (capAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = capAlpha;

        // Top cap
        ctx.beginPath();
        ctx.ellipse(cx, topYbase, CYL_R, CYL_R * ELLIP, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(220, 5%, 85%, 0.45)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Bottom cap (front half)
        ctx.beginPath();
        ctx.ellipse(cx, botYbase, CYL_R, CYL_R * ELLIP, 0, 0, Math.PI);
        ctx.fillStyle = 'hsla(220, 5%, 25%, 0.6)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.stroke();

        ctx.restore();
    }

    // ════════════════════════════════════════════
    // Phase 1: Circumference highlight
    // ════════════════════════════════════════════
    const ch = state.circumHighlight;
    if (ch > 0.01 && unfold < 0.5) {
        ctx.save();
        const traceAlpha = Math.min(1, ch * 2) * (1 - unfold * 2);
        ctx.globalAlpha = traceAlpha;

        // Animated arc tracing at the bottom
        ctx.beginPath();
        const traceEnd = ch * Math.PI * 2;
        const arcSteps = Math.floor(traceEnd / (Math.PI * 2) * 80);
        for (let s = 0; s <= arcSteps; s++) {
            const a = (s / 80) * 2 * Math.PI + baseRot;
            const px = cx + Math.sin(a) * CYL_R;
            const py = botYbase + (-Math.cos(a) * CYL_R * ELLIP);
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = 'rgba(255,255,255,0.8)';
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Glow pulse
        if (state.circumGlow > 0.01) {
            ctx.beginPath();
            ctx.ellipse(cx, botYbase, CYL_R, CYL_R * ELLIP, 0, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,255,255,${0.2 + 0.3 * Math.sin(state.circumGlow * Math.PI * 4)})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = 'rgba(255,255,255,0.6)';
            ctx.shadowBlur = 20;
            ctx.stroke();
        }

        // Label: 2πr
        if (ch > 0.6) {
            const labelAlpha = clamp01((ch - 0.6) / 0.3);
            ctx.globalAlpha = labelAlpha * traceAlpha;
            ctx.font = 'bold 20px "Noto Sans TC", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 8;
            ctx.fillText('周長 = 2πr', cx, botYbase + CYL_R * ELLIP + 30);
        }

        ctx.restore();
    }

    // ════════════════════════════════════════════
    // Phase 2: Scissors cutting animation
    // ════════════════════════════════════════════
    const cp = state.cutProgress;
    const cutUnfoldFade = Math.max(0, 1 - unfold * 3);
    if (cp > 0.01 && cutUnfoldFade > 0.01) {
        ctx.save();
        const cutFade = Math.min(cp < 0.95 ? 1 : (1 - (cp - 0.95) / 0.05), cutUnfoldFade);
        ctx.globalAlpha = cutFade;

        // Cut line at the back of the cylinder (sin(PI)=0 → x = cx)
        // But we draw it on the visible edge — on the right side
        // Actually, for better visualisation: draw the cut on the LEFT visible edge
        const cutX = cx - CYL_R;
        const cutTop = topYbase - CYL_R * ELLIP * 0.5;
        const cutBot = botYbase + CYL_R * ELLIP * 0.5;
        const cutLen = cutBot - cutTop;
        const curCutY = cutTop + cutLen * cp;

        // Dashed cutting line (already cut portion)
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(255,255,255,0.7)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(cutX, cutTop);
        ctx.lineTo(cutX, curCutY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // Scissors emoji at current position
        if (cp < 0.98) {
            ctx.font = '30px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.95)';
            ctx.shadowBlur = 10;
            ctx.fillText('✂️', cutX - 20, curCutY);
            ctx.shadowBlur = 0;
        }

        // Small "sparks" at cut point
        if (cp > 0.02 && cp < 0.95) {
            const sparkCount = 3;
            for (let sp = 0; sp < sparkCount; sp++) {
                const sparkAngle = (Math.random() - 0.5) * Math.PI * 0.6;
                const sparkDist = 5 + Math.random() * 12;
                const spX = cutX + Math.cos(sparkAngle) * sparkDist;
                const spY = curCutY + Math.sin(sparkAngle) * sparkDist;
                ctx.beginPath();
                ctx.arc(spX, spY, 1 + Math.random() * 1.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.4})`;
                ctx.fill();
            }
        }

        ctx.restore();
    }

    // ════════════════════════════════════════════
    // Phase 3 visual: unfold direction arrows
    // ════════════════════════════════════════════
    if (unfold > 0.05 && unfold < 0.6) {
        const arrowAlpha = Math.min(1, (unfold - 0.05) * 6) * Math.max(0, 1 - (unfold - 0.3) / 0.3);
        ctx.save();
        ctx.globalAlpha = arrowAlpha * 0.65;

        const arrowY = topYbase - 35;
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle   = '#ffffff';
        ctx.lineWidth   = 2;

        // Left arrow
        ctx.beginPath();
        ctx.moveTo(cx - 10, arrowY);
        ctx.lineTo(cx - 65, arrowY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 65, arrowY);
        ctx.lineTo(cx - 55, arrowY - 6);
        ctx.lineTo(cx - 55, arrowY + 6);
        ctx.fill();

        // Right arrow
        ctx.beginPath();
        ctx.moveTo(cx + 10, arrowY);
        ctx.lineTo(cx + 65, arrowY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 65, arrowY);
        ctx.lineTo(cx + 55, arrowY - 6);
        ctx.lineTo(cx + 55, arrowY + 6);
        ctx.fill();

        // Text
        ctx.font = '14px "Noto Sans TC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('展開', cx, arrowY - 12);

        ctx.restore();
    }

    // ════════════════════════════════════════════
    // Phase 4: Edge mapping highlight
    // ════════════════════════════════════════════
    const mh = state.mapHighlight;
    if (mh > 0.01 && unfold > 0.9) {
        ctx.save();
        ctx.globalAlpha = mh;

        const rectLeft  = cx - totalFlatW / 2;
        const rectRight = cx + totalFlatW / 2;

        // Highlight bottom edge (= circumference unrolled)
        const traceLen = mh * totalFlatW;
        const glowGrad = ctx.createLinearGradient(rectLeft, 0, rectLeft + traceLen, 0);
        glowGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
        glowGrad.addColorStop(1, 'rgba(255,255,255,0.5)');

        ctx.beginPath();
        ctx.moveTo(rectLeft, botYbase);
        ctx.lineTo(rectLeft + traceLen, botYbase);
        ctx.strokeStyle = glowGrad;
        ctx.lineWidth = 4;
        ctx.shadowColor = 'rgba(255,255,255,0.8)';
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Also highlight top edge
        ctx.beginPath();
        ctx.moveTo(rectLeft, topYbase);
        ctx.lineTo(rectLeft + traceLen, topYbase);
        ctx.strokeStyle = `rgba(255,255,255,${0.5 * mh})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Side edges
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = `rgba(255,255,255,${0.4 * mh})`;
        ctx.beginPath();
        ctx.moveTo(rectLeft, topYbase);
        ctx.lineTo(rectLeft, botYbase);
        ctx.stroke();
        if (mh > 0.9) {
            ctx.beginPath();
            ctx.moveTo(rectRight, topYbase);
            ctx.lineTo(rectRight, botYbase);
            ctx.stroke();
        }

        // Label at bottom: ← 2πr →
        if (mh > 0.4) {
            const lblAlpha = clamp01((mh - 0.4) / 0.3);
            ctx.globalAlpha = lblAlpha;
            ctx.font = 'bold 18px "Noto Sans TC", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 6;
            ctx.fillText('← 這就是底面圓的周長 2πr →', cx, botYbase + 28);
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }

    // ════════════════════════════════════════════
    // Phase 5: Dimension labels & formula
    // ════════════════════════════════════════════
    const la = state.labelAlpha;
    if (la > 0.01) {
        ctx.save();
        ctx.globalAlpha = la;

        const rectLeft  = cx - totalFlatW / 2;
        const rectRight = cx + totalFlatW / 2;

        // Dashed rectangle
        ctx.setLineDash([10, 6]);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 2.5;
        ctx.strokeRect(rectLeft, topYbase, totalFlatW, CYL_H);
        ctx.setLineDash([]);

        // Width brace (top)
        const braceY = topYbase - 22;
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(rectLeft,  topYbase - 5);
        ctx.lineTo(rectLeft,  braceY);
        ctx.lineTo(rectRight, braceY);
        ctx.lineTo(rectRight, topYbase - 5);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font      = 'bold 20px "Noto Sans TC", sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 6;
        ctx.fillText('展開長度 = 2πr（底圓周長）', cx, braceY - 12);

        // Height brace (right)
        const braceX = rectRight + 22;
        ctx.beginPath();
        ctx.moveTo(rectRight + 5, topYbase);
        ctx.lineTo(braceX,        topYbase);
        ctx.lineTo(braceX,        botYbase);
        ctx.lineTo(rectRight + 5, botYbase);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillText('高度 = h', braceX + 10, cy + 6);

        // Formula
        ctx.textAlign = 'center';
        ctx.font = 'bold 26px "Noto Sans TC", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(255,255,255,0.3)';
        ctx.shadowBlur = 20;
        ctx.fillText('側面積 = 2πr × h', cx, botYbase + 55);
        ctx.shadowBlur = 0;

        ctx.restore();
    }
}

// ──────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────
resize();

// ──────────────────────────────────────────────
// GSAP ScrollTrigger Timeline (6 phases)
// ──────────────────────────────────────────────
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
                    (idx === 0 && p < 0.12)  ||
                    (idx === 1 && p >= 0.12 && p < 0.28) ||
                    (idx === 2 && p >= 0.28 && p < 0.42) ||
                    (idx === 3 && p >= 0.42 && p < 0.62) ||
                    (idx === 4 && p >= 0.62 && p < 0.80) ||
                    (idx === 5 && p >= 0.80);
                el.classList.toggle('active', active);
            });
        }
    }
});

// Phase 0 — Slow rotation to see 3D shape (≈ 12% of scroll)
tl.to(state, {
    rotation: Math.PI * 0.4,
    duration: 1.2,
    ease: 'power1.inOut',
    onUpdate: draw
});

// Phase 1 — Highlight bottom circumference (12%→28%)
tl.to(state, {
    circumHighlight: 1,
    circumGlow: 1,
    rotation: Math.PI * 0.55,
    duration: 1.6,
    ease: 'none',
    onUpdate: draw
});

// Phase 2 — Scissors cut down the side (28%→42%)
// First rotate so the cut edge is visible on the left
tl.to(state, {
    cutProgress: 1,
    rotation: Math.PI * 0.5,
    circumHighlight: 1,
    circumGlow: 0,
    duration: 1.4,
    ease: 'power1.inOut',
    onUpdate: draw
});

// Phase 3 — Unfold surface like opening a book (42%→62%)
tl.to(state, {
    unfold: 1,
    circumHighlight: 0,
    cutProgress: 1,
    duration: 2.0,
    ease: 'power2.inOut',
    onUpdate: draw
});

// Phase 4 — Map highlight: trace the bottom edge (62%→80%)
tl.to(state, {
    mapHighlight: 1,
    duration: 1.8,
    ease: 'power1.out',
    onUpdate: draw
});

// Phase 5 — Show dimension labels and formula (80%→100%)
tl.to(state, {
    labelAlpha: 1,
    mapHighlight: 1,
    duration: 1.2,
    ease: 'power1.out',
    onUpdate: draw
});
