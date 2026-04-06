/* ============================================================
   AI LEARNING PLANNER — JavaScript
   Wizard State Machine + Streaming + Dashboard Render
   ============================================================ */

class LearningPlanGenerator {
    constructor() {
        this.storageKey = 'mathExploration.learningPlan.latest';

        // State
        this.currentStep = 1;
        this.totalSteps = 3;
        this.formData = {};
        this.assessmentData = null;
        this.learningPlan = null;

        this._initElements();
        this._attachEvents();
        this._checkSavedPlan();
    }

    /* ──────────────────────────────────────────────────────
       DOM References
       ────────────────────────────────────────────────────── */
    _initElements() {
        // Wizard
        this.wizardSection    = document.getElementById('wizard-section');
        this.steps            = [1, 2, 3].map(n => document.getElementById(`step-${n}`));
        this.stepIndicators   = [1, 2, 3].map(n => document.getElementById(`step-indicator-${n}`));
        this.progressFill     = document.getElementById('progress-fill');

        // Nav buttons
        this.btnNext1   = document.getElementById('btn-next-1');
        this.btnBack2   = document.getElementById('btn-back-2');
        this.btnNext2   = document.getElementById('btn-next-2');
        this.btnBack3   = document.getElementById('btn-back-3');
        this.btnSubmit  = document.getElementById('btn-submit');

        // Topbar
        this.btnViewSaved = document.getElementById('btn-view-saved');

        // Streaming
        this.streamingOverlay = document.getElementById('streaming-overlay');
        this.streamingText    = document.getElementById('streaming-text');
        this.streamingSteps   = [1, 2, 3, 4].map(n => document.getElementById(`sstep-${n}`));

        // Dashboard
        this.dashboardSection = document.getElementById('dashboard-section');
        this.summaryStats     = document.getElementById('summary-stats');
        this.overallAssessment = document.getElementById('overall-assessment');
        this.strengthsSection  = document.getElementById('strengths-section');
        this.weaknessesSection = document.getElementById('weaknesses-section');
        this.strategySection   = document.getElementById('strategy-section');
        this.tipsCard          = document.getElementById('tips-card');
        this.tipsContent       = document.getElementById('tips-content');
        this.modulesList       = document.getElementById('modules-list');
        this.modulesCount      = document.getElementById('modules-count');
        this.btnStartLearning  = document.getElementById('btn-start-learning');
        this.btnDownloadPlan   = document.getElementById('btn-download-plan');
        this.btnRestartPlan    = document.getElementById('btn-restart-plan');
    }

    /* ──────────────────────────────────────────────────────
       Event Listeners
       ────────────────────────────────────────────────────── */
    _attachEvents() {
        this.btnNext1.addEventListener('click',   () => this._goToStep(2));
        this.btnBack2.addEventListener('click',   () => this._goToStep(1));
        this.btnNext2.addEventListener('click',   () => this._goToStep(3));
        this.btnBack3.addEventListener('click',   () => this._goToStep(2));
        this.btnSubmit.addEventListener('click',  () => this._handleSubmit());
        this.btnViewSaved.addEventListener('click', () => this._viewSavedPlan());
        this.btnRestartPlan.addEventListener('click', () => this._restart());
        this.btnStartLearning.addEventListener('click', () => this._startFirstModule());
        this.btnDownloadPlan.addEventListener('click', () => this._downloadPlan());

        // Live-clear inline errors on input change
        document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
            input.addEventListener('change', () => {
                const errorId = `error-${input.name}`;
                const errorEl = document.getElementById(errorId);
                if (errorEl) this._clearError(errorEl, input.closest('.question-card'));
            });
        });
    }

    /* ──────────────────────────────────────────────────────
       Wizard Navigation
       ────────────────────────────────────────────────────── */
    _goToStep(targetStep) {
        // Validate current step before advancing
        if (targetStep > this.currentStep) {
            if (!this._validateStep(this.currentStep)) return;
        }

        // Hide current step
        this.steps[this.currentStep - 1].classList.remove('active-step');

        // Update indicators
        this.stepIndicators[this.currentStep - 1].classList.remove('active');
        if (targetStep > this.currentStep) {
            this.stepIndicators[this.currentStep - 1].classList.add('completed');
        } else {
            this.stepIndicators[this.currentStep - 1].classList.remove('completed');
        }

        this.currentStep = targetStep;

        // Show new step
        this.steps[this.currentStep - 1].classList.add('active-step');
        this.stepIndicators[this.currentStep - 1].classList.add('active');
        this.stepIndicators[this.currentStep - 1].classList.remove('completed');

        // Update progress bar
        const pct = (this.currentStep / this.totalSteps) * 100;
        this.progressFill.style.width = `${pct}%`;

        // Scroll to wizard
        this.wizardSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ──────────────────────────────────────────────────────
       Validation — Per-Step
       ────────────────────────────────────────────────────── */
    _validateStep(step) {
        let valid = true;

        if (step === 1) {
            if (!this._getRadio('level')) {
                this._showError('error-level', 'qcard-level', '請選擇你的 DSE 目標成績。');
                valid = false;
            }
            if (!this._getRadio('module')) {
                this._showError('error-module', 'qcard-module', '請選擇你的修讀課程。');
                valid = false;
            }
        }

        if (step === 2) {
            if (!this._getRadio('q3')) {
                this._showError('error-q3', 'qcard-q3', '請選擇一個答案。');
                valid = false;
            }
            if (!this._getRadio('q4')) {
                this._showError('error-q4', 'qcard-q4', '請選擇一個答案。');
                valid = false;
            }
            if (!this._getRadio('q5')) {
                this._showError('error-q5', 'qcard-q5', '請選擇一個答案。');
                valid = false;
            }
        }

        if (step === 3) {
            if (!this._getRadio('time')) {
                this._showError('error-time', 'qcard-time', '請選擇每週溫習時間。');
                valid = false;
            }
            if (!this._getRadio('style')) {
                this._showError('error-style', 'qcard-style', '請選擇你的學習風格。');
                valid = false;
            }
        }

        return valid;
    }

    _showError(errorId, cardId, message) {
        const el = document.getElementById(errorId);
        const card = document.getElementById(cardId);
        if (el) {
            el.textContent = message;
            el.style.display = 'flex';
        }
        if (card) {
            card.classList.add('has-error');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    _clearError(errorEl, cardEl) {
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
        if (cardEl) {
            cardEl.classList.remove('has-error');
        }
    }

    _getRadio(name) {
        const checked = document.querySelector(`input[name="${name}"]:checked`);
        return checked ? checked.value : null;
    }

    _getCheckboxes(name) {
        return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(el => el.value);
    }

    /* ──────────────────────────────────────────────────────
       Submit Handler
       ────────────────────────────────────────────────────── */
    async _handleSubmit() {
        if (!this._validateStep(3)) return;

        // Collect all form data
        this.assessmentData = {
            level:     this._getRadio('level'),
            module:    this._getRadio('module'),
            interests: this._getCheckboxes('interests'),
            q3:        this._getRadio('q3'),
            q4:        this._getRadio('q4'),
            q5:        this._getRadio('q5'),
            time:      this._getRadio('time'),
            style:     this._getRadio('style'),
            score:     this._calcScore()
        };

        this.btnSubmit.disabled = true;
        this._showStreaming();

        try {
            await this._generatePlan();
        } catch (err) {
            console.error('Plan generation error:', err);
            this._hideStreaming();
            this.btnSubmit.disabled = false;
            // Show inline error in Q3 card as fallback
            alert('AI 服務暫時無法連接，請稍後再試。');
        }
    }

    _calcScore() {
        let correct = 0;
        if (this._getRadio('q3') === 'correct') correct++;
        if (this._getRadio('q4') === 'correct') correct++;
        if (this._getRadio('q5') === 'correct') correct++;
        return Math.round((correct / 3) * 100);
    }

    /* ──────────────────────────────────────────────────────
       Streaming Loader UI
       ────────────────────────────────────────────────────── */
    _showStreaming() {
        this.wizardSection.style.display = 'none';
        this.dashboardSection.style.display = 'none';
        this.streamingOverlay.style.display = 'flex';

        // Animate streaming text messages
        const messages = [
            '正在解析你的 DSE 目標與診斷結果…',
            '比對 DSE 歷屆卷題型與考試重點…',
            '根據每週時間制定最優學習節奏…',
            '生成個人化模塊推薦順序…',
            '整理 DSE 應試策略與貼士…'
        ];
        let msgIdx = 0;
        this._streamTypingEffect(messages[msgIdx]);
        this._streamMsgInterval = setInterval(() => {
            msgIdx = (msgIdx + 1) % messages.length;
            this.streamingText.textContent = '';
            this._streamTypingEffect(messages[msgIdx]);
        }, 3200);

        // Animate step indicators
        this._streamStepIdx = 0;
        this._advanceStreamStep();
        this._streamStepInterval = setInterval(() => this._advanceStreamStep(), 2800);
    }

    _streamTypingEffect(text) {
        let i = 0;
        this.streamingText.textContent = '';
        clearInterval(this._typingInterval);
        this._typingInterval = setInterval(() => {
            if (i < text.length) {
                this.streamingText.textContent += text[i++];
            } else {
                clearInterval(this._typingInterval);
            }
        }, 28);
    }

    _advanceStreamStep() {
        this.streamingSteps.forEach(s => s.classList.remove('active', 'done'));
        for (let i = 0; i < this._streamStepIdx; i++) {
            this.streamingSteps[i] && this.streamingSteps[i].classList.add('done');
        }
        if (this.streamingSteps[this._streamStepIdx]) {
            this.streamingSteps[this._streamStepIdx].classList.add('active');
        }
        this._streamStepIdx = Math.min(this._streamStepIdx + 1, this.streamingSteps.length);
    }

    _hideStreaming() {
        clearInterval(this._streamMsgInterval);
        clearInterval(this._streamStepInterval);
        clearInterval(this._typingInterval);
        this.streamingOverlay.style.display = 'none';
    }

    /* ──────────────────────────────────────────────────────
       AI Plan Generation
       ────────────────────────────────────────────────────── */
    async _generatePlan() {
        const prompt = this._buildPrompt();

        const response = await fetch('/api/hf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const planJson = this._extractJson(String(data.generated_text || ''));

        if (!planJson || !Array.isArray(planJson.recommendedModules)) {
            throw new Error('Invalid AI response format');
        }

        this.learningPlan = planJson;
        this._saveToStorage();
        this._hideStreaming();
        this._renderDashboard();
    }

    _buildPrompt() {
        const levelLabels = {
            level2:  'Level 2（達標）',
            level34: 'Level 3–4（中等）',
            level5:  'Level 5–5**（拔尖）'
        };
        const moduleLabels = {
            core_only: '只修讀核心課程',
            m1: '核心 + M1（微積分與統計）',
            m2: '核心 + M2（代數與微積分）'
        };
        const timeLabels = {
            low:    '每週 1–3 小時',
            medium: '每週 3–7 小時',
            high:   '每週 7 小時以上'
        };

        const { level, module, interests, q3, q4, q5, score, time, style } = this.assessmentData;

        let strategyHint = '';
        if (level === 'level2')  strategyHint = 'Focus on all Section A(1) marks — must-score basics.';
        if (level === 'level34') strategyHint = 'Balance A(1) consolidation with easier A(2) questions.';
        if (level === 'level5')  strategyHint = 'Target Section B long questions; efficiency and accuracy under time pressure.';

        let moduleHint = '';
        if (module === 'm1') moduleHint = 'Student also takes M1; connect probability and calculus topics.';
        if (module === 'm2') moduleHint = 'Student also takes M2; encourage algebraic rigour and exponential functions.';

        return `You are an expert Hong Kong DSE Mathematics tutor with 10 years of experience.

Student Assessment Profile:
- DSE Target Grade: ${levelLabels[level] || level}
- Module: ${moduleLabels[module] || module}
- Topic interests: ${interests.join(', ') || 'none specified'}
- Diagnostic score (Section A basics): ${score}%
  - Circle area (Mensuration): ${q3 === 'correct' ? '✓ Correct' : '✗ Needs reinforcement'}
  - Pythagorean theorem (Geometry): ${q4 === 'correct' ? '✓ Correct' : '✗ Needs reinforcement'}
  - Square root of 2 (Surds): ${q5 === 'correct' ? '✓ Correct' : '✗ Needs reinforcement'}
- Weekly study time: ${timeLabels[time] || time}
- Preferred learning style: ${style}

DSE Strategy Context: ${strategyHint} ${moduleHint}

Available modules:
- circle_area → Circle Area (DSE: Mensuration, Section A)
- cylinder_volume → Cylinder Surface Area (DSE: 3D Mensuration, Section A–B)
- pythagoras → Pythagorean Theorem (DSE: Geometry, foundational)
- probability → Law of Large Numbers (DSE: Probability, Section A)
- sqrt2 → Irrational Number √2 (DSE: Surds, Section A(1)/(2))
- exponential → Exponential Growth (DSE: Functions & Graphs, Section A(2)/B)

Return ONLY valid JSON (no markdown, no extra text):
{
  "overallAssessment": "string",
  "strengths": ["string"],
  "areasForImprovement": ["string"],
  "recommendedModules": [
    {
      "module": "circle_area|cylinder_volume|pythagoras|probability|sqrt2|exponential",
      "title": "string",
      "icon": "string",
      "reason": "string",
      "difficulty": "beginner|intermediate|advanced",
      "estimatedTime": "string"
    }
  ],
  "learningStrategy": "string",
  "dseExamTips": "string",
  "motivationalMessage": "string"
}

Choose 3–5 modules. Tailor the plan to this student's exact DSE target and weekly time.`;
    }

    _extractJson(text) {
        if (!text || typeof text !== 'string') return null;

        // Try fenced block first
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (fenced?.[1]) {
            try { return JSON.parse(fenced[1]); } catch (_) {}
        }

        // Try raw JSON object
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end > start) {
            try { return JSON.parse(text.slice(start, end + 1)); } catch (_) {}
        }

        return null;
    }

    /* ──────────────────────────────────────────────────────
       Dashboard Render
       ────────────────────────────────────────────────────── */
    _renderDashboard() {
        const plan = this.learningPlan;
        const data = this.assessmentData;

        const levelLabels = {
            level2:  'Level 2（達標）',
            level34: 'Level 3–4（中等）',
            level5:  'Level 5–5**（拔尖）'
        };
        const moduleLabels = {
            core_only: '核心課程',
            m1: '核心 + M1',
            m2: '核心 + M2'
        };
        const timeLabels = {
            low:    '每週 1–3 小時',
            medium: '每週 3–7 小時',
            high:   '每週 7 小時以上'
        };

        // ── Summary Stats ──
        const scoreBadgeClass = data.score === 100 ? 'score-perfect' : data.score >= 67 ? 'score-good' : 'score-needs-work';
        this.summaryStats.innerHTML = `
            <div class="stat-row">
                <span class="stat-label">診斷測試得分</span>
                <span class="score-pill ${scoreBadgeClass}">${data.score}% (${data.score === 100 ? '滿分！' : data.score >= 67 ? '良好' : '需加強'})</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">DSE 目標成績</span>
                <span class="stat-value">${this._esc(levelLabels[data.level] || data.level)}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">修讀課程</span>
                <span class="stat-value">${this._esc(moduleLabels[data.module] || data.module)}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">每週溫習時間</span>
                <span class="stat-value">${this._esc(timeLabels[data.time] || data.time)}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">推薦模塊數量</span>
                <span class="stat-value">${plan.recommendedModules.length} 個模塊</span>
            </div>
        `;

        // ── Overall Assessment ──
        this.overallAssessment.textContent = plan.overallAssessment || '';

        // ── Strengths ──
        if (plan.strengths?.length) {
            this.strengthsSection.innerHTML = `
                <div class="sw-section">
                    <div class="sw-label">💪 強項</div>
                    <ul class="sw-list strength">
                        ${plan.strengths.map(s => `<li>${this._esc(s)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // ── Areas for Improvement ──
        if (plan.areasForImprovement?.length) {
            this.weaknessesSection.innerHTML = `
                <div class="sw-section">
                    <div class="sw-label">📈 有待加強</div>
                    <ul class="sw-list weakness">
                        ${plan.areasForImprovement.map(s => `<li>${this._esc(s)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // ── Learning Strategy ──
        if (plan.learningStrategy) {
            this.strategySection.innerHTML = `
                <div class="strategy-blurb">
                    📋 ${this._esc(plan.learningStrategy)}
                </div>
            `;
        }

        // ── Motivational Message ──
        if (plan.motivationalMessage) {
            const motEl = document.createElement('div');
            motEl.className = 'motivational-strip';
            motEl.textContent = `🌟 ${plan.motivationalMessage}`;
            this.strategySection.appendChild(motEl);
        }

        // ── DSE Tips (simulate streaming effect) ──
        if (plan.dseExamTips) {
            this.tipsCard.style.display = 'block';
            this._streamTipsContent(plan.dseExamTips);
        }

        // ── Modules List ──
        const moduleMap = {
            circle_area:    'circle.html',
            cylinder_volume:'cylinder.html',
            pythagoras:     'pythagoras.html',
            probability:    'probability.html',
            sqrt2:          'sqrt2.html',
            exponential:    'exponential.html'
        };
        const dseTopicLabel = {
            circle_area:    'DSE: 求積法',
            cylinder_volume:'DSE: 立體幾何',
            pythagoras:     'DSE: 幾何',
            probability:    'DSE: 概率',
            sqrt2:          'DSE: 無理數',
            exponential:    'DSE: 指數函數'
        };

        this.modulesCount.textContent = `共 ${plan.recommendedModules.length} 個模塊`;
        this.modulesList.innerHTML = plan.recommendedModules.map((mod, i) => `
            <div class="module-card" style="animation-delay: ${i * 0.08}s; animation: fadeInUp 0.4s var(--ease) both;">
                <div class="module-card-top">
                    <div class="module-card-icon">${mod.icon || '📘'}</div>
                    <div class="module-card-meta">
                        <div class="module-order-label">第 ${i + 1} 個模塊</div>
                        <div class="module-card-title">${this._esc(mod.title || 'Module')}</div>
                        <div class="module-tags-row">
                            <span class="module-tag tag-level">${this._difficultyLabel(mod.difficulty)}</span>
                            <span class="module-tag tag-dse">${this._esc(dseTopicLabel[mod.module] || '')}</span>
                        </div>
                    </div>
                </div>
                <p class="module-card-description">${this._esc(mod.reason || '')}</p>
                <div class="module-card-footer">
                    <span class="module-time">⏱️ ${this._esc(mod.estimatedTime || '–')}</span>
                    <a href="${moduleMap[mod.module] || 'index.html'}" class="btn-module-start" id="module-btn-${i}">
                        開始學習 →
                    </a>
                </div>
            </div>
        `).join('');

        // Show dashboard, hide wizard
        this.wizardSection.style.display = 'none';
        this.dashboardSection.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* Simulate streaming effect for tips text */
    _streamTipsContent(text) {
        this.tipsContent.innerHTML = '';
        const cursor = document.createElement('span');
        cursor.className = 'tips-cursor';
        this.tipsContent.appendChild(cursor);

        let i = 0;
        const interval = setInterval(() => {
            if (i < text.length) {
                this.tipsContent.insertBefore(document.createTextNode(text[i++]), cursor);
            } else {
                clearInterval(interval);
                cursor.remove();
            }
        }, 12);
    }

    /* ──────────────────────────────────────────────────────
       Helpers
       ────────────────────────────────────────────────────── */
    _difficultyLabel(d) {
        return { beginner: '🟢 基礎', intermediate: '🟡 中等', advanced: '🔴 進階' }[d] || d || 'beginner';
    }

    _esc(text) {
        const div = document.createElement('div');
        div.textContent = String(text || '');
        return div.innerHTML;
    }

    getLevelLabel(level) {
        return { level2: 'Level 2（達標）', level34: 'Level 3–4（中等）', level5: 'Level 5–5**（拔尖）' }[level] || level;
    }

    getModuleLabel(module) {
        return { core_only: '只修讀核心課程', m1: '核心 + M1（微積分與統計）', m2: '核心 + M2（代數與微積分）' }[module] || module;
    }

    getTimeLabel(time) {
        return { low: '每週 1–3 小時', medium: '每週 3–7 小時', high: '每週 7 小時以上' }[time] || time;
    }

    /* ──────────────────────────────────────────────────────
       localStorage
       ────────────────────────────────────────────────────── */
    _saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                savedAt: new Date().toISOString(),
                assessmentData: this.assessmentData,
                learningPlan: this.learningPlan
            }));
            this._checkSavedPlan();
        } catch (e) {
            console.warn('Save error:', e);
        }
    }

    _loadFromStorage() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed?.assessmentData || !parsed?.learningPlan) return null;
            return parsed;
        } catch (e) { return null; }
    }

    _checkSavedPlan() {
        const saved = this._loadFromStorage();
        if (saved) {
            this.btnViewSaved.style.display = 'inline-flex';
            const d = new Date(saved.savedAt).toLocaleString('zh-HK');
            this.btnViewSaved.title = `上次儲存：${d}`;
        } else {
            this.btnViewSaved.style.display = 'none';
        }
    }

    _viewSavedPlan() {
        const saved = this._loadFromStorage();
        if (!saved) return;
        this.assessmentData = saved.assessmentData;
        this.learningPlan   = saved.learningPlan;
        this.wizardSection.style.display = 'none';
        this._renderDashboard();
    }

    /* ──────────────────────────────────────────────────────
       Actions
       ────────────────────────────────────────────────────── */
    _restart() {
        // Reset form
        document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(el => {
            el.checked = false;
        });
        document.querySelectorAll('.inline-error').forEach(el => {
            el.textContent = '';
        });
        document.querySelectorAll('.question-card').forEach(el => {
            el.classList.remove('has-error');
        });

        // Reset wizard state
        this.currentStep = 1;
        this.steps.forEach(s => s.classList.remove('active-step'));
        this.steps[0].classList.add('active-step');
        this.stepIndicators.forEach(s => s.classList.remove('active', 'completed'));
        this.stepIndicators[0].classList.add('active');
        this.progressFill.style.width = '33.3%';

        this.dashboardSection.style.display = 'none';
        this.wizardSection.style.display = 'block';
        this.btnSubmit.disabled = false;

        window.scrollTo({ top: 0, behavior: 'smooth' });
        this._checkSavedPlan();
    }

    _startFirstModule() {
        if (!this.learningPlan?.recommendedModules?.length) return;
        const moduleMap = {
            circle_area:    'circle.html',
            cylinder_volume:'cylinder.html',
            pythagoras:     'pythagoras.html',
            probability:    'probability.html',
            sqrt2:          'sqrt2.html',
            exponential:    'exponential.html'
        };
        window.location.href = moduleMap[this.learningPlan.recommendedModules[0].module] || 'index.html';
    }

    _downloadPlan() {
        if (!this.assessmentData || !this.learningPlan) return;
        const plan = this.learningPlan;
        const data = this.assessmentData;

        const lines = [
            '===== DSE 數學備試計劃 =====',
            `生成時間：${new Date().toLocaleString('zh-HK')}`,
            '',
            `目標成績：${this.getLevelLabel(data.level)}`,
            `修讀課程：${this.getModuleLabel(data.module)}`,
            `基礎測試得分：${data.score}%`,
            `每週溫習時間：${this.getTimeLabel(data.time)}`,
            '',
            '=== 整體評估 ===',
            plan.overallAssessment || '',
            '',
            '=== 強項 ===',
            ...(plan.strengths || []).map(s => `• ${s}`),
            '',
            '=== 有待加強 ===',
            ...(plan.areasForImprovement || []).map(s => `• ${s}`),
            '',
            '=== 備試策略 ===',
            plan.learningStrategy || '',
            '',
            plan.dseExamTips ? '=== DSE 應試貼士 ===' : '',
            plan.dseExamTips || '',
            '',
            '=== 推薦學習模塊 ===',
            ...(plan.recommendedModules || []).flatMap((m, i) => [
                `${i + 1}. ${m.title} (${m.difficulty}) — 預計時間：${m.estimatedTime}`,
                `   原因：${m.reason}`,
                ''
            ]),
            '=== 加油！===',
            plan.motivationalMessage || ''
        ];

        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dse-learning-plan.txt';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.learningPlan = new LearningPlanGenerator();
});
