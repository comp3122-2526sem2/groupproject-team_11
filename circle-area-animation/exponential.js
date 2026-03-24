/**
 * 指數增長 vs 線性增長 — 棋盤放米粒可視化
 * Narrative-driven: each square tells a story with real-world comparisons.
 */
(function () {
    'use strict';

    // ==========================================
    // NARRATIVE DATA — real-world comparisons at every stage
    // ==========================================
    const NARRATIVES = {
        1:  { emoji: '🌾', text: '1 粒米 — 幾乎看不見' },
        2:  { emoji: '🌾', text: '2 粒米 — 還是很少' },
        3:  { emoji: '🌾', text: '4 粒 — 線性那邊只有 3 粒' },
        4:  { emoji: '🌾', text: '8 粒 — 可以數得出來' },
        5:  { emoji: '🌾', text: '16 粒 — 大約一小撮' },
        8:  { emoji: '🍚', text: '128 粒 — 大約一湯匙的米' },
        10: { emoji: '🥄', text: '512 粒 ≈ 兩大湯匙', milestone: true },
        16: { emoji: '🍚', text: '32,768 粒 ≈ 不到 1 公斤', milestone: true },
        20: { emoji: '🎒', text: '524,288 粒 ≈ <strong>13 公斤</strong> — 夠一個人吃半個月！', milestone: true },
        25: { emoji: '🚗', text: '≈ 420 公斤，需要一輛車來裝了', milestone: true },
        30: { emoji: '🚛', text: '5.4 億粒 ≈ <strong>13 公噸</strong>，要用一輛貨車！', milestone: true },
        35: { emoji: '🚢', text: '≈ 440 公噸 — 需要好幾節火車車廂', milestone: true },
        40: { emoji: '🏭', text: '≈ <strong>14,000 公噸</strong>，可以填滿一艘巨型貨輪！', milestone: true },
        45: { emoji: '🌏', text: '≈ 45 萬公噸 — 接近香港一年的食米進口量', milestone: true },
        50: { emoji: '🪐', text: '≈ <strong>1,400 萬公噸</strong> — 全球年產量的 2.8%！', milestone: true },
        55: { emoji: '🌌', text: '≈ 4.6 億公噸 — 接近全球稻米年產量', milestone: true },
        60: { emoji: '💥', text: '≈ <strong>150 億公噸</strong> — 全球 30 年稻米總產量', milestone: true },
        64: { emoji: '🤯', text: '2⁶³ ≈ 9.2 × 10¹⁸ 粒 ≈ <strong>全世界 2000 年的稻米產量</strong>！', milestone: true },
    };

    // ==========================================
    // STATE
    // ==========================================
    const state = {
        currentSquare: 0,
        isPlaying: false,
        playTimer: null,
        speed: 5,
        axisType: 'log',
    };

    // ==========================================
    // DOM
    // ==========================================
    const $ = id => document.getElementById(id);
    const dom = {
        chessboard: $('chessboard'),
        narrativeDisplay: $('narrativeDisplay'),
        narrSquare: $('narrSquare'),
        narrGrains: $('narrGrains'),
        narrComparison: $('narrComparison'),
        btnPlay: $('btnPlay'),
        btnStep: $('btnStep'),
        btnReset: $('btnReset'),
        speedSlider: $('speedSlider'),
        speedLabel: $('speedLabel'),
        statInline: $('statInline'),
        expVal: $('expVal'),
        linVal: $('linVal'),
        ratioVal: $('ratioVal'),
        btnLog: $('btnLog'),
        btnLinear: $('btnLinear'),
    };

    // ==========================================
    // MATH
    // ==========================================
    function grainsBigInt(n) {
        if (n <= 0) return 0n;
        return 1n << BigInt(n - 1);
    }

    function formatBigInt(val) {
        const str = val.toString();
        if (str.length <= 12) return Number(val).toLocaleString();
        const exp = str.length - 1;
        const mantissa = str[0] + '.' + str.slice(1, 4);
        return `${mantissa} × 10^${exp}`;
    }

    function grainsNumber(n) {
        if (n <= 0) return 0;
        return Math.pow(2, n - 1);
    }

    // ==========================================
    // CHESSBOARD
    // ==========================================
    function buildChessboard() {
        dom.chessboard.innerHTML = '';
        for (let i = 1; i <= 64; i++) {
            const row = Math.ceil(i / 8);
            const col = ((i - 1) % 8) + 1;
            const isLight = (row + col) % 2 === 0;

            const cell = document.createElement('div');
            cell.className = `cell ${isLight ? 'light' : 'dark'}`;
            cell.dataset.square = i;

            const fill = document.createElement('div');
            fill.className = 'cell-fill';
            cell.appendChild(fill);

            const numEl = document.createElement('div');
            numEl.className = 'cell-number';
            numEl.textContent = i;
            cell.appendChild(numEl);

            cell.addEventListener('click', () => goToSquare(i));
            dom.chessboard.appendChild(cell);
        }
    }

    function getCellColor(n) {
        const t = (n - 1) / 63;
        return `rgba(255, ${Math.round(200 - 160 * t)}, ${Math.round(50 - 50 * t)}, ${0.15 + 0.7 * t})`;
    }

    function updateCellVisuals(n) {
        const cells = dom.chessboard.children;
        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            const sq = parseInt(cell.dataset.square);
            const fill = cell.querySelector('.cell-fill');

            if (sq <= n) {
                cell.classList.add('visited');
                fill.style.background = getCellColor(sq);
                fill.style.opacity = '1';
                cell.classList.toggle('active', sq === n);
            } else {
                cell.classList.remove('visited', 'active');
                fill.style.opacity = '0';
            }
        }
    }

    // ==========================================
    // CHART
    // ==========================================
    let chart = null;

    function initChart() {
        const ctx = $('growthChart').getContext('2d');
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: '指數增長 (2ⁿ⁻¹)',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245,158,11,0.08)',
                        borderWidth: 2.5,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        tension: 0.3,
                        fill: true,
                        order: 1,
                    },
                    {
                        label: '線性增長 (n)',
                        data: [],
                        borderColor: '#6b7280',
                        backgroundColor: 'rgba(107,114,128,0.06)',
                        borderWidth: 2.5,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        tension: 0,
                        fill: true,
                        order: 2,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: {
                            color: '#a0a0a0',
                            font: { size: 11, family: "'Noto Sans TC', sans-serif" },
                            padding: 12,
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        titleColor: '#fff',
                        bodyColor: '#d0d0d0',
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            title: items => `第 ${items[0].parsed.x} 格`,
                            label: ctx => {
                                if (ctx.datasetIndex === 0) {
                                    return `指數：${formatBigInt(grainsBigInt(ctx.parsed.x))} 粒`;
                                }
                                return `線性：${ctx.parsed.y} 粒`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: '格子編號', color: '#707070', font: { size: 11 }, padding: { top: 6 } },
                        min: 1, max: 64,
                        ticks: { color: '#606060', stepSize: 8, font: { size: 10 }, padding: 4 },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    y: {
                        type: 'logarithmic',
                        title: { display: true, text: '米粒數量', color: '#707070', font: { size: 11 }, padding: { bottom: 6 } },
                        min: 1,
                        ticks: {
                            color: '#606060',
                            font: { size: 10 },
                            padding: 6,
                            callback: val => {
                                if (val >= 1e15) return (val / 1e15).toFixed(0) + '×10¹⁵';
                                if (val >= 1e12) return (val / 1e12).toFixed(0) + '兆';
                                if (val >= 1e8) return (val / 1e8).toFixed(0) + '億';
                                if (val >= 1e4) return (val / 1e4).toFixed(0) + '萬';
                                return val.toLocaleString();
                            }
                        },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    }
                },
                animation: { duration: 200 }
            }
        });
    }

    function updateChart(n) {
        const exp = [], lin = [];
        for (let i = 1; i <= n; i++) {
            exp.push({ x: i, y: grainsNumber(i) });
            lin.push({ x: i, y: i });
        }
        chart.data.datasets[0].data = exp;
        chart.data.datasets[1].data = lin;
        chart.update('none');
    }

    window.setAxisType = function (type) {
        state.axisType = type;
        dom.btnLog.classList.toggle('active', type === 'log');
        dom.btnLinear.classList.toggle('active', type === 'linear');
        chart.options.scales.y.type = type === 'log' ? 'logarithmic' : 'linear';
        chart.options.scales.y.min = type === 'log' ? 1 : 0;
        chart.update();
    };

    // ==========================================
    // NARRATIVE — the core storytelling element
    // ==========================================
    function getNarrative(n) {
        // Check if there's a specific narrative for this square
        if (NARRATIVES[n]) return NARRATIVES[n];

        // Generate a generic one based on the range
        const grains = grainsBigInt(n);
        if (n <= 10) return { emoji: '🌾', text: `${formatBigInt(grains)} 粒米` };
        if (n <= 20) return { emoji: '🍚', text: `${formatBigInt(grains)} 粒 — 已經是線性的 ${formatBigInt(grains / BigInt(n))} 倍` };
        if (n <= 30) return { emoji: '📦', text: `${formatBigInt(grains)} 粒 — 指數是線性的 ${formatBigInt(grains / BigInt(n))} 倍！` };
        if (n <= 40) return { emoji: '🚛', text: `${formatBigInt(grains)} 粒 — 差距已經<strong>天文數字</strong>！` };
        if (n <= 50) return { emoji: '🌍', text: `${formatBigInt(grains)} 粒 — 線性那邊只有 ${n} 粒⋯⋯` };
        return { emoji: '🌌', text: `${formatBigInt(grains)} 粒 — 已經超越想像的極限` };
    }

    function updateNarrative(n) {
        const narr = getNarrative(n);
        const grains = grainsBigInt(n);

        dom.narrSquare.textContent = `第 ${n} / 64 格`;
        dom.narrGrains.innerHTML = `${narr.emoji} ${formatBigInt(grains)} 粒`;
        dom.narrComparison.innerHTML = narr.text;

        // Milestone glow effect
        if (narr.milestone) {
            dom.narrativeDisplay.classList.add('milestone');
            setTimeout(() => dom.narrativeDisplay.classList.remove('milestone'), 600);
        } else {
            dom.narrativeDisplay.classList.remove('milestone');
        }

        // Show inline stats
        dom.statInline.style.display = 'flex';
        dom.expVal.textContent = formatBigInt(grains);
        dom.linVal.textContent = n;
        dom.ratioVal.textContent = formatBigInt(grains / BigInt(n)) + '×';
    }

    // ==========================================
    // NAVIGATION
    // ==========================================
    function goToSquare(n) {
        if (n < 1) n = 1;
        if (n > 64) n = 64;
        state.currentSquare = n;
        updateCellVisuals(n);
        updateChart(n);
        updateNarrative(n);
    }

    // ==========================================
    // PLAY / PAUSE / STEP / RESET
    // ==========================================
    function getInterval() {
        return Math.max(80, 1100 - state.speed * 110);
    }

    function startPlay() {
        if (state.currentSquare >= 64) goToSquare(0);
        state.isPlaying = true;
        dom.btnPlay.textContent = '⏸ 暫停';
        dom.btnStep.disabled = true;
        step();
    }

    function stopPlay() {
        state.isPlaying = false;
        dom.btnPlay.textContent = '▶ 播放';
        dom.btnStep.disabled = false;
        if (state.playTimer) { clearTimeout(state.playTimer); state.playTimer = null; }
    }

    function step() {
        const next = state.currentSquare + 1;
        if (next > 64) {
            stopPlay();
            dom.narrSquare.textContent = '🏁 全部 64 格完成！';
            dom.narrGrains.innerHTML = '🤯';
            dom.narrComparison.innerHTML = '國王根本付不起！一個看似簡單的「每格翻倍」要求，<strong>超越了全世界 2000 年的稻米生產量</strong>。這就是指數增長。';
            return;
        }
        goToSquare(next);
        if (state.isPlaying) {
            state.playTimer = setTimeout(step, getInterval());
        }
    }

    function reset() {
        stopPlay();
        state.currentSquare = 0;

        dom.narrSquare.textContent = '按「▶ 播放」開始棋盤放米粒';
        dom.narrGrains.innerHTML = '♟️';
        dom.narrComparison.innerHTML = '每一格的米粒數量翻倍，你覺得 64 格加起來有多少？';
        dom.narrativeDisplay.classList.remove('milestone');
        dom.statInline.style.display = 'none';

        const cells = dom.chessboard.children;
        for (let i = 0; i < cells.length; i++) {
            const c = cells[i];
            c.classList.remove('visited', 'active');
            c.querySelector('.cell-fill').style.opacity = '0';
        }

        chart.data.datasets[0].data = [];
        chart.data.datasets[1].data = [];
        chart.update('none');
    }

    // ==========================================
    // EVENTS
    // ==========================================
    dom.btnPlay.addEventListener('click', () => state.isPlaying ? stopPlay() : startPlay());
    dom.btnStep.addEventListener('click', () => {
        if (!state.isPlaying) {
            const next = (state.currentSquare || 0) + 1;
            if (next <= 64) goToSquare(next);
        }
    });
    dom.btnReset.addEventListener('click', reset);
    dom.speedSlider.addEventListener('input', e => {
        state.speed = parseInt(e.target.value);
        dom.speedLabel.textContent = `${state.speed}x`;
    });

    // ==========================================
    // INIT
    // ==========================================
    buildChessboard();
    initChart();
})();
