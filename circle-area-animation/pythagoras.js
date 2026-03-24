// ═══════════════════════════════════════════════════
//  Pythagorean Theorem Visualization
//  10 Phases driven by GSAP ScrollTrigger
//  Method 1: Area Puzzle (Phases 0–6)
//  Method 2: Water Flow  (Phases 7–9)
// ═══════════════════════════════════════════════════

gsap.registerPlugin(ScrollTrigger);

// ───────────────────────────────────────────────────
// Canvas Setup
// ───────────────────────────────────────────────────
const canvas = document.getElementById('pyth-canvas');
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
// Utils
// ───────────────────────────────────────────────────
const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (t, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, t));
const ease  = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn  = t => t * t * t;

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
// Triangle definition: 3-4-5 right triangle
// ───────────────────────────────────────────────────
const A_SIDE = 3;
const B_SIDE = 4;
const C_SIDE = 5;

// ───────────────────────────────────────────────────
// Animation State
// ───────────────────────────────────────────────────
const S = {
    // Phase 0: Triangle
    triDraw:       0,    // 0→1 draw the triangle
    triGlow:       0,    // glow pulse

    // Phase 1: Squares grow
    sqGrowA:       0,    // 0→1 a² square grows
    sqGrowB:       0,    // 0→1 b² square grows
    sqGrowC:       0,    // 0→1 c² square grows

    // Phase 2: Observe
    pulseAB:       0,    // 0→1 pulse small squares
    pulseC:        0,    // 0→1 pulse big square

    // Phase 3: Mark a² piece
    markA:         0,    // 0→1 highlight a² as piece 1

    // Phase 4: Cut b²
    cutB:          0,    // 0→1 cut lines on b²

    // Phase 5: Puzzle assemble
    puzzleMove:    0,    // 0→1 pieces fly into c²

    // Phase 6: Celebrate puzzle
    proofGlow:     0,    // 0→1 celebration
    proofFormula:  0,    // 0→1 formula appears

    // Phase 7: Water fill small squares
    waterFillA:    0,    // 0→1 water fills a²
    waterFillB:    0,    // 0→1 water fills b²
    waterSetup:    0,    // 0→1 transition to water scene

    // Phase 8: Pour water
    waterPour:     0,    // 0→1 water drains from a²,b² into c²

    // Phase 9: Final celebration
    finalGlow:     0,
    finalFormula:  0,
    confetti:      0,
};

// ───────────────────────────────────────────────────
// Confetti particles
// ───────────────────────────────────────────────────
const confettiParticles = [];
function initConfetti() {
    confettiParticles.length = 0;
    for (let i = 0; i < 60; i++) {
        confettiParticles.push({
            x: Math.random(),
            y: Math.random() * -1,
            vx: (Math.random() - 0.5) * 0.003,
            vy: 0.002 + Math.random() * 0.004,
            size: 3 + Math.random() * 5,
            color: ['#ef4444','#3b82f6','#a78bfa','#fbbf24','#34d399','#f472b6'][Math.floor(Math.random()*6)],
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.1,
        });
    }
}
initConfetti();

// ───────────────────────────────────────────────────
// Layout helpers — compute positions based on canvas
// ───────────────────────────────────────────────────
function getLayout() {
    // Unit scale: map the 3-4-5 triangle to pixels
    const unit = Math.min(cW / 14, cH / 14, 55);

    // Triangle vertices (right angle at bottom-left)
    // Position the triangle in the center-ish area
    const cx = cW * 0.5;
    const cy = cH * 0.45;

    // Right-angle vertex
    const Rx = cx - B_SIDE * unit * 0.3;
    const Ry = cy + A_SIDE * unit * 0.3;

    // Bottom-right vertex (along b side)
    const Bx = Rx + B_SIDE * unit;
    const By = Ry;

    // Top vertex (along a side)
    const Ax = Rx;
    const Ay = Ry - A_SIDE * unit;

    return { unit, cx, cy, Rx, Ry, Bx, By, Ax, Ay };
}

// Compute square corners given two vertices of its base edge
// Square extends outward from the triangle
function getSquare(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    // Normal pointing outward (rotate 90° CCW for outward)
    // We'll determine outward direction based on which side
    return [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
        { x: x2 - dy, y: y2 + dx },
        { x: x1 - dy, y: y1 + dx },
    ];
}

// ───────────────────────────────────────────────────
// Main Draw
// ───────────────────────────────────────────────────
function draw() {
    if (!cW) return;
    ctx.clearRect(0, 0, cW, cH);

    const L = getLayout();
    const { unit, Rx, Ry, Bx, By, Ax, Ay } = L;

    // ─── Determine which "scene" we're in ───
    const isWaterScene = S.waterSetup > 0.01;

    if (!isWaterScene) {
        drawPuzzleScene(L);
    } else {
        drawWaterScene(L);
    }
}

// ═══════════════════════════════════════════════════
//  PUZZLE SCENE (Phases 0–6)
// ═══════════════════════════════════════════════════
function drawPuzzleScene(L) {
    const { unit, cx, cy, Rx, Ry, Bx, By, Ax, Ay } = L;

    // ─── Squares ───
    // Side a: from A to R (vertical, left side) → square goes LEFT
    const sqA = getSquareOutward(Ax, Ay, Rx, Ry, 'left');
    // Side b: from R to B (horizontal, bottom side) → square goes DOWN
    const sqB = getSquareOutward(Rx, Ry, Bx, By, 'down');
    // Side c: from A to B (hypotenuse) → square goes RIGHT/UP
    const sqC = getSquareOutward(Bx, By, Ax, Ay, 'right');

    const triAlpha = easeOut(clamp(S.triDraw));
    const sqAProgress = easeOut(clamp(S.sqGrowA));
    const sqBProgress = easeOut(clamp(S.sqGrowB));
    const sqCProgress = easeOut(clamp(S.sqGrowC));

    // Draw squares behind triangle
    if (sqAProgress > 0.01) drawSquareAnimated(sqA, sqAProgress, 'rgba(239,68,68,', '#ef4444', S.pulseAB);
    if (sqBProgress > 0.01) drawSquareAnimated(sqB, sqBProgress, 'rgba(59,130,246,', '#3b82f6', S.pulseAB);
    if (sqCProgress > 0.01) drawSquareAnimated(sqC, sqCProgress, 'rgba(139,92,246,', '#8b5cf6', S.pulseC);

    // Area labels on squares — hide when piece labels (markA) or puzzle assembly is active
    const areaLabelFade = clamp(1 - S.markA) * clamp(1 - S.puzzleMove);
    if (sqAProgress > 0.5 && areaLabelFade > 0.01) drawAreaLabel(sqA, 'a²= 9', sqAProgress * areaLabelFade, '#fca5a5');
    if (sqBProgress > 0.5 && areaLabelFade > 0.01) drawAreaLabel(sqB, 'b²=16', sqBProgress * areaLabelFade, '#93c5fd');
    if (sqCProgress > 0.5 && areaLabelFade > 0.01) drawAreaLabel(sqC, 'c²=25', sqCProgress * areaLabelFade, '#c4b5fd');

    // ─── Phase 3: Mark a² as piece 1 ───
    if (S.markA > 0.01 && S.puzzleMove < 0.01) {
        ctx.save();
        ctx.globalAlpha = easeOut(S.markA) * clamp(1 - S.puzzleMove * 5);
        ctx.font = `bold ${16 * unit / 40}px "Noto Sans TC", sans-serif`;
        ctx.fillStyle = '#fde68a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const ctrA = squareCenter(sqA);
        ctx.fillText('第 1 塊', ctrA.x, ctrA.y);
        ctx.restore();
    }

    // ─── Phase 4: Cut lines on b² ───
    if (S.cutB > 0.01 && S.puzzleMove < 0.01) {
        drawCutLinesB(sqB, S.cutB);
    }

    // ─── Phase 5: Puzzle assembly ───
    if (S.puzzleMove > 0.01) {
        drawPuzzleAssembly(L, sqA, sqB, sqC, S.puzzleMove);
    }

    // ─── Draw triangle ───
    if (triAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = triAlpha;

        // Triangle fill
        ctx.beginPath();
        ctx.moveTo(Rx, Ry);
        ctx.lineTo(Bx, By);
        ctx.lineTo(Ax, Ay);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fill();

        // Triangle stroke
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Right angle marker
        const markSize = 12;
        ctx.beginPath();
        ctx.moveTo(Rx + markSize, Ry);
        ctx.lineTo(Rx + markSize, Ry - markSize);
        ctx.lineTo(Rx, Ry - markSize);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Side labels — fade out once area labels on squares appear
        const sideLabelAlpha = clamp(1 - (sqAProgress - 0.3) / 0.5);
        if (sideLabelAlpha > 0.01) {
            ctx.save();
            ctx.globalAlpha = triAlpha * sideLabelAlpha;
            ctx.font = `bold ${Math.max(14, unit * 0.5)}px "Noto Sans TC", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 6;

            // Label a (left side) — further left to avoid overlap
            ctx.fillStyle = '#fca5a5';
            ctx.fillText('a=3', Rx - unit * 0.7, (Ay + Ry) / 2);

            // Label b (bottom side) — lower
            ctx.fillStyle = '#93c5fd';
            ctx.fillText('b=4', (Rx + Bx) / 2, Ry + unit * 0.55);

            // Label c (hypotenuse)
            ctx.fillStyle = '#c4b5fd';
            const cmx = (Ax + Bx) / 2 + unit * 0.4;
            const cmy = (Ay + By) / 2 - unit * 0.25;
            ctx.fillText('c=5', cmx, cmy);

            ctx.shadowBlur = 0;
            ctx.restore();
        }

        ctx.restore();
    }

    // Triangle glow
    if (S.triGlow > 0.01) {
        ctx.save();
        const glowAlpha = 0.15 + 0.1 * Math.sin(S.triGlow * Math.PI * 4);
        ctx.globalAlpha = glowAlpha;
        ctx.beginPath();
        ctx.moveTo(Rx, Ry);
        ctx.lineTo(Bx, By);
        ctx.lineTo(Ax, Ay);
        ctx.closePath();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // ─── Phase 6: Proof complete ───
    if (S.proofFormula > 0.01) {
        drawFormulaBox(cx, Ry + unit * 4.5, S.proofFormula, S.proofGlow, 'a² + b² = c² ✓');
    }
}

// ═══════════════════════════════════════════════════
//  WATER SCENE (Phases 7–9)
// ═══════════════════════════════════════════════════
function drawWaterScene(L) {
    const { unit, cx, cy } = L;

    const setupT = easeOut(clamp(S.waterSetup));

    // Water scene layout: 3 square containers
    // a² and b² on the left, c² on the right
    const gap = unit * 0.8;
    const aSize = A_SIDE * unit;
    const bSize = B_SIDE * unit;
    const cSize = C_SIDE * unit;

    // Center them vertically
    const baseY = cy + cSize * 0.4;

    // a² box position (top-left group)
    const aX = cx - cSize * 0.8 - gap;
    const aY = baseY - aSize;

    // b² box position (bottom-left group, below a²)
    const bX = cx - cSize * 0.8 - gap - (bSize - aSize) / 2;
    const bY = baseY - bSize - aSize - gap * 0.5;

    // Rearrange: a² and b² stacked on left, c² on right
    const leftCenterX = cx * 0.38;
    const rightCenterX = cx * 1.35;

    const aSqX = leftCenterX - aSize / 2;
    const aSqY = baseY - aSize;

    const bSqX = leftCenterX - bSize / 2;
    const bSqY = baseY - aSize - gap * 2.2 - bSize;

    const cSqX = rightCenterX - cSize / 2;
    const cSqY = baseY - cSize;

    // Glass container style
    const glassStroke = 'rgba(255,255,255,0.5)';
    const glassFill = 'rgba(255,255,255,0.03)';
    const waterColor1 = 'rgba(59,130,246,0.7)';
    const waterColor2 = 'rgba(96,165,250,0.5)';

    // Compute water levels
    const fillA = S.waterFillA;
    const fillB = S.waterFillB;
    const pour  = S.waterPour;

    // Water draining: a and b lose water, c gains water
    const aWaterLevel = clamp(fillA * (1 - pour));          // fraction full
    const bWaterLevel = clamp(fillB * (1 - pour));
    // c should fill to exactly full when pour=1
    // total volume = a²*1 + b²*1 = 9 + 16 = 25 = c²
    const cWaterLevel = clamp(pour * (A_SIDE*A_SIDE + B_SIDE*B_SIDE) / (C_SIDE*C_SIDE));

    const sceneAlpha = setupT;
    ctx.save();
    ctx.globalAlpha = sceneAlpha;

    // ─── Draw container a² ───
    drawWaterContainer(aSqX, aSqY, aSize, aSize, aWaterLevel, '#ef4444', 'a²', glassStroke, false);

    // ─── Draw container b² ───
    drawWaterContainer(bSqX, bSqY, bSize, bSize, bWaterLevel, '#3b82f6', 'b²', glassStroke, false);

    // ─── Draw container c² ───
    drawWaterContainer(cSqX, cSqY, cSize, cSize, cWaterLevel, '#8b5cf6', 'c²', glassStroke, false);

    // ─── Water flow stream (phase 8) ───
    if (pour > 0.01 && pour < 0.99) {
        drawWaterStream(
            leftCenterX, bSqY + bSize * 0.3,
            rightCenterX, cSqY + cSize * 0.1,
            pour
        );
        drawWaterStream(
            leftCenterX, aSqY + aSize * 0.3,
            rightCenterX, cSqY + cSize * 0.3,
            pour
        );
    }

    // ─── Labels ───
    ctx.font = `bold ${Math.max(12, unit * 0.38)}px "Noto Sans TC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;

    // a² label — below its container
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fca5a5';
    ctx.fillText(`a² = ${A_SIDE*A_SIDE}`, leftCenterX, aSqY + aSize + 10);

    // b² label — in the gap between b² bottom and a² top
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#93c5fd';
    const bLabelY = (bSqY + bSize + aSqY) / 2;
    ctx.fillText(`b² = ${B_SIDE*B_SIDE}`, leftCenterX, bLabelY);

    // c² label — below its container
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#c4b5fd';
    ctx.fillText(`c² = ${C_SIDE*C_SIDE}`, rightCenterX, cSqY + cSize + 10);

    ctx.shadowBlur = 0;

    // ─── Plus sign between a² and b² ───
    ctx.font = `bold ${Math.max(18, unit * 0.55)}px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', leftCenterX, aSqY - gap * 0.3);

    // ─── Equals sign ───
    ctx.fillText('=', (leftCenterX + rightCenterX) / 2, (aSqY + bSqY + bSize) / 2);

    ctx.restore();

    // ─── Phase 9: Final formula + confetti ───
    if (S.finalFormula > 0.01) {
        drawFormulaBox(cx, baseY + unit * 1.5, S.finalFormula, S.finalGlow, 'a² + b² = c²');
    }

    if (S.confetti > 0.01) {
        drawConfetti(S.confetti);
    }
}

// ═══════════════════════════════════════════════════
//  Drawing Helpers
// ═══════════════════════════════════════════════════

function getSquareOutward(x1, y1, x2, y2, hint) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let nx, ny;

    // Outward normal based on hint
    switch (hint) {
        case 'left':   nx = -dy; ny = dx; break;
        case 'right':  nx = dy; ny = -dx; break;
        case 'down':   nx = -dy; ny = dx; break;
        case 'up':     nx = dy; ny = -dx; break;
        default:       nx = -dy; ny = dx; break;
    }

    return [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
        { x: x2 + nx, y: y2 + ny },
        { x: x1 + nx, y: y1 + ny },
    ];
}

function squareCenter(sq) {
    return {
        x: (sq[0].x + sq[1].x + sq[2].x + sq[3].x) / 4,
        y: (sq[0].y + sq[1].y + sq[2].y + sq[3].y) / 4,
    };
}

function drawSquareAnimated(sq, progress, colorBase, strokeColor, pulse) {
    ctx.save();

    const center = squareCenter(sq);
    const scale = progress;

    ctx.translate(center.x, center.y);
    ctx.scale(scale, scale);
    ctx.translate(-center.x, -center.y);

    // Pulse effect
    let alpha = 0.2;
    if (pulse > 0.01) {
        alpha = 0.2 + 0.15 * Math.sin(pulse * Math.PI * 6);
    }

    ctx.beginPath();
    ctx.moveTo(sq[0].x, sq[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(sq[i].x, sq[i].y);
    ctx.closePath();

    ctx.fillStyle = colorBase + alpha + ')';
    ctx.fill();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = progress;
    ctx.stroke();

    // Grid lines inside the square
    const gridN = Math.round(Math.sqrt(
        (sq[1].x - sq[0].x) ** 2 + (sq[1].y - sq[0].y) ** 2
    ) / (getLayout().unit));
    if (gridN > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        for (let g = 1; g < gridN; g++) {
            const t = g / gridN;
            // Lines parallel to edge 0-1
            const p1x = lerp(sq[0].x, sq[3].x, t);
            const p1y = lerp(sq[0].y, sq[3].y, t);
            const p2x = lerp(sq[1].x, sq[2].x, t);
            const p2y = lerp(sq[1].y, sq[2].y, t);
            ctx.beginPath();
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.stroke();
            // Lines parallel to edge 0-3
            const q1x = lerp(sq[0].x, sq[1].x, t);
            const q1y = lerp(sq[0].y, sq[1].y, t);
            const q2x = lerp(sq[3].x, sq[2].x, t);
            const q2y = lerp(sq[3].y, sq[2].y, t);
            ctx.beginPath();
            ctx.moveTo(q1x, q1y);
            ctx.lineTo(q2x, q2y);
            ctx.stroke();
        }
    }

    ctx.restore();
}

function drawAreaLabel(sq, text, alpha, color) {
    ctx.save();
    const center = squareCenter(sq);
    ctx.globalAlpha = easeOut(clamp((alpha - 0.5) / 0.5));
    ctx.font = `bold ${Math.max(14, getLayout().unit * 0.48)}px "Noto Sans TC", monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 6;
    ctx.fillText(text, center.x, center.y);
    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawCutLinesB(sqB, progress) {
    ctx.save();
    const center = squareCenter(sqB);
    const p = easeOut(clamp(progress));

    // Draw cross through center of b² square
    // The cross is aligned with the sides of the square
    const halfDiag = Math.sqrt(
        (sqB[1].x - sqB[0].x) ** 2 + (sqB[1].y - sqB[0].y) ** 2
    ) / 2;

    // Horizontal-ish cut (parallel to side 0-1)
    const dx01 = (sqB[1].x - sqB[0].x);
    const dy01 = (sqB[1].y - sqB[0].y);
    const len01 = Math.sqrt(dx01*dx01 + dy01*dy01);
    const nx01 = dx01 / len01;
    const ny01 = dy01 / len01;

    // Perpendicular cut (parallel to side 0-3)
    const dx03 = (sqB[3].x - sqB[0].x);
    const dy03 = (sqB[3].y - sqB[0].y);
    const len03 = Math.sqrt(dx03*dx03 + dy03*dy03);
    const nx03 = dx03 / len03;
    const ny03 = dy03 / len03;

    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 10;

    // Cut line 1: through center, parallel to edge 0-1
    const ext1 = halfDiag * p;
    ctx.beginPath();
    ctx.moveTo(center.x - nx01 * ext1, center.y - ny01 * ext1);
    ctx.lineTo(center.x + nx01 * ext1, center.y + ny01 * ext1);
    ctx.stroke();

    // Cut line 2: through center, parallel to edge 0-3
    const ext2 = halfDiag * p;
    ctx.beginPath();
    ctx.moveTo(center.x - nx03 * ext2, center.y - ny03 * ext2);
    ctx.lineTo(center.x + nx03 * ext2, center.y + ny03 * ext2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // Scissors emoji
    if (progress > 0.1 && progress < 0.95) {
        ctx.font = '24px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 8;
        ctx.fillText('✂️', center.x + nx01 * ext1 + 15, center.y + ny01 * ext1);
        ctx.shadowBlur = 0;
    }

    // Number the 4 pieces
    if (progress > 0.7) {
        const lblAlpha = easeOut(clamp((progress - 0.7) / 0.3));
        ctx.globalAlpha = lblAlpha;
        ctx.font = `bold ${Math.max(11, getLayout().unit * 0.32)}px "Noto Sans TC", sans-serif`;
        ctx.fillStyle = '#fde68a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const off = halfDiag * 0.4;
        const positions = [
            { x: center.x - nx01 * off - nx03 * off, y: center.y - ny01 * off - ny03 * off, label: '第2塊' },
            { x: center.x + nx01 * off - nx03 * off, y: center.y + ny01 * off - ny03 * off, label: '第3塊' },
            { x: center.x + nx01 * off + nx03 * off, y: center.y + ny01 * off + ny03 * off, label: '第4塊' },
            { x: center.x - nx01 * off + nx03 * off, y: center.y - ny01 * off + ny03 * off, label: '第5塊' },
        ];
        positions.forEach(p => {
            ctx.fillText(p.label, p.x, p.y);
        });
    }

    ctx.restore();
}

function drawPuzzleAssembly(L, sqA, sqB, sqC, progress) {
    const t = ease(clamp(progress));
    const cCenter = squareCenter(sqC);
    const aCenter = squareCenter(sqA);
    const bCenter = squareCenter(sqB);

    const { unit } = L;
    const sideC = C_SIDE * unit;
    const sideA = A_SIDE * unit;
    const sideB = B_SIDE * unit;

    // Target: a² piece goes to center of c²
    // b² four pieces go to surround a² in c²

    // Piece 1 (a² whole): move from a² center to c² center
    const piece1X = lerp(aCenter.x, cCenter.x, t);
    const piece1Y = lerp(aCenter.y, cCenter.y, t);

    // Scale a² piece into c² context
    ctx.save();

    // Draw a² piece moving
    ctx.globalAlpha = 0.6 + 0.4 * t;
    ctx.translate(piece1X, piece1Y);

    ctx.beginPath();
    ctx.rect(-sideA / 2, -sideA / 2, sideA, sideA);
    ctx.fillStyle = `rgba(239,68,68,${0.3 + 0.3 * t})`;
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (t > 0.8) {
        ctx.font = `bold ${Math.max(11, unit * 0.3)}px sans-serif`;
        ctx.fillStyle = '#fca5a5';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('a²', 0, 0);
    }

    ctx.restore();

    // Piece 2–5 (b² quarters): fly from b² to surround a² inside c²
    // The four pieces occupy the L-shaped region around a² in c²
    // Simplified: draw 4 rectangles that together with a² fill c²

    // The bar widths: (sideC - sideA) / 2 on each side
    const margin = (sideC - sideA) / 2;

    const bPieceTargets = [
        // Top strip
        { x: cCenter.x, y: cCenter.y - sideA / 2 - margin / 2, w: sideC, h: margin },
        // Bottom strip
        { x: cCenter.x, y: cCenter.y + sideA / 2 + margin / 2, w: sideC, h: margin },
        // Left strip (between top and bottom strips)
        { x: cCenter.x - sideA / 2 - margin / 2, y: cCenter.y, w: margin, h: sideA },
        // Right strip
        { x: cCenter.x + sideA / 2 + margin / 2, y: cCenter.y, w: margin, h: sideA },
    ];

    // b² quarters start positions (around b² center)
    const halfB = sideB / 2;
    const bPieceSources = [
        { x: bCenter.x, y: bCenter.y - halfB / 2, w: sideB, h: halfB },
        { x: bCenter.x, y: bCenter.y + halfB / 2, w: sideB, h: halfB },
        { x: bCenter.x - halfB / 2, y: bCenter.y, w: halfB, h: sideB },
        { x: bCenter.x + halfB / 2, y: bCenter.y, w: halfB, h: sideB },
    ];

    const blues = ['rgba(59,130,246,', 'rgba(37,99,235,', 'rgba(96,165,250,', 'rgba(29,78,216,'];

    for (let i = 0; i < 4; i++) {
        const src = bPieceSources[i];
        const tgt = bPieceTargets[i];

        // Stagger arrival
        const stagger = i * 0.08;
        const lt = ease(clamp((progress - stagger) / (1 - stagger)));

        const px = lerp(src.x, tgt.x, lt);
        const py = lerp(src.y, tgt.y, lt);
        const pw = lerp(src.w, tgt.w, lt);
        const ph = lerp(src.h, tgt.h, lt);

        ctx.save();
        ctx.globalAlpha = 0.5 + 0.5 * lt;
        ctx.translate(px, py);

        ctx.beginPath();
        ctx.rect(-pw / 2, -ph / 2, pw, ph);
        ctx.fillStyle = blues[i] + (0.3 + 0.3 * lt) + ')';
        ctx.fill();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
    }

    // Draw c² outline on top
    if (t > 0.3) {
        ctx.save();
        ctx.globalAlpha = easeOut(clamp((t - 0.3) / 0.4));
        ctx.beginPath();
        ctx.rect(cCenter.x - sideC / 2, cCenter.y - sideC / 2, sideC, sideC);
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#a78bfa';
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // Completion flash
    if (t > 0.95 && S.proofGlow > 0.01) {
        ctx.save();
        const flashAlpha = S.proofGlow * 0.3 * (1 + Math.sin(S.proofGlow * Math.PI * 4) * 0.3);
        ctx.globalAlpha = flashAlpha;
        const grad = ctx.createRadialGradient(cCenter.x, cCenter.y, 0, cCenter.x, cCenter.y, sideC);
        grad.addColorStop(0, 'rgba(167,139,250,0.4)');
        grad.addColorStop(1, 'rgba(167,139,250,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(cCenter.x - sideC, cCenter.y - sideC, sideC * 2, sideC * 2);
        ctx.restore();
    }
}

function drawWaterContainer(x, y, w, h, waterLevel, accentColor, label, glassStroke, showLabel = true) {
    ctx.save();

    // Container background
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(x, y, w, h);

    // Water fill
    if (waterLevel > 0.005) {
        const waterH = h * waterLevel;
        const waterY = y + h - waterH;

        // Water gradient
        const wGrad = ctx.createLinearGradient(x, waterY, x, y + h);
        wGrad.addColorStop(0, 'rgba(59,130,246,0.5)');
        wGrad.addColorStop(0.5, 'rgba(59,130,246,0.65)');
        wGrad.addColorStop(1, 'rgba(37,99,235,0.75)');
        ctx.fillStyle = wGrad;
        ctx.fillRect(x, waterY, w, waterH);

        // Water surface highlight
        ctx.beginPath();
        ctx.moveTo(x, waterY);
        ctx.lineTo(x + w, waterY);
        ctx.strokeStyle = 'rgba(147,197,253,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Subtle wave on water surface
        ctx.beginPath();
        const waveAmp = 2;
        const time = Date.now() / 600;
        for (let wx = 0; wx <= w; wx += 2) {
            const wy = waterY + Math.sin((wx / w) * Math.PI * 3 + time) * waveAmp;
            if (wx === 0) ctx.moveTo(x + wx, wy);
            else ctx.lineTo(x + wx, wy);
        }
        ctx.strokeStyle = 'rgba(147,197,253,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Glass container border
    ctx.strokeStyle = glassStroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Accent color top border
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Label above (only if showLabel is true)
    if (showLabel) {
        ctx.font = `bold ${Math.max(13, getLayout().unit * 0.4)}px "Noto Sans TC", sans-serif`;
        ctx.fillStyle = accentColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, x + w / 2, y - 6);
    }

    ctx.restore();
}

function drawWaterStream(x1, y1, x2, y2, progress) {
    ctx.save();

    const t = progress;
    const flowing = Math.sin(t * Math.PI) > 0.1;
    if (!flowing) { ctx.restore(); return; }

    const alpha = Math.sin(t * Math.PI) * 0.7;
    ctx.globalAlpha = alpha;

    // Curved stream from left to right
    const cpx1 = lerp(x1, x2, 0.3);
    const cpy1 = Math.min(y1, y2) - 40;
    const cpx2 = lerp(x1, x2, 0.7);
    const cpy2 = Math.min(y1, y2) - 30;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x2, y2);
    ctx.strokeStyle = 'rgba(96,165,250,0.8)';
    ctx.lineWidth = 5;
    ctx.shadowColor = 'rgba(96,165,250,0.5)';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Animated droplets along the path
    const numDrops = 8;
    for (let i = 0; i < numDrops; i++) {
        const dt = ((Date.now() / 400 + i / numDrops) % 1);
        const dx = bezierPoint(x1, cpx1, cpx2, x2, dt);
        const dy = bezierPoint(y1, cpy1, cpy2, y2, dt);
        ctx.beginPath();
        ctx.arc(dx, dy, 2 + Math.random(), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(147,197,253,0.7)';
        ctx.fill();
    }

    ctx.restore();
}

function bezierPoint(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    return mt*mt*mt*p0 + 3*mt*mt*t*p1 + 3*mt*t*t*p2 + t*t*t*p3;
}

function drawFormulaBox(cx, y, alpha, glow, text) {
    ctx.save();
    ctx.globalAlpha = easeOut(clamp(alpha));

    const scale = lerp(0.5, 1, easeOut(clamp(alpha)));
    const boxW = 300;
    const boxH = 52;
    const boxX = cx - boxW / 2;
    const boxY = y;

    ctx.translate(cx, boxY + boxH / 2);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -(boxY + boxH / 2));

    // Background glow
    if (glow > 0.01) {
        const bgG = ctx.createRadialGradient(cx, boxY + boxH / 2, 0, cx, boxY + boxH / 2, 200);
        bgG.addColorStop(0, `rgba(167,139,250,${0.12 * glow})`);
        bgG.addColorStop(1, 'rgba(167,139,250,0)');
        ctx.fillStyle = bgG;
        ctx.fillRect(cx - 220, boxY - 20, 440, boxH + 40);
    }

    // Box
    ctx.beginPath();
    roundRect(ctx, boxX, boxY, boxW, boxH, 14);
    ctx.fillStyle = 'rgba(13,13,13,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(167,139,250,0.6)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(139,92,246,0.6)';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    roundRect(ctx, boxX, boxY, boxW, boxH, 14);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Noto Sans TC", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(139,92,246,0.7)';
    ctx.shadowBlur = 10;
    ctx.fillText(text, cx, boxY + boxH / 2);
    ctx.shadowBlur = 0;

    ctx.restore();
}

function drawConfetti(progress) {
    if (progress < 0.01) return;
    ctx.save();
    ctx.globalAlpha = clamp(progress) * clamp(2 - progress * 2);

    confettiParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        if (p.y > 1.2) { p.y = -0.1; p.x = Math.random(); }

        const px = p.x * cW;
        const py = p.y * cH;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
    });

    ctx.restore();
}

// ───────────────────────────────────────────────────
// Continuous animation loop for water waves + confetti
// ───────────────────────────────────────────────────
let animating = false;
function animLoop() {
    if (S.waterSetup > 0.01 || S.confetti > 0.01) {
        draw();
        animating = true;
        requestAnimationFrame(animLoop);
    } else {
        animating = false;
    }
}

// ───────────────────────────────────────────────────
// Phase dots
// ───────────────────────────────────────────────────
const PHASE_BREAKS = [0, 0.08, 0.17, 0.26, 0.35, 0.44, 0.55, 0.66, 0.77, 0.88];
const dots = document.querySelectorAll('.phase-dot');

function updateDots(progress) {
    let current = 0;
    for (let i = PHASE_BREAKS.length - 1; i >= 0; i--) {
        if (progress >= PHASE_BREAKS[i]) { current = i; break; }
    }
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
}

// ───────────────────────────────────────────────────
// Boot
// ───────────────────────────────────────────────────
resize();

// ───────────────────────────────────────────────────
// GSAP ScrollTrigger Timeline (10 phases across 1200vh)
// ───────────────────────────────────────────────────
const tl = gsap.timeline({
    scrollTrigger: {
        trigger: '.scroll-container',
        start:   'top top',
        end:     'bottom bottom',
        scrub:   1.8,
        onUpdate(self) {
            const p = self.progress;
            updateDots(p);

            // Step text visibility
            const steps = PHASE_BREAKS;
            document.querySelectorAll('.step').forEach((el, idx) => {
                const lo = steps[idx];
                const hi = steps[idx + 1] ?? 1.01;
                el.classList.toggle('active', p >= lo && p < hi);
            });

            // Start continuous animation loop for water scene
            if ((S.waterSetup > 0.01 || S.confetti > 0.01) && !animating) {
                animLoop();
            }
        }
    }
});

// ── Phase 0: Draw triangle (0%→8%)
tl.to(S, {
    triDraw: 1,
    triGlow: 1,
    duration: 1.0,
    ease: 'power1.inOut',
    onUpdate: draw
});

// ── Phase 1: Squares grow (8%→17%)
tl.to(S, {
    sqGrowA:  1,
    sqGrowB:  1,
    sqGrowC:  1,
    triGlow:  0,
    duration: 1.2,
    ease: 'power2.out',
    onUpdate: draw
});

// ── Phase 2: Pulse/observe (17%→26%)
tl.to(S, {
    pulseAB: 1,
    pulseC:  1,
    duration: 1.0,
    ease: 'none',
    onUpdate: draw
});

// ── Phase 3: Mark a² (26%→35%)
tl.to(S, {
    markA:   1,
    pulseAB: 0,
    pulseC:  0,
    duration: 1.0,
    ease: 'power1.inOut',
    onUpdate: draw
});

// ── Phase 4: Cut b² (35%→44%)
tl.to(S, {
    cutB:  1,
    duration: 1.2,
    ease: 'power1.inOut',
    onUpdate: draw
});

// ── Phase 5: Puzzle assembly (44%→55%)
tl.to(S, {
    puzzleMove: 1,
    markA:      0,
    cutB:       0,
    duration: 1.4,
    ease: 'power1.inOut',
    onUpdate: draw
});

// ── Phase 6: Proof celebration (55%→66%)
tl.to(S, {
    proofGlow:    1,
    proofFormula: 1,
    duration: 1.2,
    ease: 'power2.out',
    onUpdate: draw
});

// ── Phase 7: Transition to water + fill (66%→77%)
tl.to(S, {
    waterSetup:   1,
    proofGlow:    0,
    proofFormula: 0,
    puzzleMove:   0,
    sqGrowA:      0,
    sqGrowB:      0,
    sqGrowC:      0,
    triDraw:      0,
    waterFillA:   1,
    waterFillB:   1,
    duration: 1.4,
    ease: 'power1.inOut',
    onUpdate: draw
});

// ── Phase 8: Pour water (77%→88%)
tl.to(S, {
    waterPour: 1,
    duration: 1.4,
    ease: 'power1.inOut',
    onUpdate: draw
});

// ── Phase 9: Final celebration (88%→100%)
tl.to(S, {
    finalGlow:    1,
    finalFormula: 1,
    confetti:     1,
    duration: 1.2,
    ease: 'power2.out',
    onUpdate: draw
});
