/* ============================================================
   sqrt2.js  –  √2 Number Line Visualization
   Canvas animation driven by GSAP ScrollTrigger
   ============================================================ */
(() => {
    "use strict";

    /* ----- Canvas setup ----- */
    const canvas = document.getElementById("sqrt2-canvas");
    const ctx = canvas.getContext("2d");
    let W, H, dpr;

    function resize() {
        dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        W = rect.width;
        H = rect.height;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener("resize", resize);
    resize();

    /* ----- Scroll progress ----- */
    const NUM_PHASES = 6;
    let progress = 0;

    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.create({
        trigger: ".scroll-container",
        start: "top top",
        end: "bottom bottom",
        scrub: 0.5,
        onUpdate: (self) => {
            progress = self.progress;
        }
    });

    /* ----- Phase / step management ----- */
    const steps = document.querySelectorAll(".step");
    const dots = document.querySelectorAll(".phase-dot");
    let prevPhase = -1;

    function updatePhaseUI(phase) {
        if (phase === prevPhase) return;
        prevPhase = phase;
        steps.forEach((s, i) => s.classList.toggle("active", i === phase));
        dots.forEach((d, i) => d.classList.toggle("active", i === phase));
    }

    /* ----- Colour palette ----- */
    const COL = {
        bg: "#0d0d0d",
        line: "#ffffff",
        lineFaint: "rgba(255,255,255,0.25)",
        gold: "#fbbf24",
        green: "#34d399",
        purple: "#a78bfa",
        cyan: "#22d3ee",
        amber: "#fb923c",
        white: "#ffffff",
        whiteFaint: "rgba(255,255,255,0.5)",
        squareFill: "rgba(251,191,36,0.12)",
        squareStroke: "#fbbf24",
        arcStroke: "rgba(167,139,250,0.6)",
        diag: "#fbbf24",
        sqrt2Glow: "#a78bfa",
    };

    /* ----- Helper drawing ----- */
    function drawLine(x1, y1, x2, y2, color, lw) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = lw || 2;
        ctx.stroke();
    }

    function drawCircle(x, y, r, color) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    }

    function drawText(text, x, y, size, color, align, baseline, font) {
        ctx.font = `${font || "bold"} ${size}px 'Noto Sans TC', sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = align || "center";
        ctx.textBaseline = baseline || "middle";
        ctx.fillText(text, x, y);
    }

    function drawDashedLine(x1, y1, x2, y2, color, lw) {
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = lw || 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /* ----- Easing helpers ----- */
    function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
    function clamp01(t) { return Math.max(0, Math.min(1, t)); }
    function lerp(a, b, t) { return a + (b - a) * t; }

    /* ----- Layout constants (computed from canvas size) ----- */
    function getLayout() {
        const cx = W * 0.5;
        const cy = H * 0.55;
        const unit = Math.min(W * 0.22, H * 0.18);   // 1 unit on number line
        const nlY = cy;                                // number line y
        const nlLeft = cx - unit * 1.2;                // start of visible number line
        const nlRight = cx + unit * 1.8;               // end of visible number line

        const o = { x: nlLeft + unit * 0.2, y: nlY };  // position of 0
        const one = { x: o.x + unit, y: nlY };          // position of 1
        const sqrt2Pos = { x: o.x + unit * Math.SQRT2, y: nlY }; // position of √2

        return { cx, cy, unit, nlY, nlLeft, nlRight, o, one, sqrt2Pos };
    }

    /* ============================================================
       PHASE DRAWING FUNCTIONS
       ============================================================ */

    /* ----- Phase 0: Number line with 0 and 1 ----- */
    function drawNumberLine(L, alpha) {
        ctx.globalAlpha = alpha;
        // Main line
        drawLine(L.nlLeft, L.nlY, L.nlRight, L.nlY, COL.line, 2.5);

        // Tick at 0
        drawLine(L.o.x, L.nlY - 12, L.o.x, L.nlY + 12, COL.green, 2.5);
        drawText("0", L.o.x, L.nlY + 32, 22, COL.green);

        // Tick at 1
        drawLine(L.one.x, L.nlY - 12, L.one.x, L.nlY + 12, COL.green, 2.5);
        drawText("1", L.one.x, L.nlY + 32, 22, COL.green);

        // Tick at 2
        const two = { x: L.o.x + L.unit * 2, y: L.nlY };
        if (two.x < L.nlRight + 10) {
            drawLine(two.x, L.nlY - 8, two.x, L.nlY + 8, COL.whiteFaint, 1.5);
            drawText("2", two.x, L.nlY + 32, 18, COL.whiteFaint);
        }

        // Arrow tips
        // right arrow
        ctx.beginPath();
        ctx.moveTo(L.nlRight, L.nlY);
        ctx.lineTo(L.nlRight - 10, L.nlY - 6);
        ctx.lineTo(L.nlRight - 10, L.nlY + 6);
        ctx.closePath();
        ctx.fillStyle = COL.line;
        ctx.fill();

        ctx.globalAlpha = 1;
    }

    function drawPhase0(L, t) {
        const alpha = ease(clamp01(t * 3));
        drawNumberLine(L, alpha);

        // Question mark near expected √2 position
        if (t > 0.3) {
            const qa = ease(clamp01((t - 0.3) * 3));
            ctx.globalAlpha = qa * 0.6;
            drawText("√2 ≈ 1.414…?", L.sqrt2Pos.x, L.nlY - 50, 20, COL.gold, "center", "middle", "normal");
            drawDashedLine(L.sqrt2Pos.x, L.nlY - 35, L.sqrt2Pos.x, L.nlY - 5, COL.gold, 1.5);
            ctx.globalAlpha = 1;
        }
    }

    /* ----- Phase 1: Unit square + diagonal ----- */
    function drawPhase1(L, t) {
        drawNumberLine(L, 1);

        const sqBottom = L.nlY;
        const sqTop = L.nlY - L.unit;
        const sqLeft = L.o.x;
        const sqRight = L.one.x;

        // Draw square edges progressively
        const edgeT = ease(clamp01(t * 2.5));

        ctx.globalAlpha = edgeT;
        // Bottom edge (already part of number line between 0 and 1)
        // Left edge
        drawLine(sqLeft, sqBottom, sqLeft, lerp(sqBottom, sqTop, edgeT), COL.squareStroke, 2);
        // Top edge
        if (edgeT > 0.3) {
            const topT = clamp01((edgeT - 0.3) / 0.35);
            drawLine(sqLeft, sqTop, lerp(sqLeft, sqRight, topT), sqTop, COL.squareStroke, 2);
        }
        // Right edge
        if (edgeT > 0.6) {
            const rightT = clamp01((edgeT - 0.6) / 0.4);
            drawLine(sqRight, sqTop, sqRight, lerp(sqTop, sqBottom, rightT), COL.squareStroke, 2);
        }

        // Fill square
        if (edgeT > 0.8) {
            ctx.globalAlpha = (edgeT - 0.8) * 5 * 0.15;
            ctx.fillStyle = COL.squareFill;
            ctx.fillRect(sqLeft, sqTop, L.unit, L.unit);
        }

        // Side labels
        if (edgeT > 0.5) {
            const lAlpha = clamp01((edgeT - 0.5) * 2);
            ctx.globalAlpha = lAlpha;
            drawText("1", sqLeft - 20, (sqBottom + sqTop) / 2, 20, COL.gold, "center");
            drawText("1", (sqLeft + sqRight) / 2, sqTop - 18, 20, COL.gold, "center");
        }

        // Diagonal
        const diagT = ease(clamp01((t - 0.45) * 2.5));
        if (diagT > 0) {
            ctx.globalAlpha = diagT;
            const dx = lerp(sqLeft, sqRight, diagT);
            const dy = lerp(sqBottom, sqTop, diagT);
            drawLine(sqLeft, sqBottom, dx, dy, COL.diag, 3);

            // Diagonal label
            if (diagT > 0.6) {
                const dlAlpha = clamp01((diagT - 0.6) * 2.5);
                ctx.globalAlpha = dlAlpha;
                const midX = (sqLeft + sqRight) / 2 + 14;
                const midY = (sqBottom + sqTop) / 2 + 4;

                // background for readability
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                const mw = ctx.measureText("√2").width + 16 || 50;
                ctx.font = `bold 22px 'Noto Sans TC', sans-serif`;
                const tw = ctx.measureText("√2").width;
                ctx.fillRect(midX - tw / 2 - 8, midY - 16, tw + 16, 32);

                drawText("√2", midX, midY, 22, COL.gold, "center", "middle");
            }
        }

        ctx.globalAlpha = 1;
    }

    /* ----- Phase 2: Compass arc ----- */
    function drawPhase2(L, t) {
        drawNumberLine(L, 1);

        const sqBottom = L.nlY;
        const sqTop = L.nlY - L.unit;
        const sqLeft = L.o.x;
        const sqRight = L.one.x;

        // Draw full square (faded)
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = COL.squareStroke;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sqLeft, sqTop, L.unit, L.unit);
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = COL.squareFill;
        ctx.fillRect(sqLeft, sqTop, L.unit, L.unit);

        // Draw full diagonal
        ctx.globalAlpha = 0.8;
        drawLine(sqLeft, sqBottom, sqRight, sqTop, COL.diag, 2.5);
        ctx.globalAlpha = 1;

        // Side labels (faded)
        ctx.globalAlpha = 0.4;
        drawText("1", sqLeft - 20, (sqBottom + sqTop) / 2, 18, COL.gold, "center");
        drawText("1", (sqLeft + sqRight) / 2, sqTop - 18, 18, COL.gold, "center");
        ctx.globalAlpha = 1;

        // Arc animation
        // The diagonal goes from (sqLeft, sqBottom) = origin to (sqRight, sqTop)
        // The angle of diagonal from horizontal: atan2(-(sqTop - sqBottom), sqRight - sqLeft) = atan2(unit, unit) = 45° above x axis = -π/4
        const radius = L.unit * Math.SQRT2;
        const startAngle = -Math.PI / 4;    // diagonal direction (up-right)
        const endAngle = 0;                  // horizontal right = positive x

        const arcT = ease(clamp01(t * 1.8));

        // Draw arc
        if (arcT > 0) {
            ctx.beginPath();
            const currentAngle = lerp(startAngle, endAngle, arcT);
            ctx.arc(L.o.x, L.nlY, radius, startAngle, currentAngle, false);
            ctx.strokeStyle = COL.arcStroke;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Moving dot on arc
            const dotX = L.o.x + radius * Math.cos(currentAngle);
            const dotY = L.nlY + radius * Math.sin(currentAngle);
            drawCircle(dotX, dotY, 5, COL.purple);

            // Compass line from origin to moving dot
            ctx.globalAlpha = 0.5;
            drawDashedLine(L.o.x, L.nlY, dotX, dotY, COL.purple, 1.5);
            ctx.globalAlpha = 1;
        }

        // √2 mark on number line
        if (arcT > 0.85) {
            const markAlpha = clamp01((arcT - 0.85) * 7);
            ctx.globalAlpha = markAlpha;

            // Glow
            const grd = ctx.createRadialGradient(L.sqrt2Pos.x, L.nlY, 0, L.sqrt2Pos.x, L.nlY, 25);
            grd.addColorStop(0, "rgba(167,139,250,0.5)");
            grd.addColorStop(1, "rgba(167,139,250,0)");
            ctx.fillStyle = grd;
            ctx.fillRect(L.sqrt2Pos.x - 25, L.nlY - 25, 50, 50);

            // Tick mark
            drawLine(L.sqrt2Pos.x, L.nlY - 14, L.sqrt2Pos.x, L.nlY + 14, COL.purple, 3);
            drawCircle(L.sqrt2Pos.x, L.nlY, 5, COL.purple);

            // Label
            drawText("√2", L.sqrt2Pos.x, L.nlY + 38, 22, COL.purple, "center");

            ctx.globalAlpha = 1;
        }
    }

    /* ----- Phase 3: Zoom in ----- */
    function drawPhase3(L, t) {
        // We show 4 zoom levels: [1, 2] → [1.4, 1.5] → [1.41, 1.42] → [1.414, 1.415]
        const zoomLevels = [
            { left: 0.8, right: 2.0, majorStep: 0.2, decimalPlaces: 1, highlight: 1.4 },
            { left: 1.35, right: 1.50, majorStep: 0.01, decimalPlaces: 2, highlight: 1.41 },
            { left: 1.410, right: 1.420, majorStep: 0.001, decimalPlaces: 3, highlight: 1.414 },
            { left: 1.4140, right: 1.4145, majorStep: 0.0001, decimalPlaces: 4, highlight: 1.4142 },
        ];

        // Determine current zoom level based on t
        const zoomIndex = Math.min(3, Math.floor(t * 4));
        const zoomSubT = clamp01((t * 4) - zoomIndex);

        const z = zoomLevels[zoomIndex];
        const nextZ = zoomLevels[Math.min(3, zoomIndex + 1)];

        // Interpolate zoom range for smooth transition
        const transT = ease(zoomSubT);
        let viewLeft, viewRight;

        if (zoomIndex < 3 && zoomSubT > 0.6) {
            const blendT = clamp01((zoomSubT - 0.6) / 0.4);
            const bt = ease(blendT);
            viewLeft = lerp(z.left, nextZ.left, bt);
            viewRight = lerp(z.right, nextZ.right, bt);
        } else {
            viewLeft = z.left;
            viewRight = z.right;
        }

        const margin = W * 0.08;
        const nlLeft = margin;
        const nlRight = W - margin;
        const nlWidth = nlRight - nlLeft;
        const nlY = H * 0.55;

        function valToX(val) {
            return nlLeft + (val - viewLeft) / (viewRight - viewLeft) * nlWidth;
        }

        // Draw number line
        drawLine(nlLeft - 10, nlY, nlRight + 10, nlY, COL.line, 2.5);

        // Tick marks
        const dp = z.decimalPlaces;
        const step = z.majorStep;
        let v = Math.ceil(viewLeft / step) * step;
        for (; v <= viewRight + step * 0.01; v += step) {
            const x = valToX(v);
            if (x < nlLeft - 5 || x > nlRight + 5) continue;

            const isMajor = Math.abs(v - Math.round(v * 10) / 10) < step * 0.01 && dp <= 1;
            const tickH = isMajor ? 12 : 8;
            drawLine(x, nlY - tickH, x, nlY + tickH, COL.whiteFaint, 1.5);

            // Label
            const label = v.toFixed(dp);
            ctx.globalAlpha = 0.7;
            drawText(label, x, nlY + tickH + 20, Math.max(11, 16 - dp * 1.5), COL.white, "center", "top", "normal");
            ctx.globalAlpha = 1;
        }

        // √2 position
        const sqrt2 = Math.SQRT2;
        const sqrt2X = valToX(sqrt2);

        if (sqrt2X >= nlLeft - 5 && sqrt2X <= nlRight + 5) {
            // Glow
            const grd = ctx.createRadialGradient(sqrt2X, nlY, 0, sqrt2X, nlY, 30);
            grd.addColorStop(0, "rgba(167,139,250,0.6)");
            grd.addColorStop(1, "rgba(167,139,250,0)");
            ctx.fillStyle = grd;
            ctx.fillRect(sqrt2X - 30, nlY - 30, 60, 60);

            drawLine(sqrt2X, nlY - 16, sqrt2X, nlY + 16, COL.purple, 3);
            drawCircle(sqrt2X, nlY, 6, COL.purple);

            // Label with increasing precision
            const precisionLabel = sqrt2.toFixed(dp + 1) + "…";
            drawText("√2", sqrt2X, nlY - 35, 22, COL.purple, "center");
            ctx.globalAlpha = 0.7;
            drawText(precisionLabel, sqrt2X, nlY - 58, 16, COL.amber, "center", "middle", "normal");
            ctx.globalAlpha = 1;
        }

        // Zoom level indicator
        ctx.globalAlpha = 0.5;
        const zoomLabel = `🔍 ×${Math.round(1 / (viewRight - viewLeft))}`;
        drawText(zoomLabel, W * 0.5, H * 0.15, 20, COL.white, "center", "middle", "normal");
        ctx.globalAlpha = 1;

        // "Decimal never ends" pulsing text
        if (t > 0.7) {
            const pulseAlpha = 0.4 + 0.3 * Math.sin(Date.now() / 500);
            ctx.globalAlpha = pulseAlpha * clamp01((t - 0.7) * 5);
            drawText("小數永不終止…永不循環…", W * 0.5, H * 0.82, 18, COL.amber, "center", "middle", "normal");
            ctx.globalAlpha = 1;
        }
    }

    /* ----- Phase 4: Meaning of irrational numbers ----- */
    function drawPhase4(L, t) {
        drawNumberLine(L, 1);

        const sqBottom = L.nlY;
        const sqTop = L.nlY - L.unit;
        const sqLeft = L.o.x;

        // Draw faded square
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = COL.squareStroke;
        ctx.lineWidth = 1;
        ctx.strokeRect(sqLeft, sqTop, L.unit, L.unit);
        ctx.globalAlpha = 1;

        // Draw faded diagonal
        ctx.globalAlpha = 0.3;
        drawLine(sqLeft, sqBottom, sqLeft + L.unit, sqTop, COL.diag, 2);
        ctx.globalAlpha = 1;

        // √2 point with pulsing glow
        const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 600);
        const glowR = 30 + 15 * pulse;

        const grd = ctx.createRadialGradient(L.sqrt2Pos.x, L.nlY, 0, L.sqrt2Pos.x, L.nlY, glowR);
        grd.addColorStop(0, `rgba(167,139,250,${0.6 * pulse})`);
        grd.addColorStop(0.5, `rgba(167,139,250,${0.2 * pulse})`);
        grd.addColorStop(1, "rgba(167,139,250,0)");
        ctx.fillStyle = grd;
        ctx.fillRect(L.sqrt2Pos.x - glowR, L.nlY - glowR, glowR * 2, glowR * 2);

        drawLine(L.sqrt2Pos.x, L.nlY - 16, L.sqrt2Pos.x, L.nlY + 16, COL.purple, 3);
        drawCircle(L.sqrt2Pos.x, L.nlY, 7, COL.purple);
        drawText("√2", L.sqrt2Pos.x, L.nlY + 42, 24, COL.purple, "center");

        // Checkmarks that appear sequentially
        const checkItems = [
            "✅ 真實的對角線長度",
            "✅ 圓規可精確作圖",
            "✅ 數線上的確切位置",
        ];

        const itemStartY = H * 0.15;
        checkItems.forEach((item, i) => {
            const itemT = clamp01((t - 0.1 - i * 0.2) * 3);
            if (itemT > 0) {
                ctx.globalAlpha = ease(itemT);
                drawText(item, W * 0.5, itemStartY + i * 40, 20, COL.green, "center", "middle", "normal");
                ctx.globalAlpha = 1;
            }
        });
    }

    /* ----- Phase 5: Summary ----- */
    function drawPhase5(L, t) {
        drawNumberLine(L, 1);

        // Bright √2 marker
        const grd = ctx.createRadialGradient(L.sqrt2Pos.x, L.nlY, 0, L.sqrt2Pos.x, L.nlY, 40);
        grd.addColorStop(0, "rgba(167,139,250,0.7)");
        grd.addColorStop(0.6, "rgba(167,139,250,0.15)");
        grd.addColorStop(1, "rgba(167,139,250,0)");
        ctx.fillStyle = grd;
        ctx.fillRect(L.sqrt2Pos.x - 40, L.nlY - 40, 80, 80);

        drawLine(L.sqrt2Pos.x, L.nlY - 18, L.sqrt2Pos.x, L.nlY + 18, COL.purple, 3.5);
        drawCircle(L.sqrt2Pos.x, L.nlY, 8, COL.purple);
        drawText("√2", L.sqrt2Pos.x, L.nlY + 46, 26, COL.purple, "center");

        // Additional number line labels
        ctx.globalAlpha = 0.5;
        drawText("1.414213562…", L.sqrt2Pos.x, L.nlY - 42, 15, COL.amber, "center", "middle", "normal");
        ctx.globalAlpha = 1;

        // Celebratory particles
        const seed = Date.now() / 1000;
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + seed * 0.5;
            const dist = 55 + 15 * Math.sin(seed * 2 + i);
            const px = L.sqrt2Pos.x + Math.cos(angle) * dist;
            const py = L.nlY + Math.sin(angle) * dist;
            const size = 2 + Math.sin(seed * 3 + i * 0.7);
            ctx.globalAlpha = 0.3 + 0.2 * Math.sin(seed + i);
            drawCircle(px, py, size, COL.purple);
        }

        ctx.globalAlpha = 1;

        // Draw faded square construction
        const sqBottom = L.nlY;
        const sqTop = L.nlY - L.unit;
        const sqLeft = L.o.x;

        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = COL.squareStroke;
        ctx.lineWidth = 1;
        ctx.strokeRect(sqLeft, sqTop, L.unit, L.unit);
        drawLine(sqLeft, sqBottom, sqLeft + L.unit, sqTop, COL.diag, 1.5);
        ctx.globalAlpha = 1;

        // Arc trace (faded)
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(L.o.x, L.nlY, L.unit * Math.SQRT2, -Math.PI / 4, 0, false);
        ctx.strokeStyle = COL.arcStroke;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // "∈ ℝ" badge
        const bx = W * 0.5;
        const by = H * 0.20;
        ctx.globalAlpha = 0.6 + 0.2 * Math.sin(seed * 1.5);
        drawText("√2 ∈ ℝ  — 無理數是真實的！", bx, by, 22, COL.white, "center", "middle", "bold");
        ctx.globalAlpha = 1;
    }

    /* ============================================================
       MAIN RENDER LOOP
       ============================================================ */
    function render() {
        ctx.clearRect(0, 0, W, H);

        const L = getLayout();

        // Map progress to phase
        const rawPhase = progress * NUM_PHASES;
        const phase = Math.min(NUM_PHASES - 1, Math.floor(rawPhase));
        const phaseT = rawPhase - phase;

        updatePhaseUI(phase);

        switch (phase) {
            case 0: drawPhase0(L, phaseT); break;
            case 1: drawPhase1(L, phaseT); break;
            case 2: drawPhase2(L, phaseT); break;
            case 3: drawPhase3(L, phaseT); break;
            case 4: drawPhase4(L, phaseT); break;
            case 5: drawPhase5(L, phaseT); break;
        }

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
})();
