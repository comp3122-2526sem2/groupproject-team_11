/**
 * Probability & Law of Large Numbers — Interactive Visualization
 * 概率與大數法則互動式可視化
 */

(function () {
    'use strict';

    // ─── State ───────────────────────────────────────
    let totalFlips = 0;
    let headsCount = 0;
    let isAutoFlipping = false;
    let autoFlipTimer = null;

    // Chart data — we sample points to avoid overloading the chart
    const chartLabels = [];   // X-axis: flip number
    const chartData = [];     // Y-axis: heads ratio at that point
    const MAX_CHART_POINTS = 500; // Maximum data points on chart

    // ─── DOM refs ────────────────────────────────────
    const coin = document.getElementById('coin');
    const lastResult = document.getElementById('lastResult');
    const totalCountEl = document.getElementById('totalCount');
    const headsCountEl = document.getElementById('headsCount');
    const tailsCountEl = document.getElementById('tailsCount');
    const headsRatioEl = document.getElementById('headsRatio');
    const btnFlipOne = document.getElementById('btnFlipOne');
    const btnFlip100 = document.getElementById('btnFlip100');
    const btnFlip1000 = document.getElementById('btnFlip1000');
    const btnReset = document.getElementById('btnReset');
    const speedDot = document.getElementById('speedDot');
    const speedText = document.getElementById('speedText');

    // ─── Chart setup ─────────────────────────────────
    const ctx = document.getElementById('ratioChart').getContext('2d');

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [
                {
                    label: '正面比例',
                    data: chartData,
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: true,
                    tension: 0.15,
                },
                {
                    label: '理論機率 0.5',
                    data: [],            // filled dynamically
                    borderColor: 'rgba(239, 68, 68, 0.6)',
                    borderWidth: 2,
                    borderDash: [8, 4],
                    pointRadius: 0,
                    fill: false,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 200 },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '擲幣次數',
                        color: '#6B7280',
                        font: { size: 12, weight: '700', family: "'Inter', 'Noto Sans TC', sans-serif" },
                        padding: { top: 10 },
                    },
                    ticks: {
                        color: '#9CA3AF',
                        maxTicksLimit: 10,
                        font: { size: 11 },
                        padding: 6,
                    },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                },
                y: {
                    min: 0,
                    max: 1,
                    title: {
                        display: true,
                        text: '正面比例',
                        color: '#6B7280',
                        font: { size: 12, weight: '700', family: "'Inter', 'Noto Sans TC', sans-serif" },
                        padding: { bottom: 10 },
                    },
                    ticks: {
                        color: '#9CA3AF',
                        stepSize: 0.1,
                        font: { size: 11 },
                        padding: 6,
                        callback: (v) => v.toFixed(1),
                    },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                },
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#6B7280',
                        font: { size: 12, family: "'Inter', 'Noto Sans TC', sans-serif" },
                        padding: 20,
                        usePointStyle: true,
                        pointStyleWidth: 16,
                    },
                    position: 'bottom',
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.92)',
                    titleColor: '#F9FAFB',
                    bodyColor: '#D1D5DB',
                    padding: 12,
                    cornerRadius: 10,
                    titleFont: { size: 13, weight: '700', family: "'Inter', sans-serif" },
                    bodyFont: { size: 12, family: "'Inter', sans-serif" },
                    callbacks: {
                        label: function (context) {
                            if (context.datasetIndex === 0) {
                                return `正面比例: ${context.parsed.y.toFixed(4)}`;
                            }
                            return `理論值: 0.5`;
                        },
                    },
                },
            },
        },
    });

    // ─── Core flip logic ─────────────────────────────
    function flipCoin() {
        const isHeads = Math.random() < 0.5;
        totalFlips++;
        if (isHeads) headsCount++;
        return isHeads;
    }

    function shouldRecordPoint(n) {
        // Record every flip for the first 50
        if (n <= 50) return true;
        // Then every 5 up to 200
        if (n <= 200) return n % 5 === 0;
        // Then every 10 up to 500
        if (n <= 500) return n % 10 === 0;
        // Then every 50 up to 2000
        if (n <= 2000) return n % 50 === 0;
        // Then every 100 up to 10000
        if (n <= 10000) return n % 100 === 0;
        // Then every 500
        return n % 500 === 0;
    }

    function addChartPoint() {
        const ratio = headsCount / totalFlips;
        chartLabels.push(totalFlips);
        chartData.push(ratio);
        // Keep the 0.5 reference line in sync
        chart.data.datasets[1].data.push(0.5);
    }

    function updateStats(isHeads) {
        totalCountEl.textContent = totalFlips.toLocaleString();
        headsCountEl.textContent = headsCount.toLocaleString();
        tailsCountEl.textContent = (totalFlips - headsCount).toLocaleString();
        const ratio = totalFlips > 0 ? (headsCount / totalFlips) : 0;
        headsRatioEl.textContent = totalFlips > 0 ? ratio.toFixed(4) : '—';

        if (isHeads !== undefined) {
            lastResult.textContent = isHeads ? '正面！' : '反面！';
            lastResult.className = 'last-result ' + (isHeads ? 'heads' : 'tails');
        }
    }

    function updateChart() {
        chart.update('none'); // instant update, no animation lag
    }

    // ─── Coin animation ──────────────────────────────
    function animateCoin(isHeads, callback) {
        coin.classList.remove('flipping');
        // Force reflow to restart animation
        void coin.offsetWidth;
        coin.classList.add('flipping');

        // Show correct face at end
        setTimeout(() => {
            coin.style.transform = isHeads ? 'rotateY(0deg)' : 'rotateY(180deg)';
        }, 550);

        setTimeout(() => {
            coin.classList.remove('flipping');
            if (callback) callback();
        }, 620);
    }

    // ─── Single flip ─────────────────────────────────
    function doSingleFlip() {
        if (isAutoFlipping) return;
        setButtonsEnabled(false);

        const isHeads = flipCoin();
        animateCoin(isHeads, () => {
            if (shouldRecordPoint(totalFlips)) {
                addChartPoint();
                updateChart();
            }
            updateStats(isHeads);
            setButtonsEnabled(true);
        });
    }

    // ─── Batch flip (animated step-by-step) ──────────
    function doBatchFlip(count) {
        if (isAutoFlipping) return;
        isAutoFlipping = true;
        setButtonsEnabled(false);
        setSpeedIndicator(true, `擲幣中... 0/${count.toLocaleString()}`);

        let done = 0;
        const batchSize = Math.max(1, Math.floor(count / 100)); // ~100 visual updates
        const interval = 16; // ~60fps

        function step() {
            const thisBatch = Math.min(batchSize, count - done);
            let lastIsHeads = false;

            for (let i = 0; i < thisBatch; i++) {
                lastIsHeads = flipCoin();
                done++;
                if (shouldRecordPoint(totalFlips)) {
                    addChartPoint();
                }
            }

            updateStats(lastIsHeads);
            updateChart();
            setSpeedIndicator(true, `擲幣中... ${done.toLocaleString()}/${count.toLocaleString()}`);

            // Update coin face to the last result
            coin.style.transform = lastIsHeads ? 'rotateY(0deg)' : 'rotateY(180deg)';

            if (done < count) {
                autoFlipTimer = setTimeout(step, interval);
            } else {
                isAutoFlipping = false;
                setButtonsEnabled(true);
                setSpeedIndicator(false, '完成！');
                setTimeout(() => setSpeedIndicator(false, '就緒'), 2000);
            }
        }

        step();
    }

    // ─── Reset ───────────────────────────────────────
    function doReset() {
        if (autoFlipTimer) {
            clearTimeout(autoFlipTimer);
            autoFlipTimer = null;
        }
        isAutoFlipping = false;

        totalFlips = 0;
        headsCount = 0;
        chartLabels.length = 0;
        chartData.length = 0;
        chart.data.datasets[1].data.length = 0;

        updateChart();
        totalCountEl.textContent = '0';
        headsCountEl.textContent = '0';
        tailsCountEl.textContent = '0';
        headsRatioEl.textContent = '—';
        lastResult.textContent = '等待擲幣...';
        lastResult.className = 'last-result waiting';
        coin.style.transform = 'rotateY(0deg)';
        coin.classList.remove('flipping');

        setButtonsEnabled(true);
        setSpeedIndicator(false, '就緒');
    }

    // ─── Helpers ─────────────────────────────────────
    function setButtonsEnabled(enabled) {
        btnFlipOne.disabled = !enabled;
        btnFlip100.disabled = !enabled;
        btnFlip1000.disabled = !enabled;
        btnReset.disabled = false; // Reset is always available
    }

    function setSpeedIndicator(active, text) {
        speedDot.className = 'speed-dot' + (active ? '' : ' idle');
        speedText.textContent = text;
    }

    // ─── Event listeners ─────────────────────────────
    btnFlipOne.addEventListener('click', doSingleFlip);
    btnFlip100.addEventListener('click', () => doBatchFlip(100));
    btnFlip1000.addEventListener('click', () => doBatchFlip(1000));
    btnReset.addEventListener('click', doReset);

})();
