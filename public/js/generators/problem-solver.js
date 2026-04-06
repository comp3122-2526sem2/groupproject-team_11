/**
 * Problem Solver - Step-by-step math coach
 * - User uploads/inputs a problem
 * - User answers one step at a time
 * - Hint never shows direct answer
 * - Show-answer button appears only when user's step is wrong
 */

class MathProblemSolver {
    constructor() {
        this.correctFeedbackDelayMs = 2500;
        this.problemText = '';
        this.imageDataUrl = '';
        this.completedSteps = [];
        this.currentStepNumber = 1;
        this.lastWrongAttempt = '';
        this.pendingAcceptedStep = '';

        this._t = (key, r) => (window.i18n && window.i18n.t) ? window.i18n.t(key, r) : key;
        this._lang = () => (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'zh';

        this.initializeElements();
        this.attachEventListeners();
        this.checkServerHealth();
    }

    initializeElements() {
        this.problemInputSection = document.getElementById('problem-input-section');
        this.solvingSection = document.getElementById('solving-section');
        this.completionArea = document.getElementById('completion-area');

        this.problemInput = document.getElementById('problem-input');
        this.problemImageInput = document.getElementById('problem-image-input');
        this.problemImagePreview = document.getElementById('problem-image-preview');
        this.submitProblemBtn = document.getElementById('submit-problem-btn');
        this.exampleBtn = document.getElementById('example-btn');
        this.examplesArea = document.getElementById('examples-area');
        this.loadingSpinner = document.getElementById('loading-spinner');

        this.problemDisplay = document.getElementById('problem-display');
        this.completedStepsList = document.getElementById('completed-steps-list');
        this.stepsList = document.getElementById('steps-list');
        this.stepGuidance = document.getElementById('step-guidance');
        this.stepInput = document.getElementById('step-input');
        this.submitStepBtn = document.getElementById('submit-step-btn');
        this.continueStepBtn = document.getElementById('continue-step-btn');
        this.prevStepBtn = document.getElementById('prev-step-btn');
        this.hintBtn = document.getElementById('hint-btn');
        this.showAnswerBtn = document.getElementById('show-answer-btn');
        this.stepFeedback = document.getElementById('step-feedback');

        this.restartBtn = document.getElementById('restart-btn');
        this.tryAnotherBtn = document.getElementById('try-another-btn');
        this.viewMoreBtn = document.getElementById('view-more-btn');

        this.errorModal = document.getElementById('error-modal');
        this.errorMessage = document.getElementById('error-message');
        this.errorCloseBtn = document.getElementById('error-close-btn');
        this.errorOkBtn = document.getElementById('error-ok-btn');
    }

    attachEventListeners() {
        this.submitProblemBtn.addEventListener('click', () => this.handleSubmitProblem());
        this.exampleBtn.addEventListener('click', () => this.toggleExamples());

        this.problemInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.handleSubmitProblem();
            }
        });

        this.problemImageInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) {
                this.imageDataUrl = '';
                this.problemImagePreview.style.display = 'none';
                return;
            }
            this.imageDataUrl = await this.fileToDataUrl(file);
            this.problemImagePreview.src = this.imageDataUrl;
            this.problemImagePreview.style.display = 'block';
        });

        document.querySelectorAll('.example-card').forEach(card => {
            card.addEventListener('click', () => {
                // Use language-appropriate problem text
                const lang = this._lang();
                this.problemInput.value = lang === 'zh'
                    ? (card.dataset.problemZh || card.dataset.problem)
                    : card.dataset.problem;
                this.examplesArea.style.display = 'none';
                this.handleSubmitProblem();
            });
        });

        this.submitStepBtn.addEventListener('click', () => this.handleSubmitStep());
        this.continueStepBtn.addEventListener('click', () => this.handleContinueStep());
        this.stepInput.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                this.handleSubmitStep();
            }
        });
        this.prevStepBtn.addEventListener('click', () => this.handlePrevStep());

        this.hintBtn.addEventListener('click', () => this.handleHint());
        this.showAnswerBtn.addEventListener('click', () => this.handleShowAnswer());

        this.restartBtn.addEventListener('click', () => this.resetToInput());
        this.tryAnotherBtn.addEventListener('click', () => this.resetToInput());
        this.viewMoreBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });

        this.errorCloseBtn.addEventListener('click', () => this.closeErrorModal());
        this.errorOkBtn.addEventListener('click', () => this.closeErrorModal());
        this.errorModal.addEventListener('click', (e) => {
            if (e.target === this.errorModal) this.closeErrorModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.errorModal.style.display !== 'none') {
                this.closeErrorModal();
            }
        });
    }

    async checkServerHealth() {
        try {
            const response = await fetch('/api/health');
            if (!response.ok) throw new Error('Backend service unavailable');
            const data = await response.json();
            if (!data.tokenConfigured) throw new Error('Server has not configured HF_API_TOKEN');
        } catch (error) {
            this.showError(`Server configuration error: ${error.message}`);
        }
    }

    toggleExamples() {
        this.examplesArea.style.display = this.examplesArea.style.display === 'none' ? 'block' : 'none';
    }

    async handleSubmitProblem() {
        const typedProblem = this.problemInput.value.trim();
        if (!typedProblem && !this.imageDataUrl) {
            this.showError(this._t('solver.enterProblemErr'));
            return;
        }

        this.showLoading(true);
        try {
            let resolvedProblem = typedProblem;
            if (!resolvedProblem && this.imageDataUrl) {
                resolvedProblem = await this.extractProblemFromImage();
            }

            if (!resolvedProblem) {
                throw new Error('Could not extract a valid problem from the image. Please add text input.');
            }

            this.problemText = resolvedProblem;
            this.completedSteps = [];
            this.currentStepNumber = 1;
            this._solveStartTime = new Date().toISOString();
            this.lastWrongAttempt = '';
            this.pendingAcceptedStep = '';
            this.switchToSolvingView();
            this.renderContext();
        } catch (error) {
            this.showError(`Problem initialization failed: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    async extractProblemFromImage() {
        if (!this.imageDataUrl) return '';

        if (window.Tesseract) {
            try {
                const result = await window.Tesseract.recognize(this.imageDataUrl, 'eng');
                const ocrText = (result?.data?.text || '').replace(/\s+/g, ' ').trim();
                if (ocrText.length >= 6) {
                    return ocrText;
                }
            } catch (_error) {
                // OCR failed, fallback to AI image understanding below.
            }
        }

        const prompt = 'Read this math problem image and convert it into plain problem text. Do not solve it. Return only the problem text.';
        const aiText = await this.callHuggingFaceAPI(prompt, this.imageDataUrl);
        return aiText.replace(/```[\s\S]*?```/g, '').trim();
    }

    _getReplyLang() {
        return this._lang() === 'zh' ? '繁體中文' : 'English';
    }

    renderContext() {
        this.problemDisplay.innerHTML = `
            <strong>${this._t('solver.problemLabel')}</strong><br>${this.escapeHtml(this.problemText)}
        `;

        this.completedStepsList.innerHTML = '';
        if (this.completedSteps.length === 0) {
            const li = document.createElement('li');
            li.textContent = this._t('solver.noSteps');
            this.completedStepsList.appendChild(li);
        } else {
            this.completedSteps.forEach((step, index) => {
                const li = document.createElement('li');
                li.textContent = this._t('solver.stepLabel', { n: index + 1, s: step });
                this.completedStepsList.appendChild(li);
            });
        }

        this.updateStepBadges();
        this.stepGuidance.innerHTML = `
            <h4>${this._t('solver.provideNext', { n: this.currentStepNumber })}</h4>
            <p>${this._t('solver.provideNextDesc')}</p>
        `;

        this.showAnswerBtn.style.display = 'none';
        this.continueStepBtn.style.display = 'none';
        this.prevStepBtn.disabled = this.completedSteps.length === 0;
        this.stepInput.value = '';
        this.stepFeedback.classList.remove('show', 'correct', 'incorrect', 'hint');
        this.stepFeedback.innerHTML = '';
    }

    getAnalysisContext() {
        const completed = this.completedSteps.length ? this.completedSteps.join(' | ') : 'None';
        const currentDraft = this.stepInput.value.trim() || 'None';
        const wrongAttempt = this.lastWrongAttempt || 'None';
        return `Problem: ${this.problemText}\nCompleted steps: ${completed}\nCurrent step: ${this.currentStepNumber}\nCurrent draft: ${currentDraft}\nMost recent wrong attempt: ${wrongAttempt}`;
    }

    updateStepBadges() {
        const isZh = this._lang() === 'zh';
        this.stepsList.innerHTML = '';
        const total = Math.max(this.completedSteps.length + 1, 1);
        for (let i = 1; i <= total; i++) {
            const badge = document.createElement('div');
            badge.className = 'step-badge';
            if (i <= this.completedSteps.length) {
                badge.classList.add('completed');
                badge.textContent = isZh ? `✓ 步驟 ${i}` : `✓ Step ${i}`;
            } else {
                badge.classList.add('current');
                badge.textContent = isZh ? `▶ 步驟 ${i}` : `▶ Step ${i}`;
            }
            this.stepsList.appendChild(badge);
        }
    }

    async handleHint() {
        try {
            this.setFeedback('hint', this._t('solver.hintGenerating'));
            const replyLang = this._getReplyLang();
            const prompt = `You are a math tutor. Re-analyze the problem and student context, then provide a hint for the next step.

${this.getAnalysisContext()}

Requirements:
1. Give direction only for the next step. Do not provide the direct answer.
2. Do not reveal final answers, final numeric results, or full complete solutions.
3. Reply in 1-2 concise sentences in ${replyLang}.`;

            const hint = await this.callHuggingFaceAPI(prompt);
            this.setFeedback('hint', `💡 ${this._lang() === 'zh' ? '提示：' : 'Hint: '}${this.trimUnsafeAnswer(hint)}`);
        } catch (error) {
            this.showError(`Hint generation failed: ${error.message}`);
        }
    }

    handlePrevStep() {
        if (this.completedSteps.length === 0) {
            this.setFeedback('hint', this._t('solver.atFirstStep'));
            return;
        }

        this.completedSteps.pop();
        this.currentStepNumber = Math.max(1, this.currentStepNumber - 1);
        this.lastWrongAttempt = '';
        this.setFeedback('hint', this._t('solver.returnedPrev'));
        this.renderContext();
    }

    async handleSubmitStep() {
        const userStep = this.stepInput.value.trim();
        if (!userStep) {
            this.showError(this._t('solver.enterStep'));
            return;
        }

        try {
            this.submitStepBtn.disabled = true;
            const judgement = await this.validateNextStep(userStep);

            if (judgement.is_correct) {
                this.pendingAcceptedStep = userStep;
                this.lastWrongAttempt = '';
                this.showAnswerBtn.style.display = 'none';
                this.setFeedback('correct', (this._lang() === 'zh' ? '正確。' : 'Correct. ') + (judgement.feedback || (this._lang() === 'zh' ? '查看反饋後，點擊繼續。' : 'Review this feedback, then click Continue to move on.')));

                if (judgement.is_finished) {
                    await this.showCompletion();
                } else {
                    this.continueStepBtn.style.display = 'inline-flex';
                    this.submitStepBtn.disabled = true;
                    this.prevStepBtn.disabled = true;
                }
            } else {
                this.lastWrongAttempt = userStep;
                this.showAnswerBtn.style.display = 'inline-flex';
                this.setFeedback('incorrect', (judgement.feedback || (this._lang() === 'zh' ? '這步不正確，請再試。' : 'This step is not correct. Please try again.')));
            }
        } catch (error) {
            this.showError(`Step validation failed: ${error.message}`);
        } finally {
            this.submitStepBtn.disabled = false;
        }
    }

    handleContinueStep() {
        if (!this.pendingAcceptedStep) {
            return;
        }

        this.completedSteps.push(this.pendingAcceptedStep);
        this.currentStepNumber += 1;
        this.pendingAcceptedStep = '';
        this.continueStepBtn.style.display = 'none';
        this.submitStepBtn.disabled = false;
        this.prevStepBtn.disabled = this.completedSteps.length === 0;
        this.renderContext();
    }

    async validateNextStep(userStep) {
        const replyLang = this._getReplyLang();
        const prompt = `You are a rigorous math teacher. Judge whether the student's submitted "next step" is correct.

Problem: ${this.problemText}
Completed steps: ${this.completedSteps.length ? this.completedSteps.join(' | ') : 'None'}
Student step this round: ${userStep}

Return JSON only:
{
  "is_correct": true/false,
  "is_finished": true/false,
  "feedback": "Short feedback in ${replyLang} (do not give the final answer directly)"
}

Rules:
1. If this step is logically and mathematically valid, set is_correct=true.
2. If this step sufficiently completes the entire problem, set is_finished=true.
3. feedback must not directly reveal the final answer.
4. If uncertain, or if student information is insufficient, set is_correct=false.
5. Output only JSON. Do not output markdown or extra text.`;

        const response = await this.callHuggingFaceAPI(prompt);
        const jsonObj = this.extractFirstJsonObject(response);
        if (!jsonObj || typeof jsonObj !== 'object') {
            return { is_correct: false, is_finished: false, feedback: this._lang() === 'zh' ? '無法解析 AI 回覆格式，請重試。' : 'Unable to parse AI response format. Please try again.' };
        }

        return {
            is_correct: this.normalizeBoolean(jsonObj.is_correct),
            is_finished: this.normalizeBoolean(jsonObj.is_finished),
            feedback: this.trimUnsafeAnswer(jsonObj.feedback || '')
        };
    }

    normalizeBoolean(value) {
        if (typeof value === 'boolean') {
            return value;
        }

        if (typeof value === 'number') {
            return value === 1;
        }

        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (['true', '1', 'yes', 'y', 'correct'].includes(normalized)) {
                return true;
            }
            if (['false', '0', 'no', 'n', 'incorrect'].includes(normalized)) {
                return false;
            }
        }

        return false;
    }

    async handleShowAnswer() {
        try {
            const replyLang = this._getReplyLang();
            const prompt = `You are a math tutor. Re-analyze the problem and student context, then provide only the reference answer for "next step (Step ${this.currentStepNumber})".

${this.getAnalysisContext()}

Constraints:
1. Provide only this step, not the final answer for the entire problem.
2. Reply in at most 1-2 sentences in ${replyLang}.`;

            const answer = await this.callHuggingFaceAPI(prompt);
            const label = this._lang() === 'zh' ? '👀 本步參考答案：' : '👀 Reference answer for this step: ';
            this.setFeedback('hint', `${label}${answer.trim()}`);
        } catch (error) {
            this.showError(`Failed to show answer: ${error.message}`);
        }
    }

    async showCompletion() {
        this.solvingSection.style.display = 'none';
        this.completionArea.style.display = 'block';

        const replyLang = this._getReplyLang();
        const summaryPrompt = `You are a math tutor. Based on the problem and the student's completed steps, summarize the solving process.

Problem: ${this.problemText}
Completed steps: ${this.completedSteps.join(' | ')}

Reply with a short summary in ${replyLang}.`;

        let summary = this._lang() === 'zh' ? '你已完成所有關鍵步驟。' : 'You have completed all key steps.';
        try {
            summary = await this.callHuggingFaceAPI(summaryPrompt);
        } catch (_error) {
            // Keep default summary if AI call fails.
        }

        document.getElementById('final-solution').innerHTML = `
            <strong>${this._t('solver.finalProblem')}</strong><br>${this.escapeHtml(this.problemText)}<br><br>
            <strong>${this._t('solver.finalSteps')}</strong><br>${this.completedSteps.map((s, i) => `${i + 1}. ${this.escapeHtml(s)}`).join('<br>')}<br><br>
            <strong>${this._t('solver.finalSummary')}</strong><br>${this.escapeHtml(summary)}
        `;

    }

    async callHuggingFaceAPI(prompt, imageDataUrl = '') {
        const body = { prompt };
        if (imageDataUrl) {
            body.imageDataUrl = imageDataUrl;
        }

        const response = await fetch('/api/hf', {
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            let message = `API error: ${response.status}`;
            try {
                const err = await response.json();
                if (err && err.error) message = err.error;
            } catch (_error) {
                // Keep fallback message.
            }
            throw new Error(message);
        }

        const data = await response.json();
        if (!data || !data.generated_text) {
            throw new Error('Invalid AI response format');
        }

        return String(data.generated_text);
    }

    extractFirstJsonObject(text) {
        if (!text || typeof text !== 'string') return null;

        const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (fence && fence[1]) {
            try {
                return JSON.parse(fence[1]);
            } catch (_error) {
                // Continue with fallback parser.
            }
        }

        const starts = [];
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '{') starts.push(i);
        }

        for (const start of starts) {
            let depth = 0;
            for (let i = start; i < text.length; i++) {
                if (text[i] === '{') depth += 1;
                if (text[i] === '}') depth -= 1;
                if (depth === 0) {
                    try {
                        return JSON.parse(text.slice(start, i + 1));
                    } catch (_error) {
                        break;
                    }
                }
            }
        }

        return null;
    }

    trimUnsafeAnswer(text) {
        const value = String(text || '').trim();
        const leakPattern = /(final answer|the answer is|therefore\s*[a-zA-Z]\s*=|[a-zA-Z]\s*=\s*[-+]?\d+(?:\.\d+)?)/i;
        if (leakPattern.test(value)) {
            return this._lang() === 'zh'
                ? '請先檢查你當前的等式。下一步應該是代數變換或代入。'
                : 'Check your current equation first. The next step should be algebraic transformation or substitution.';
        }
        return value;
    }

    setFeedback(type, message) {
        this.stepFeedback.classList.remove('show', 'correct', 'incorrect', 'hint');
        this.stepFeedback.classList.add('show', type);
        this.stepFeedback.innerHTML = this.escapeHtml(message);
    }

    async fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read image file'));
            reader.readAsDataURL(file);
        });
    }

    switchToSolvingView() {
        this.problemInputSection.classList.remove('active-section');
        this.solvingSection.classList.add('active-section');
    }

    resetToInput() {
        this.problemInputSection.classList.add('active-section');
        this.solvingSection.classList.remove('active-section');
        this.solvingSection.style.display = '';
        this.completionArea.style.display = 'none';

        this.problemText = '';
        this.imageDataUrl = '';
        this.completedSteps = [];
        this.currentStepNumber = 1;
        this.lastWrongAttempt = '';
        this.pendingAcceptedStep = '';

        this.problemInput.value = '';
        this.stepInput.value = '';
        this.problemImageInput.value = '';
        this.problemImagePreview.src = '';
        this.problemImagePreview.style.display = 'none';
        this.examplesArea.style.display = 'none';
        this.showAnswerBtn.style.display = 'none';
        this.prevStepBtn.disabled = true;
        this.stepFeedback.classList.remove('show', 'correct', 'incorrect', 'hint');
        this.stepFeedback.innerHTML = '';
    }

    showLoading(show) {
        this.loadingSpinner.style.display = show ? 'block' : 'none';
        this.submitProblemBtn.disabled = show;
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorModal.style.setProperty('display', 'flex', 'important');
    }

    closeErrorModal() {
        this.errorModal.style.setProperty('display', 'none', 'important');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.problemSolver = new MathProblemSolver();
});
