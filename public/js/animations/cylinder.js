// ═══════════════════════════════════════════════════
//  Cylinder Lateral Surface = Rectangle  Animation
//  7 Phases driven by GSAP ScrollTrigger
// ═══════════════════════════════════════════════════

gsap.registerPlugin(ScrollTrigger);

// ───────────────────────────────────────────────────
// Canvas Setup
// ───────────────────────────────────────────────────
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

// ───────────────────────────────────────────────────
// Geometry constants
// ───────────────────────────────────────────────────
const NUM       = 96;           // number of vertical strips
const ELLIP     = 0.32;         // perspective squish for top/bottom ellipses
const GRID_V    = 12;           // vertical grid lines
const GRID_H    = 5;            // horizontal grid lines

// These are computed dynamically in draw() based on canvas size
let CYL_R, CYL_H, totalFlatW, flatStripW;

// ───────────────────────────────────────────────────
// Animation State  (all driven by GSAP)
// ───────────────────────────────────────────────────
const S = {
    //── Phase 0 ──
    rotation:       0,        // base rotation for 3-D feel

    //── Phase 1 ──
    circumTrace:    0,        // 0→1 traces bottom circle
    circumGlow:     0,        // pulsing glow progress

    //── Phase 2 ──
    cutProgress:    0,        // 0→1 scissors line descends

    //── Phase 3 ──
    unroll:         0,        // 0→1 surface opens into rectangle

    //── Phase 4 ──
    rectReveal:     0,        // 0→1 rectangle border + grid fades in

    //── Phase 5 ──
    labelWidth:     0,        // 0→1 width label (2πr)
    labelHeight:    0,        // 0→1 height label (h)

    //── Phase 6 ──
    formulaAlpha:   0,        // 0→1 formula appears
    formulaScale:   0,        // 0→1 formula scale-in
    bgGlow:         0,        // bg glow under formula

    //── Phase 7: Re-roll ──
    reroll:         0,        // 0→1  rectangle rolls back into cylinder
    rerollGlow:     0         // 0→1  final cylinder glow celebration
};

// ───────────────────────────────────────────────────
// Utils
// ───────────────────────────────────────────────────
const lerp  = (a, b, t)  => a + (b - a) * t;
const clamp = (t, lo=0, hi=1) => Math.max(lo, Math.min(hi, t));
const ease  = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;  // cubic in-out
const easeOut = t => 1 - Math.pow(1-t, 3);

// ───────────────────────────────────────────────────
// Colour helpers
// ───────────────────────────────────────────────────
function stripColor(brightness, saturation=0, hue=220, alpha=1) {
    return `hsla(${hue},${saturation}%,${brightness}%,${alpha})`;
}

// ───────────────────────────────────────────────────
// Main Draw
// ───────────────────────────────────────────────────
function draw() {
    if (!cW) return;
    ctx.clearRect(0, 0, cW, cH);

    // Dynamic sizing: fill ~75% of canvas width and ~40% of height
    CYL_R      = Math.min(cW * 0.085, cH * 0.15, 95);
    CYL_H      = Math.min(cH * 0.42, 240);
    totalFlatW = 2 * Math.PI * CYL_R;
    flatStripW = totalFlatW / NUM;

    const cx      = cW / 2;
    // Push cylinder up a bit to leave room for formula box below
    const cy      = cH * 0.44;
    const topY    = cy - CYL_H / 2;
    const botY    = cy + CYL_H / 2;
    const unroll  = S.unroll;
    const baseRot = S.rotation;

    // The flat rectangle occupies the full circumference width, centred
    const rectLeft  = cx - totalFlatW / 2;
    const rectRight = cx + totalFlatW / 2;
    const rectTop   = topY;
    const rectBot   = botY;

    // ──────────────────────────────────────────────
    // 1) Build & Sort Strips
    // ──────────────────────────────────────────────
    const strips = [];

    for (let i = 0; i < NUM; i++) {
        const a1   = (i / NUM) * 2 * Math.PI + baseRot;
        const a2   = ((i+1) / NUM) * 2 * Math.PI + baseRot;
        const midA = (a1 + a2) / 2;

        // 3-D positions for this strip
        const x1_3d = Math.sin(a1) * CYL_R;
        const x2_3d = Math.sin(a2) * CYL_R;
        const depth = -Math.cos(midA);            // painter's z
        const isFront = Math.cos(midA) < 0;

        // Top ellipse offsets (shift top/bottom of strip for perspective)
        const topOff1 = -Math.cos(a1) * CYL_R * ELLIP;
        const topOff2 = -Math.cos(a2) * CYL_R * ELLIP;

        // Flat position (spread strips out to full circumference width)
        const flatX = i * flatStripW - totalFlatW / 2;

        // Lambertian brightness
        const brightness = isFront
            ? 50 + 22 * Math.abs(Math.sin(midA))
            : 18 + 8  * Math.abs(Math.sin(midA));

        // Stagger: strips near the cut edge unroll first
        // Cut is at left edge (sin(0)→leftmost visible) – mirror both sides
        let normA    = ((midA % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
        let distCut  = Math.min(normA, 2*Math.PI - normA) / Math.PI; // 0=at cut, 1=far

        strips.push({ i, a1, a2, midA, depth, x1_3d, x2_3d,
                       topOff1, topOff2, flatX, brightness, distCut, isFront });
    }

    // Painter's algorithm: draw distant strips first
    strips.sort((a, b) => b.depth - a.depth);

    // ──────────────────────────────────────────────
    // 2) Draw Cylinder / Unrolling Strips
    // ──────────────────────────────────────────────
    strips.forEach(s => {
        // Each strip has a staggered unroll progress
        // strips close to cut (distCut≈0) start unrolling earlier
        const delay   = s.distCut * 0.5;
        const dur     = 0.45;
        const stLocal = ease(clamp((unroll - delay) / dur));

        // 3D width (can be near zero for side strips)
        const left3d  = cx + Math.min(s.x1_3d, s.x2_3d);
        const wide3d  = Math.abs(s.x2_3d - s.x1_3d);

        // Flat: uniform strip width
        const leftFlat = cx + s.flatX;
        const widFlat  = flatStripW;

        // Interpolate position & width
        const curLeft  = lerp(left3d,            leftFlat,          stLocal);
        const curWide  = lerp(Math.max(wide3d, 0.3), widFlat,       stLocal);

        // Top & bottom vertex offsets (ellipse → 0 as it unrolls)
        const to1 = lerp(s.topOff1, 0, stLocal);
        const to2 = lerp(s.topOff2, 0, stLocal);

        // Colour: shaded 3D → uniform flat
        const flatBright = 55;
        const br = lerp(s.brightness, flatBright, stLocal);

        // Subtle alternating tint so grid cells are visible in flat form
        const groupIdx   = Math.floor(s.i / (NUM / GRID_V));
        const hue        = (groupIdx % 2 === 0) ? 215 : 200;
        const sat        = lerp(0, 10, stLocal);
        ctx.fillStyle    = `hsl(${hue},${sat}%,${br}%)`;

        ctx.beginPath();
        ctx.moveTo(curLeft,           topY + to1);
        ctx.lineTo(curLeft + curWide, topY + to2);
        ctx.lineTo(curLeft + curWide, botY - to2);
        ctx.lineTo(curLeft,           botY - to1);
        ctx.closePath();
        ctx.fill();

        // Faint strip borders in flat mode
        const borderA = lerp(0, 0.1, stLocal);
        if (borderA > 0.01) {
            ctx.strokeStyle = `rgba(255,255,255,${borderA})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }
    });

    // ──────────────────────────────────────────────
    // 3) Grid lines on surface
    // ──────────────────────────────────────────────

    // Horizontal grid lines (straight lines across whether 3D or flat)
    const gridAlpha = lerp(0.12, 0.3, unroll);
    if (gridAlpha > 0.01) {
        for (let g = 1; g < GRID_H; g++) {
            const gy = topY + CYL_H * g / GRID_H;
            ctx.beginPath();
            if (unroll < 0.01) {
                // Draw curved arc along cylinder surface
                let prevX = null, prevY = null;
                for (let si = 0; si <= 80; si++) {
                    const a = (si / 80) * 2 * Math.PI + baseRot;
                    if (Math.cos(a) > 0) { prevX = null; continue; } // back half
                    const px = cx + Math.sin(a) * CYL_R;
                    const py = gy + (-Math.cos(a) * CYL_R * ELLIP) * (0.5 - Math.abs(g/GRID_H - 0.5));
                    if (prevX === null) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                    prevX = px; prevY = py;
                }
            } else {
                // Flat: simple horizontal line across rectangle
                const leftEdge  = lerp(cx - CYL_R, rectLeft,  clamp(unroll * 1.3));
                const rightEdge = lerp(cx + CYL_R, rectRight, clamp(unroll * 1.3));
                ctx.moveTo(leftEdge,  gy);
                ctx.lineTo(rightEdge, gy);
            }
            ctx.strokeStyle = `rgba(255,255,255,${gridAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }

        // Vertical grid lines
        for (let v = 0; v < GRID_V; v++) {
            if (unroll < 0.01) {
                const vAngle = (v / GRID_V) * 2 * Math.PI + baseRot;
                if (Math.cos(vAngle) > 0) continue;  // back half skip
                const vx = cx + Math.sin(vAngle) * CYL_R;
                const vTop = -Math.cos(vAngle) * CYL_R * ELLIP;
                ctx.beginPath();
                ctx.moveTo(vx, topY + vTop);
                ctx.lineTo(vx, botY - vTop);
                ctx.strokeStyle = `rgba(255,255,255,${gridAlpha * 0.7})`;
                ctx.lineWidth = 0.6;
                ctx.stroke();
            } else {
                const flatVX = rectLeft + (v / GRID_V) * totalFlatW;
                const cylVX  = cx + Math.sin((v / GRID_V) * 2 * Math.PI + baseRot) * CYL_R;
                const vx = lerp(cylVX, flatVX, clamp(unroll * 1.5));
                ctx.beginPath();
                ctx.moveTo(vx, topY);
                ctx.lineTo(vx, botY);
                ctx.strokeStyle = `rgba(255,255,255,${gridAlpha * 0.7})`;
                ctx.lineWidth = 0.6;
                ctx.stroke();
            }
        }
    }

    // ──────────────────────────────────────────────
    // 4) Cylinder caps (fade out as unrolling)
    // ──────────────────────────────────────────────
    const capAlpha = clamp(1 - unroll * 2.5);
    if (capAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = capAlpha;

        // Top cap
        ctx.beginPath();
        ctx.ellipse(cx, topY, CYL_R, CYL_R * ELLIP, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(220, 8%, 78%, 0.45)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Bottom cap front half
        ctx.beginPath();
        ctx.ellipse(cx, botY, CYL_R, CYL_R * ELLIP, 0, 0, Math.PI);
        ctx.fillStyle = 'hsla(220, 8%, 22%, 0.7)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.stroke();

        ctx.restore();
    }

    // ──────────────────────────────────────────────
    // Phase 1: Circumference trace at bottom
    // ──────────────────────────────────────────────
    const ct = S.circumTrace;
    if (ct > 0.005 && unroll < 0.4) {
        ctx.save();
        const fading = clamp(1 - unroll * 2.5);
        ctx.globalAlpha = Math.min(1, ct * 1.8) * fading;

        // Draw arc fraction
        ctx.beginPath();
        const arcEnd = ct * 2 * Math.PI;
        const arcSteps = Math.ceil(ct * 80);
        for (let si = 0; si <= arcSteps; si++) {
            const a = (si / 80) * 2 * Math.PI + baseRot;
            const px = cx + Math.sin(a) * CYL_R;
            const py = botY + (-Math.cos(a) * CYL_R * ELLIP);
            if (si === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 18;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Pulse glow rim
        if (S.circumGlow > 0.01) {
            ctx.globalAlpha = (0.15 + 0.2 * Math.sin(S.circumGlow * Math.PI * 4)) * fading;
            ctx.beginPath();
            ctx.ellipse(cx, botY, CYL_R, CYL_R * ELLIP, 0, 0, Math.PI * 2);
            ctx.strokeStyle = '#93c5fd';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#93c5fd';
            ctx.shadowBlur = 22;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // 2πr label
        if (ct > 0.65) {
            const lblA = clamp((ct - 0.65) / 0.3) * fading;
            ctx.globalAlpha = lblA;
            ctx.font = 'bold 18px "Noto Sans TC", sans-serif';
            ctx.fillStyle = '#93c5fd';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 6;
            ctx.fillText('底面周長 = 2πr', cx, botY + CYL_R * ELLIP + 28);
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }

    // ──────────────────────────────────────────────
    // Phase 2: Scissors cut line
    // ──────────────────────────────────────────────
    const cp = S.cutProgress;
    const cutFadeOut = clamp(1 - unroll * 4);
    if (cp > 0.005 && cutFadeOut > 0.005) {
        ctx.save();
        const cutAlpha = Math.min(cp < 0.95 ? 1 : (1 - (cp - 0.95)/0.05), cutFadeOut);
        ctx.globalAlpha = cutAlpha;

        // Cut line on the left edge of the front face
        const cutX = cx - CYL_R;
        const cutTopY = topY - CYL_R * ELLIP;
        const cutBotY = botY + CYL_R * ELLIP;
        const curCutY = lerp(cutTopY, cutBotY, cp);

        // Glow cut line
        ctx.setLineDash([8, 5]);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth   = 2.5;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur  = 12;
        ctx.beginPath();
        ctx.moveTo(cutX, cutTopY);
        ctx.lineTo(cutX, curCutY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // Scissors emoji
        if (cp < 0.97) {
            ctx.font = '28px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.95)';
            ctx.shadowBlur = 10;
            ctx.fillText('✂️', cutX - 18, curCutY);
            ctx.shadowBlur = 0;
        }

        // Sparks
        if (cp > 0.02 && cp < 0.96) {
            for (let sp = 0; sp < 4; sp++) {
                const ang   = (Math.random() - 0.5) * 0.8;
                const dist  = 4 + Math.random() * 10;
                ctx.beginPath();
                ctx.arc(cutX + Math.cos(ang)*dist, curCutY + Math.sin(ang)*dist,
                        0.8 + Math.random()*1.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(251,191,36,${0.4 + Math.random()*0.4})`;
                ctx.fill();
            }
        }

        ctx.restore();
    }

    // ──────────────────────────────────────────────
    // Phase 3: Unrolling arrows overlay
    // ──────────────────────────────────────────────
    if (unroll > 0.04 && unroll < 0.65) {
        const arrowA = clamp((unroll - 0.04) / 0.12) * clamp((0.65 - unroll) / 0.25) * 0.75;
        ctx.save();
        ctx.globalAlpha = arrowA;
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle   = '#ffffff';
        ctx.lineWidth   = 2;
        const arY = topY - 40;

        // Left arrow
        ctx.beginPath();
        ctx.moveTo(cx - 15, arY);
        ctx.lineTo(cx - 70, arY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 70, arY);
        ctx.lineTo(cx - 57, arY - 7);
        ctx.lineTo(cx - 57, arY + 7);
        ctx.fill();

        // Right arrow
        ctx.beginPath();
        ctx.moveTo(cx + 15, arY);
        ctx.lineTo(cx + 70, arY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 70, arY);
        ctx.lineTo(cx + 57, arY - 7);
        ctx.lineTo(cx + 57, arY + 7);
        ctx.fill();

        ctx.font = '13px "Noto Sans TC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('展開', cx, arY - 14);

        ctx.restore();
    }

    // ──────────────────────────────────────────────
    // Phase 4: Rectangle reveal – glowing border
    // ──────────────────────────────────────────────
    const rr = S.rectReveal;
    if (rr > 0.005) {
        ctx.save();
        // Fade out rect border when labels arrive (to avoid overlapping with ruler)
        const rrFade = rr * clamp(1 - (S.labelWidth - 0.3) / 0.4);
        ctx.globalAlpha = rrFade;

        // Outer glow rect
        ctx.shadowColor = 'rgba(147,197,253,0.4)';
        ctx.shadowBlur  = 30;
        ctx.strokeStyle = 'rgba(147,197,253,0.7)';
        ctx.lineWidth   = 2.5;
        ctx.strokeRect(rectLeft, rectTop, totalFlatW, CYL_H);
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    // ──────────────────────────────────────────────
    // Phase 5: Dimension labels
    // ──────────────────────────────────────────────
    const lw = S.labelWidth;
    const lh = S.labelHeight;

    if (lw > 0.005) {
        ctx.save();

        // Width label with animated "ruler" on top
        ctx.globalAlpha = easeOut(lw);
        const traceW = lw * totalFlatW;

        // Animated ruler line tracing top edge
        const grad = ctx.createLinearGradient(rectLeft, 0, rectLeft + traceW, 0);
        grad.addColorStop(0, 'rgba(96,165,250,0.95)');
        grad.addColorStop(1, 'rgba(96,165,250,0.4)');
        ctx.beginPath();
        ctx.moveTo(rectLeft, rectTop);
        ctx.lineTo(rectLeft + traceW, rectTop);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 5;
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur  = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Tick marks on the ruler
        const tickCount = 8;
        for (let ti = 0; ti <= tickCount; ti++) {
            const tx = rectLeft + (ti / tickCount) * traceW;
            if (tx > rectRight) break;
            ctx.beginPath();
            ctx.moveTo(tx, rectTop - 7);
            ctx.lineTo(tx, rectTop + 7);
            ctx.strokeStyle = 'rgba(96,165,250,0.7)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Label
        if (lw > 0.6) {
            const tA = easeOut(clamp((lw - 0.6) / 0.35));
            ctx.globalAlpha = tA;
            ctx.font = 'bold 17px "Noto Sans TC", sans-serif';
            ctx.fillStyle = '#93c5fd';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur  = 6;
            ctx.fillText('長 (= 2πr)', cx, rectTop - 22);
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }

    if (lh > 0.005) {
        ctx.save();
        ctx.globalAlpha = easeOut(lh);

        // Height bar on right side
        const traceH   = lh * CYL_H;
        const barX     = rectRight + 28;

        ctx.beginPath();
        ctx.moveTo(barX, rectTop);
        ctx.lineTo(barX, rectTop + traceH);
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth   = 5;
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur  = 14;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Top & bottom ticks
        [[rectTop], [rectTop + traceH]].forEach(([y]) => {
            ctx.beginPath();
            ctx.moveTo(barX - 8, y);
            ctx.lineTo(barX + 8, y);
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth   = 2;
            ctx.stroke();
        });

        // Height label
        if (lh > 0.5) {
            const tA = easeOut(clamp((lh - 0.5) / 0.4));
            ctx.globalAlpha = tA;
            ctx.font = 'bold 17px "Noto Sans TC", sans-serif';
            ctx.fillStyle = '#6ee7b7';
            ctx.textAlign = 'left';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur  = 6;
            ctx.fillText('寬 (= h)', barX + 14, cy + 6);
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }

    // ──────────────────────────────────────────────
    // Phase 6: Formula
    // ──────────────────────────────────────────────
    const fa = S.formulaAlpha;
    const fs = S.formulaScale;
    if (fa > 0.005) {
        ctx.save();
        ctx.globalAlpha = fa;

        // Background glow
        if (S.bgGlow > 0.01) {
            const bgG = ctx.createRadialGradient(cx, rectBot + 68, 0, cx, rectBot + 68, 180);
            bgG.addColorStop(0, `rgba(96,165,250,${0.12 * S.bgGlow})`);
            bgG.addColorStop(1, 'rgba(96,165,250,0)');
            ctx.fillStyle = bgG;
            ctx.fillRect(cx - 200, rectBot + 20, 400, 130);
        }

        // Formula box
        const scale  = lerp(0.5, 1, easeOut(clamp(fs)));
        const boxW   = 340;
        const boxH   = 56;
        const boxX   = cx - boxW / 2;
        const boxY   = rectBot + 28;

        ctx.save();
        ctx.translate(cx, boxY + boxH / 2);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -(boxY + boxH / 2));

        // Box background
        ctx.fillStyle = 'rgba(17,24,39,0.9)';
        ctx.beginPath();
        roundRect(ctx, boxX, boxY, boxW, boxH, 14);
        ctx.fill();

        // Box border
        ctx.strokeStyle = 'rgba(147,197,253,0.6)';
        ctx.lineWidth   = 2;
        ctx.shadowColor = 'rgba(96,165,250,0.6)';
        ctx.shadowBlur  = 18;
        ctx.beginPath();
        roundRect(ctx, boxX, boxY, boxW, boxH, 14);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Formula text
        ctx.fillStyle = '#ffffff';
        ctx.font      = 'bold 24px "Noto Sans TC", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(96,165,250,0.7)';
        ctx.shadowBlur  = 10;
        ctx.fillText('側面積 = 2πr × h', cx, boxY + boxH / 2);
        ctx.shadowBlur  = 0;

        ctx.restore();

        // Subtitle hint
        if (fa > 0.55) {
            ctx.globalAlpha = clamp((fa - 0.55) / 0.35) * fa;
            ctx.font = '13px "Noto Sans TC", sans-serif';
            ctx.fillStyle = '#6b7280';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('（底圓周長 × 高 = 長方形面積）', cx, boxY + boxH + 10);
        }

        ctx.restore();
    }

    // ──────────────────────────────────────────────
    // Phase 7: Re-roll – rectangle curls back into cylinder
    // ──────────────────────────────────────────────
    // reroll = 0 → flat, reroll = 1 → fully a cylinder again
    // We run unroll backwards: effective_unroll = 1 - reroll
    const rr7 = S.reroll;
    if (rr7 > 0.005) {
        // Fade out all the label / formula overlays
        const labelFade = clamp(1 - rr7 * 3);

        // "Squeezing inward" arrows
        if (rr7 > 0.02 && rr7 < 0.7) {
            const arA = clamp(rr7 / 0.12) * clamp((0.7 - rr7) / 0.2) * 0.7;
            ctx.save();
            ctx.globalAlpha = arA;
            ctx.strokeStyle = '#fde68a';
            ctx.fillStyle   = '#fde68a';
            ctx.lineWidth   = 2;
            const arY2 = topY - 38;

            // Right → inward arrow
            ctx.beginPath();
            ctx.moveTo(rectRight + 10, arY2);
            ctx.lineTo(rectRight - 45, arY2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(rectRight - 45, arY2);
            ctx.lineTo(rectRight - 33, arY2 - 7);
            ctx.lineTo(rectRight - 33, arY2 + 7);
            ctx.fill();

            // Left → inward arrow
            ctx.beginPath();
            ctx.moveTo(rectLeft - 10, arY2);
            ctx.lineTo(rectLeft + 45, arY2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(rectLeft + 45, arY2);
            ctx.lineTo(rectLeft + 33, arY2 - 7);
            ctx.lineTo(rectLeft + 33, arY2 + 7);
            ctx.fill();

            ctx.font = '13px "Noto Sans TC", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('捲起來！', cx, arY2 - 14);
            ctx.restore();
        }

        // Celebration glow on re-formed cylinder
        if (S.rerollGlow > 0.01) {
            ctx.save();
            ctx.globalAlpha = S.rerollGlow * 0.6;
            const glowR = CYL_R + 20 + 10 * Math.sin(S.rerollGlow * Math.PI * 3);
            const glowGrad = ctx.createRadialGradient(cx, cy, CYL_R * 0.3, cx, cy, glowR * 1.8);
            glowGrad.addColorStop(0, 'rgba(251,191,36,0.25)');
            glowGrad.addColorStop(1, 'rgba(251,191,36,0)');
            ctx.fillStyle = glowGrad;
            ctx.fillRect(cx - glowR * 2, topY - glowR, glowR * 4, CYL_H + glowR * 2);
            ctx.restore();
        }
    }
}

// ───────────────────────────────────────────────────
// roundRect helper (polyfill for ctx.roundRect)
// ───────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ───────────────────────────────────────────────────
// Phase index for dot indicator
// ───────────────────────────────────────────────────
const PHASE_BREAKS = [0, 0.09, 0.19, 0.31, 0.44, 0.57, 0.70, 0.83];
const dots = document.querySelectorAll('.phase-dot');

function updateDots(progress) {
    let current = 0;
    for (let i = PHASE_BREAKS.length - 1; i >= 0; i--) {
        if (progress >= PHASE_BREAKS[i]) { current = i; break; }
    }
    dots.forEach((d, i) => {
        d.classList.toggle('active', i === current);
    });
}

// ───────────────────────────────────────────────────
// Boot
// ───────────────────────────────────────────────────
resize();

// ───────────────────────────────────────────────────
// GSAP ScrollTrigger Timeline  (7 phases across 700vh)
// ───────────────────────────────────────────────────
const tl = gsap.timeline({
    scrollTrigger: {
        trigger: '.scroll-container',
        start:   'top top',
        end:     'bottom bottom',
        scrub:   1.5,
        onUpdate(self) {
            const p = self.progress;
            updateDots(p);

            // Step text visibility — 8 steps now
            const steps = [0, 0.09, 0.19, 0.31, 0.44, 0.57, 0.70, 0.83];
            document.querySelectorAll('.step').forEach((el, idx) => {
                const lo = steps[idx];
                const hi = steps[idx + 1] ?? 1.01;
                el.classList.toggle('active', p >= lo && p < hi);
            });

            // When rerolling, drive unroll backwards
            if (S.reroll > 0.005) {
                // unroll is now controlled by the re-roll phase
                // We directly set it here so draw() uses it correctly
                // (GSAP already tweens S.unroll from 1→0 via the reroll section)
            }
        }
    }
});

// ── Phase 0: Slow rotation (0%→9%)
tl.to(S, {
    rotation: Math.PI * 0.45,
    duration: 1.0,
    ease: 'power1.inOut',
    onUpdate: draw
});

// ── Phase 1: Circumference highlight (9%→19%)
tl.to(S, {
    circumTrace: 1,
    circumGlow:  1,
    rotation:    Math.PI * 0.6,
    duration: 1.1,
    ease: 'power1.inOut',
    onUpdate: draw
});

// ── Phase 2: Scissors cut (19%→31%)
tl.to(S, {
    cutProgress:  1,
    circumTrace:  0.9,
    circumGlow:   0,
    rotation:     Math.PI * 0.5,
    duration: 1.3,
    ease: 'power1.inOut',
    onUpdate: draw
});

// ── Phase 3: Unroll (31%→44%)
tl.to(S, {
    unroll:      1,
    cutProgress: 1,
    circumTrace: 0,
    duration: 1.4,
    ease: 'power2.inOut',
    onUpdate: draw
});

// ── Phase 4: Rectangle border pulses into view (44%→57%)
tl.to(S, {
    rectReveal: 1,
    duration:  1.4,
    ease: 'power1.out',
    onUpdate: draw
});

// ── Phase 5: Dimension labels animate in (57%→70%)
tl.to(S, {
    labelWidth:  1,
    duration:  0.9,
    ease: 'power1.out',
    onUpdate: draw
});
tl.to(S, {
    labelHeight: 1,
    duration:  0.7,
    ease: 'power1.out',
    onUpdate: draw
}, '<0.3');

// ── Phase 6: Formula appears (70%→83%)
tl.to(S, {
    formulaAlpha: 1,
    formulaScale: 1,
    bgGlow:       1,
    duration:  1.4,
    ease: 'power2.out',
    onUpdate: draw
});

// ── Phase 7: Re-roll rectangle → cylinder (83%→100%)
// Step 1: fade out formula / labels, start rolling arrows
tl.to(S, {
    formulaAlpha: 0,
    labelWidth:   0,
    labelHeight:  0,
    rectReveal:   0,
    bgGlow:       0,
    reroll:       0.05,   // just enough to trigger arrow overlay
    duration: 0.8,
    ease: 'power1.in',
    onUpdate: draw
});
// Step 2: roll back (unroll 1→0) + reroll marker 0→1
tl.to(S, {
    unroll:     0,
    reroll:     1,
    rotation:   Math.PI * 0.9,
    duration:   1.8,
    ease: 'power2.inOut',
    onUpdate: draw
});
// Step 3: caps reappear + celebration glow
tl.to(S, {
    rerollGlow: 1,
    duration: 0.9,
    ease: 'power1.out',
    onUpdate: draw
});
