/**
 * Problem Solver - AI Math Learning Assistant
 * Integrates with Hugging Face API for problem analysis and step validation
 */

class MathProblemSolver {
    constructor() {
        this.currentProblem = null;
        this.currentSteps = [];
        this.completedSteps = [];
        this.usedHints = {};
        this.maxHintsPerStep = 3;
        
        this.initializeElements();
        this.attachEventListeners();
        this.checkServerHealth();
    }

    initializeElements() {
        // Main sections
        this.problemInputSection = document.getElementById('problem-input-section');
        this.solvingSection = document.getElementById('solving-section');
        this.completionArea = document.getElementById('completion-area');

        // Problem input
        this.problemInput = document.getElementById('problem-input');
        this.submitProblemBtn = document.getElementById('submit-problem-btn');
        this.exampleBtn = document.getElementById('example-btn');
        this.examplesArea = document.getElementById('examples-area');
        this.loadingSpinner = document.getElementById('loading-spinner');

        // Solving interface
        this.problemDisplay = document.getElementById('problem-display');
        this.stepsList = document.getElementById('steps-list');
        this.stepGuidance = document.getElementById('step-guidance');
        this.stepInput = document.getElementById('step-input');
        this.submitStepBtn = document.getElementById('submit-step-btn');
        this.stepFeedback = document.getElementById('step-feedback');

        // Buttons
        this.restartBtn = document.getElementById('restart-btn');
        this.hintButtons = {
            1: document.getElementById('hint-level-1-btn'),
            2: document.getElementById('hint-level-2-btn'),
            3: document.getElementById('hint-level-3-btn')
        };
        this.tryAnotherBtn = document.getElementById('try-another-btn');
        this.viewMoreBtn = document.getElementById('view-more-btn');

        // Modals
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

        // Example cards
        document.querySelectorAll('.example-card').forEach(card => {
            card.addEventListener('click', () => {
                this.problemInput.value = card.dataset.problem;
                this.examplesArea.style.display = 'none';
                this.handleSubmitProblem();
            });
        });

        // Solving interface
        this.submitStepBtn.addEventListener('click', () => this.handleSubmitStep());
        this.stepInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleSubmitStep();
            }
        });

        Object.keys(this.hintButtons).forEach(level => {
            this.hintButtons[level].addEventListener('click', () => {
                this.handleRequestHint(parseInt(level));
            });
        });

        this.restartBtn.addEventListener('click', () => this.resetToInput());
        this.tryAnotherBtn.addEventListener('click', () => this.resetToInput());
        this.viewMoreBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });

        this.errorCloseBtn.addEventListener('click', () => this.closeErrorModal());
        this.errorOkBtn.addEventListener('click', () => this.closeErrorModal());
        this.errorModal.addEventListener('click', (e) => {
            if (e.target === this.errorModal) {
                this.closeErrorModal();
            }
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
            if (!response.ok) {
                throw new Error('後端服務不可用');
            }
            const data = await response.json();
            if (!data.tokenConfigured) {
                throw new Error('伺服器尚未設定 HF_API_TOKEN');
            }
        } catch (error) {
            this.showError(`伺服器設定錯誤: ${error.message}`);
        }
    }

    toggleExamples() {
        this.examplesArea.style.display = 
            this.examplesArea.style.display === 'none' ? 'block' : 'none';
    }

    async handleSubmitProblem() {
        const problem = this.problemInput.value.trim();
        if (!problem) {
            this.showError('請輸入題目');
            return;
        }

        this.showLoading(true);
        try {
            await this.analyzeProblem(problem);
        } catch (error) {
            this.showError(`分析題目失敗: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    async analyzeProblem(problem) {
        const prompt = `你是一位數學教師。用戶提交了以下題目：

【題目】
${problem}

請按照以下格式用 JSON 回應：
{
    "understanding": "簡要說明這道題目的含義",
    "solution_approach": "解題的主要方法和思路（用列表形式）",
    "steps": [
        {
            "step_number": 1,
            "description": "第一步的描述",
            "hint_level_1": "溫和提示",
            "hint_level_2": "中等提示",
            "hint_level_3": "詳細解答"
        }
    ],
    "final_answer": "最終答案"
}

注意：
1. understanding 與 solution_approach 不可直接透露最終答案。
2. solution_approach 不可出現最終結果（例如 x=...、答案是...）。
3. 最終答案只能放在 final_answer。

確保中文回應。`;

        const response = await this.callHuggingFaceAPI(prompt);

        const parsedProblem = this.extractFirstJsonObject(response);
        if (!parsedProblem) {
            throw new Error('無法解析 AI 回應');
        }

        this.currentProblem = this.normalizeProblemSchema(parsedProblem, problem);
        this.currentSteps = this.currentProblem.steps;
        this.completedSteps = [];
        this.usedHints = {};

        this.displayProblem();
        this.switchToSolvingView();
    }

    extractFirstJsonObject(text) {
        if (!text || typeof text !== 'string') {
            return null;
        }

        const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (fenceMatch && fenceMatch[1]) {
            try {
                return JSON.parse(fenceMatch[1]);
            } catch (_error) {
                // Fallback to bracket scanning.
            }
        }

        const startIndexes = [];
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '{') {
                startIndexes.push(i);
            }
        }

        for (const start of startIndexes) {
            let depth = 0;
            for (let i = start; i < text.length; i++) {
                if (text[i] === '{') depth += 1;
                if (text[i] === '}') depth -= 1;
                if (depth === 0) {
                    const candidate = text.slice(start, i + 1);
                    try {
                        return JSON.parse(candidate);
                    } catch (_error) {
                        break;
                    }
                }
            }
        }

        return null;
    }

    normalizeProblemSchema(raw, originalProblemText) {
        const steps = Array.isArray(raw.steps) ? raw.steps : [];
        const normalizedSteps = steps
            .filter(step => step && typeof step === 'object')
            .map((step, index) => ({
                step_number: step.step_number || index + 1,
                description: step.description || `步驟 ${index + 1}`,
                hint_level_1: step.hint_level_1 || '先確認已知條件與目標。',
                hint_level_2: step.hint_level_2 || '將題目整理成可計算的式子。',
                hint_level_3: step.hint_level_3 || '請依照前一行式子做代入與化簡。'
            }));

        return {
            understanding: raw.understanding || originalProblemText,
            solution_approach: Array.isArray(raw.solution_approach)
                ? raw.solution_approach
                : [raw.solution_approach || '先釐清題目，再分步驟求解。'],
            steps: normalizedSteps.length > 0
                ? normalizedSteps
                : [{
                    step_number: 1,
                    description: '先把題目整理成數學式',
                    hint_level_1: '找出題目中的已知量與未知量。',
                    hint_level_2: '把文字敘述轉成方程式。',
                    hint_level_3: '若是方程題，先完成移項與化簡。'
                }],
            final_answer: raw.final_answer || '完成所有步驟後可得到最終答案。'
        };
    }

    sanitizeApproachText(text) {
        const raw = String(text || '').replace(/\s+/g, ' ').trim();
        if (!raw) {
            return '';
        }

        const leakPattern = /(最終答案|答案是|解為|因此\s*[a-zA-Z]\s*=|[a-zA-Z]\s*=\s*[-+]?\d+(?:\.\d+)?|=\s*[-+]?\d+(?:\.\d+)?)/i;
        if (leakPattern.test(raw)) {
            return '先根據已知條件建立關係式，再逐步化簡與驗算。';
        }

        return raw;
    }

    getSafeSolutionApproach() {
        const source = Array.isArray(this.currentProblem.solution_approach)
            ? this.currentProblem.solution_approach
            : [];

        const cleaned = source
            .map(item => this.sanitizeApproachText(item))
            .filter(Boolean);

        if (cleaned.length > 0) {
            return cleaned.slice(0, 4);
        }

        return [
            '先讀懂題目並整理已知條件與未知量。',
            '選擇合適方法建立數學式。',
            '逐步運算並檢查每一步是否合理。'
        ];
    }

    async callHuggingFaceAPI(prompt) {
        const response = await fetch('/api/hf', {
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            let errorMessage = `API 錯誤: ${response.status}`;
            try {
                const err = await response.json();
                if (err && err.error) {
                    errorMessage = err.error;
                }
            } catch (_error) {
                // Ignore parse errors and keep status message.
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();

        if (result && result.generated_text) {
            return result.generated_text;
        }

        throw new Error('無法解析 API 回應格式');
    }

    displayProblem() {
        this.problemDisplay.innerHTML = `
            <strong>📌 題目：</strong><br>
            ${this.escapeHtml(this.currentProblem.understanding || '')}
        `;

        this.updateStepsTracker();
        this.displayCurrentStep();
    }

    updateStepsTracker() {
        const total = this.currentSteps.length;
        const completed = this.completedSteps.length;
        
        this.stepsList.innerHTML = '';
        for (let i = 1; i <= total; i++) {
            const badge = document.createElement('div');
            badge.className = 'step-badge';
            
            if (i <= completed) {
                badge.classList.add('completed');
                badge.textContent = `✓ 步驟 ${i}`;
            } else if (i === completed + 1) {
                badge.classList.add('current');
                badge.textContent = `▶ 步驟 ${i}`;
            } else {
                badge.textContent = `步驟 ${i}`;
            }
            
            this.stepsList.appendChild(badge);
        }
    }

    displayCurrentStep() {
        const stepIndex = this.completedSteps.length;
        
        if (stepIndex >= this.currentSteps.length) {
            this.displayCompletion();
            return;
        }

        const step = this.currentSteps[stepIndex];
        this.usedHints[stepIndex] = this.usedHints[stepIndex] || 0;

        this.stepGuidance.innerHTML = `
            <h4>步驟 ${stepIndex + 1}: ${this.escapeHtml(step.description)}</h4>
        `;

        this.stepInput.value = '';
        this.stepInput.placeholder = '輸入你的答案...';
        this.stepFeedback.innerHTML = '';
        this.stepFeedback.classList.remove('show', 'correct', 'incorrect', 'hint');

        // Reset buttons
        this.submitStepBtn.disabled = false;
        this.submitStepBtn.textContent = '提交答案 ✓';
        
        Object.keys(this.hintButtons).forEach(level => {
            const used = this.usedHints[stepIndex] >= parseInt(level);
            this.hintButtons[level].classList.toggle('used', used);
            this.hintButtons[level].disabled = used;
        });

        this.stepInput.focus();
    }

    async handleSubmitStep() {
        const userAnswer = this.stepInput.value.trim();
        if (!userAnswer) {
            this.showError('請輸入答案');
            return;
        }

        const stepIndex = this.completedSteps.length;
        const step = this.currentSteps[stepIndex];

        try {
            const isCorrect = await this.validateStepAnswer(step, userAnswer);
            
            if (isCorrect) {
                this.showCorrectFeedback();
                this.completedSteps.push(stepIndex);
                
                setTimeout(() => {
                    this.updateStepsTracker();
                    this.displayCurrentStep();
                }, 1500);
            } else {
                this.showIncorrectFeedback();
            }
        } catch (error) {
            this.showError(`驗證失敗: ${error.message}`);
        }
    }

    async validateStepAnswer(step, userAnswer) {
        const prompt = `你是一位數學教師，要評判學生的答案是否正確。

【題目步驟描述】
${step.description}

【應該得到的答案或結果】
${step.hint_level_3}

【學生的答案】
${userAnswer}

請評判學生的答案是否基本正確（允許表述方式不同或計算方式不同，只要邏輯和結果對即可）。

用 JSON 格式回應：
{
    "is_correct": true/false,
    "feedback": "簡要反饋",
    "explanation": "詳細解釋"
}`;

        const response = await this.callHuggingFaceAPI(prompt);

        const result = this.extractFirstJsonObject(response);
        if (!result || typeof result !== 'object') {
            return false;
        }

        const isCorrect = Boolean(result.is_correct);
        const feedbackText = result.feedback || (isCorrect ? '答案方向正確。' : '答案仍有落差。');
        const explanationText = result.explanation || '請檢查計算步驟是否完整。';
        
        if (isCorrect) {
            this.stepFeedback.innerHTML = `
                <strong>✓ 正確！</strong><br>
                ${this.escapeHtml(feedbackText)}<br><br>
                <em>${this.escapeHtml(explanationText)}</em>
            `;
        } else {
            this.stepFeedback.innerHTML = `
                <strong>✗ 不太對</strong><br>
                ${this.escapeHtml(feedbackText)}<br><br>
                <em>提示：${this.escapeHtml(explanationText)}</em>
            `;
        }

        return isCorrect;
    }

    showCorrectFeedback() {
        this.stepFeedback.classList.add('show', 'correct');
        this.stepFeedback.innerHTML = `
            <strong>✓ 恭喜！答案正確！</strong>
            ${this.stepFeedback.innerHTML}
        `;
        this.submitStepBtn.textContent = '進到下一步 →';
        this.submitStepBtn.disabled = true;
    }

    showIncorrectFeedback() {
        this.stepFeedback.classList.add('show', 'incorrect');
        this.stepInput.focus();
    }

    async handleRequestHint(level) {
        const stepIndex = this.completedSteps.length;
        const step = this.currentSteps[stepIndex];

        this.usedHints[stepIndex] = Math.max(this.usedHints[stepIndex], level);

        let hintText = '';
        if (level === 1) {
            hintText = step.hint_level_1;
        } else if (level === 2) {
            hintText = step.hint_level_2;
        } else if (level === 3) {
            hintText = step.hint_level_3;
        }

        this.stepFeedback.classList.add('show', 'hint');
        this.stepFeedback.innerHTML = `
            <strong>💡 提示（級別 ${level}）：</strong><br>
            ${this.escapeHtml(hintText)}
        `;

        // Update hint buttons
        for (let i = 1; i <= 3; i++) {
            const used = this.usedHints[stepIndex] >= i;
            this.hintButtons[i].classList.toggle('used', used);
            this.hintButtons[i].disabled = used;
        }
    }

    displayCompletion() {
        this.solvingSection.style.display = 'none';
        this.completionArea.style.display = 'block';

        let solutionHTML = '<strong>📝 完整解題過程：</strong><br>';
        this.currentSteps.forEach((step, index) => {
            solutionHTML += `<strong>步驟 ${index + 1}：</strong> ${this.escapeHtml(step.description)}<br>`;
            solutionHTML += `<em>答案：${this.escapeHtml(step.hint_level_3)}</em><br><br>`;
        });
        
        solutionHTML += `<strong>🎯 最終答案：</strong><br>${this.escapeHtml(this.currentProblem.final_answer)}`;
        
        document.getElementById('final-solution').innerHTML = solutionHTML;
    }

    switchToSolvingView() {
        this.problemInputSection.classList.remove('active-section');
        this.solvingSection.classList.add('active-section');
    }

    resetToInput() {
        this.problemInputSection.classList.add('active-section');
        this.solvingSection.classList.remove('active-section');
        this.completionArea.style.display = 'none';
        this.problemInput.value = '';
        this.stepInput.value = '';
        this.examplesArea.style.display = 'none';
        this.problemInput.focus();
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.problemSolver = new MathProblemSolver();
});
