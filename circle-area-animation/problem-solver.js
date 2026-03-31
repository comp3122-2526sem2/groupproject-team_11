/**
 * Problem Solver - Step-by-step math coach
 * - User uploads/inputs a problem
 * - User answers one step at a time
 * - Hint never shows direct answer
 * - Show-answer button appears only when user's step is wrong
 */

class MathProblemSolver {
    constructor() {
        this.problemText = '';
        this.imageDataUrl = '';
        this.completedSteps = [];
        this.currentStepNumber = 1;
        this.lastWrongAttempt = '';

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
                this.problemInput.value = card.dataset.problem;
                this.examplesArea.style.display = 'none';
                this.handleSubmitProblem();
            });
        });

        this.submitStepBtn.addEventListener('click', () => this.handleSubmitStep());
        this.stepInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleSubmitStep();
            }
        });

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
            if (!response.ok) throw new Error('後端服務不可用');
            const data = await response.json();
            if (!data.tokenConfigured) throw new Error('伺服器尚未設定 HF_API_TOKEN');
        } catch (error) {
            this.showError(`伺服器設定錯誤: ${error.message}`);
        }
    }

    toggleExamples() {
        this.examplesArea.style.display = this.examplesArea.style.display === 'none' ? 'block' : 'none';
    }

    async handleSubmitProblem() {
        const typedProblem = this.problemInput.value.trim();
        if (!typedProblem && !this.imageDataUrl) {
            this.showError('請輸入題目或上傳題目圖片');
            return;
        }

        this.showLoading(true);
        try {
            let resolvedProblem = typedProblem;
            if (!resolvedProblem && this.imageDataUrl) {
                resolvedProblem = await this.extractProblemFromImage();
            }

            if (!resolvedProblem) {
                throw new Error('圖片未能辨識到有效題目，請補充文字題目。');
            }

            this.problemText = resolvedProblem;
            this.completedSteps = [];
            this.currentStepNumber = 1;
            this.lastWrongAttempt = '';
            this.switchToSolvingView();
            this.renderContext();
        } catch (error) {
            this.showError(`題目初始化失敗: ${error.message}`);
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

        const prompt = '請讀取這張數學題目圖片，轉成純文字題目，不要解題，只回傳題目文字。';
        const aiText = await this.callHuggingFaceAPI(prompt, this.imageDataUrl);
        return aiText.replace(/```[\s\S]*?```/g, '').trim();
    }

    renderContext() {
        this.problemDisplay.innerHTML = `
            <strong>📌 題目：</strong><br>${this.escapeHtml(this.problemText)}
        `;

        this.completedStepsList.innerHTML = '';
        if (this.completedSteps.length === 0) {
            const li = document.createElement('li');
            li.textContent = '尚未完成任何步驟';
            this.completedStepsList.appendChild(li);
        } else {
            this.completedSteps.forEach((step, index) => {
                const li = document.createElement('li');
                li.textContent = `步驟 ${index + 1}: ${step}`;
                this.completedStepsList.appendChild(li);
            });
        }

        this.updateStepBadges();
        this.stepGuidance.innerHTML = `
            <h4>請回答下一步（步驟 ${this.currentStepNumber}）</h4>
            <p>請輸入你認為下一步應該做的運算或推理。</p>
        `;

        this.showAnswerBtn.style.display = 'none';
        this.stepInput.value = '';
        this.stepFeedback.classList.remove('show', 'correct', 'incorrect', 'hint');
        this.stepFeedback.innerHTML = '';
    }

    updateStepBadges() {
        this.stepsList.innerHTML = '';
        const total = Math.max(this.completedSteps.length + 1, 1);
        for (let i = 1; i <= total; i++) {
            const badge = document.createElement('div');
            badge.className = 'step-badge';
            if (i <= this.completedSteps.length) {
                badge.classList.add('completed');
                badge.textContent = `✓ 步驟 ${i}`;
            } else {
                badge.classList.add('current');
                badge.textContent = `▶ 步驟 ${i}`;
            }
            this.stepsList.appendChild(badge);
        }
    }

    async handleHint() {
        try {
            this.setFeedback('hint', 'AI 正在生成提示...');
            const prompt = `你是數學導師。請根據題目與學生已完成步驟，提供下一步提示。

題目：${this.problemText}
已完成步驟：${this.completedSteps.length ? this.completedSteps.join(' | ') : '無'}
目前要做：步驟 ${this.currentStepNumber}

要求：
1. 只能提示下一步方向，不可給答案。
2. 不可出現最終答案、數值結果或完整算式解。
3. 回覆 1-2 句中文。`;

            const hint = await this.callHuggingFaceAPI(prompt);
            this.setFeedback('hint', `💡 提示：${this.trimUnsafeAnswer(hint)}`);
        } catch (error) {
            this.showError(`提示生成失敗: ${error.message}`);
        }
    }

    async handleSubmitStep() {
        const userStep = this.stepInput.value.trim();
        if (!userStep) {
            this.showError('請先輸入你的下一步');
            return;
        }

        try {
            this.submitStepBtn.disabled = true;
            const judgement = await this.validateNextStep(userStep);

            if (judgement.is_correct) {
                this.completedSteps.push(userStep);
                this.currentStepNumber += 1;
                this.lastWrongAttempt = '';
                this.showAnswerBtn.style.display = 'none';
                this.setFeedback('correct', '{回答正確} ' + (judgement.feedback || '你可以繼續下一步。'));

                if (judgement.is_finished) {
                    await this.showCompletion();
                } else {
                    setTimeout(() => this.renderContext(), 900);
                }
            } else {
                this.lastWrongAttempt = userStep;
                this.showAnswerBtn.style.display = 'inline-flex';
                this.setFeedback('incorrect', (judgement.feedback || '這一步不正確，請重試。'));
            }
        } catch (error) {
            this.showError(`步驟檢測失敗: ${error.message}`);
        } finally {
            this.submitStepBtn.disabled = false;
        }
    }

    async validateNextStep(userStep) {
        const prompt = `你是嚴謹的數學老師。請判斷學生提交的「下一步」是否正確。

題目：${this.problemText}
已完成步驟：${this.completedSteps.length ? this.completedSteps.join(' | ') : '無'}
學生本次步驟：${userStep}

請只回傳 JSON：
{
  "is_correct": true/false,
  "is_finished": true/false,
  "feedback": "中文簡短回饋（不要直接給最終答案）"
}

規則：
1. 若這一步邏輯與運算合理，is_correct=true。
2. 若此步驟已足以完成整題，is_finished=true。
3. feedback 不可直接給最終答案。`;

        const response = await this.callHuggingFaceAPI(prompt);
        const jsonObj = this.extractFirstJsonObject(response);
        if (!jsonObj || typeof jsonObj !== 'object') {
            return { is_correct: false, is_finished: false, feedback: '格式無法判定，請重試。' };
        }

        return {
            is_correct: Boolean(jsonObj.is_correct),
            is_finished: Boolean(jsonObj.is_finished),
            feedback: this.trimUnsafeAnswer(jsonObj.feedback || '')
        };
    }

    async handleShowAnswer() {
        try {
            const prompt = `你是數學導師。請只給出「下一步（步驟 ${this.currentStepNumber}）」的參考答案。

題目：${this.problemText}
已完成步驟：${this.completedSteps.length ? this.completedSteps.join(' | ') : '無'}
學生錯誤嘗試：${this.lastWrongAttempt || '無'}

限制：
1. 只給這一步，不要給整題最終答案。
2. 回覆最多 1-2 句。`;

            const answer = await this.callHuggingFaceAPI(prompt);
            this.setFeedback('hint', `👀 此步驟參考答案：${answer.trim()}`);
        } catch (error) {
            this.showError(`顯示答案失敗: ${error.message}`);
        }
    }

    async showCompletion() {
        this.solvingSection.style.display = 'none';
        this.completionArea.style.display = 'block';

        const summaryPrompt = `你是數學導師。請根據題目與學生已完成步驟，總結解題流程。

題目：${this.problemText}
已完成步驟：${this.completedSteps.join(' | ')}

請回覆簡短總結（中文）。`;

        let summary = '你已完成所有關鍵步驟。';
        try {
            summary = await this.callHuggingFaceAPI(summaryPrompt);
        } catch (_error) {
            // Keep default summary if AI call fails.
        }

        document.getElementById('final-solution').innerHTML = `
            <strong>✅ 題目：</strong><br>${this.escapeHtml(this.problemText)}<br><br>
            <strong>✅ 你完成的步驟：</strong><br>${this.completedSteps.map((s, i) => `${i + 1}. ${this.escapeHtml(s)}`).join('<br>')}<br><br>
            <strong>🎯 總結：</strong><br>${this.escapeHtml(summary)}
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
            let message = `API 錯誤: ${response.status}`;
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
            throw new Error('AI 回應格式不正確');
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
        const leakPattern = /(最終答案|答案是|因此\s*[a-zA-Z]\s*=|[a-zA-Z]\s*=\s*[-+]?\d+(?:\.\d+)?)/i;
        if (leakPattern.test(value)) {
            return '先檢查你目前的式子，下一步應該做等式變形或代入。';
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
            reader.onerror = () => reject(new Error('圖片讀取失敗'));
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

        this.problemInput.value = '';
        this.stepInput.value = '';
        this.problemImageInput.value = '';
        this.problemImagePreview.src = '';
        this.problemImagePreview.style.display = 'none';
        this.examplesArea.style.display = 'none';
        this.showAnswerBtn.style.display = 'none';
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
