/**
 * dse-algebra.js
 * Frontend logic for DSE Dynamic Algebra Problem Generator
 * Dedicated module — no geometry rendering, no sliders
 */

// ==========================================
// 1. Topic & Subtopic Definitions
// ==========================================
const TOPIC_SUBTOPICS = {
    "Quadratic Equations (一元二次方程)": [
        "求根公式 (Quadratic Formula)",
        "判別式 (Discriminant Δ)",
        "韋達定理 (Vieta's Formulas)",
        "建立二次方程 (Forming Equations)"
    ],
    "Sequences and Series (數列與級數)": [
        "等差數列 (Arithmetic Sequence)",
        "等差級數 (Arithmetic Series)",
        "等比數列 (Geometric Sequence)",
        "等比級數 (Geometric Series)"
    ],
    "Polynomials (多項式)": [
        "餘式定理 (Remainder Theorem)",
        "因式定理 (Factor Theorem)",
        "長除法 (Polynomial Long Division)"
    ],
    "Variations (變分)": [
        "正變 (Direct Variation)",
        "反變 (Inverse Variation)",
        "聯變 (Joint Variation)",
        "部分變 (Partial Variation)"
    ]
};


// ==========================================
// 2. Core Logic: AI Generation Service
// ==========================================
class AlgebraAIService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.modelName = 'gemini-3-flash-preview';
    }

    buildSystemPrompt() {
        return `你是一位專業的香港 DSE 數學科出題專家，專精「數與代數 (Numbers & Algebra)」範疇。
請根據使用者提供的「主題」、「子課題」與「難度」，生成一題符合 DSE 格式的數學代數題。

【數學品質要求 — 最高優先級】
1. 你必須利用 Reasoning/思考鏈 (CoT) 在內部推導，確保題目的所有數值答案為「漂亮整數」或「有理數（簡分數）」。
2. 嚴禁生成需要無限不循環小數、需要計算器、或數值不合理的題目。
3. 在生成之前，你必須先在內部驗算：從題目條件出發，能否順利求出每一步的答案。

【輸出格式要求】
你必須且只能輸出一個合法的 JSON 物件，不可包含任何 Markdown 標籤 (例如 \`\`\`json) 或其他文字。
該 JSON 必須嚴格符合以下結構：

{
  "metadata": {
    "topic": "課題英文名稱",
    "subtopic": "子課題英文名稱",
    "difficulty": "難度等級"
  },
  "question": {
    "text": "完整題目敘述，使用繁體中文。支援 LaTeX: 行內用 $...$ 包裝，獨立行用 $$...$$ 包裝。",
    "parts": [
      { "label": "(a)", "text": "子題描述（支援 LaTeX）", "marks": 3 }
    ]
  },
  "solution": {
    "steps": [
      { "description": "步驟描述（繁體中文）", "expression": "關鍵運算式（LaTeX 格式）" }
    ],
    "final_answer": "最終答案（LaTeX 格式）"
  },
  "marking_scheme": {
    "total_marks": 7,
    "steps": [
      { "description": "給分步驟描述", "marks": 1, "markType": "M" }
    ]
  }
}

【額外規範】
- 題目語言必須為繁體中文。
- question.parts 可以有 1~4 個子題，或留空 []（如果題目不需要分子題）。
- solution.steps 至少要有 2 步，展示完整推導過程。
- marking_scheme.steps 中 markType 只能是 "M"（方法分）或 "A"（答案分）。
- 分數使用 \\frac{}{}，根號使用 \\sqrt{}，乘號使用 \\times。
- JSON 格式必須完美無缺，能被 JSON.parse() 解析。`;
    }

    async generateQuestion(topic, subtopic, difficulty) {
        const systemInstruction = this.buildSystemPrompt();
        const userMessage = `主題：${topic}\n子課題：${subtopic}\n難度：${difficulty}`;

        const MAX_RETRIES = 2;
        let attempt = 0;

        while (attempt <= MAX_RETRIES) {
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            system_instruction: { parts: [{ text: systemInstruction }] },
                            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
                            generationConfig: {
                                temperature: 0.3,
                                responseMimeType: "application/json"
                            }
                        })
                    }
                );

                if (!response.ok) {
                    const errPayload = await response.json().catch(() => ({}));
                    throw new Error(`Gemini API Error (${response.status}): ${errPayload.error?.message || ''}`);
                }

                const data = await response.json();
                if (!data.candidates || data.candidates.length === 0) {
                    throw new Error("No candidates returned from Gemini");
                }

                const rawText = data.candidates[0].content.parts[0].text;
                const cleanedText = rawText.replace(/^\s*```json\s*/, '').replace(/\s*```\s*$/, '');
                const parsed = JSON.parse(cleanedText);

                // Basic schema validation
                this.validateSchema(parsed);

                return parsed;
            } catch (error) {
                attempt++;
                console.error(`Attempt ${attempt} failed:`, error);
                if (attempt > MAX_RETRIES) {
                    throw error;
                }
            }
        }
    }

    validateSchema(data) {
        if (!data.metadata) throw new Error('Schema error: missing metadata');
        if (!data.question || !data.question.text) throw new Error('Schema error: missing question.text');
        if (!data.solution || !data.solution.steps || data.solution.steps.length === 0) {
            throw new Error('Schema error: missing solution.steps');
        }
        if (!data.marking_scheme || !data.marking_scheme.steps) {
            throw new Error('Schema error: missing marking_scheme');
        }

        // Validate markType values
        for (const step of data.marking_scheme.steps) {
            if (step.markType !== 'M' && step.markType !== 'A') {
                console.warn(`Unexpected markType: ${step.markType}, defaulting to M`);
                step.markType = 'M';
            }
        }
    }
}


// ==========================================
// 3. UI Controller
// ==========================================
class DSEAlgebraController {
    constructor() {
        this.currentQuestionData = null;
        this.apiKey = '';

        this.initDOM();
        this.populateTopics();
        this.attachEvents();
        this.loadApiKey();
    }

    initDOM() {
        // Form elements
        this.topicSelect = document.getElementById('alg-topic-input');
        this.subtopicSelect = document.getElementById('alg-subtopic-input');
        this.difficultySelect = document.getElementById('alg-difficulty-input');
        this.generateBtn = document.getElementById('alg-generate-btn');
        this.generateBtnText = this.generateBtn.querySelector('.btn-text');
        this.generateBtnSpinner = this.generateBtn.querySelector('.alg-spinner');

        // Content panels
        this.emptyState = document.getElementById('alg-empty-state');
        this.skeletonLoader = document.getElementById('alg-skeleton-loader');
        this.renderingArea = document.getElementById('alg-rendering-area');

        // Rendering targets
        this.badgesContainer = document.getElementById('alg-badges');
        this.questionTextEl = document.getElementById('alg-question-text');
        this.questionPartsEl = document.getElementById('alg-question-parts');
        this.solutionStepsEl = document.getElementById('alg-solution-steps');
        this.finalAnswerEl = document.getElementById('alg-final-answer-value');
        this.markingContentEl = document.getElementById('alg-marking-content');
        this.totalMarksEl = document.getElementById('alg-total-marks');

        // Toast
        this.toastContainer = document.getElementById('alg-toast-container');

        // Save / Export buttons
        this.saveBtn = document.getElementById('alg-save-btn');
        this.exportJsonBtn = document.getElementById('alg-export-json-btn');
        this.exportTxtBtn = document.getElementById('alg-export-txt-btn');
    }

    populateTopics() {
        const topics = Object.keys(TOPIC_SUBTOPICS);
        this.topicSelect.innerHTML = '';
        topics.forEach(topic => {
            const opt = document.createElement('option');
            opt.value = topic;
            opt.textContent = topic;
            this.topicSelect.appendChild(opt);
        });

        // Initialize subtopics for the first topic
        this.updateSubtopics();
    }

    updateSubtopics() {
        const selectedTopic = this.topicSelect.value;
        const subtopics = TOPIC_SUBTOPICS[selectedTopic] || [];
        this.subtopicSelect.innerHTML = '';
        subtopics.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub;
            opt.textContent = sub;
            this.subtopicSelect.appendChild(opt);
        });
    }

    attachEvents() {
        this.generateBtn.addEventListener('click', () => this.handleGenerate());
        this.topicSelect.addEventListener('change', () => this.updateSubtopics());
        this.saveBtn.addEventListener('click', () => this.handleSave());
        this.exportJsonBtn.addEventListener('click', () => this.handleExport('json'));
        this.exportTxtBtn.addEventListener('click', () => this.handleExport('txt'));

        // Re-trigger MathJax when <details> sections are expanded
        document.querySelectorAll('details.alg-solution-section, details.alg-marking-section').forEach(details => {
            details.addEventListener('toggle', () => {
                if (details.open) {
                    this.typesetMathJax(details);
                }
            });
        });
    }

    async loadApiKey() {
        try {
            const res = await fetch('/api/gemini-key');
            if (!res.ok) throw new Error('Key endpoint not available');
            const data = await res.json();
            this.apiKey = data.key || '';
        } catch (e) {
            this.apiKey = localStorage.getItem('GEMINI_API_KEY') || '';
            if (!this.apiKey) {
                console.warn('GEMINI_API_KEY not found.');
                this.showToast('未找到 API Key，請在 .env 設定 GEMINI_API_KEY 並重啟伺服器。', 'error');
            }
        }
    }

    showToast(message, type = 'error') {
        const toast = document.createElement('div');
        toast.className = `alg-toast ${type}`;
        toast.textContent = message;
        this.toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4500);
    }

    setLoadingState(isLoading) {
        if (isLoading) {
            this.generateBtn.disabled = true;
            this.generateBtnText.style.display = 'none';
            this.generateBtnSpinner.style.display = 'block';
            this.emptyState.classList.add('alg-style-hidden');
            this.renderingArea.classList.add('alg-style-hidden');
            this.skeletonLoader.classList.remove('alg-style-hidden');
        } else {
            this.generateBtn.disabled = false;
            this.generateBtnText.style.display = 'block';
            this.generateBtnSpinner.style.display = 'none';
            this.skeletonLoader.classList.add('alg-style-hidden');
        }
    }

    async handleGenerate() {
        if (!this.apiKey) {
            await this.loadApiKey();
        }
        if (!this.apiKey) {
            this.showToast('未找到 API Key，請確認 .env 已設定 GEMINI_API_KEY 並重啟伺服器。', 'error');
            return;
        }

        const topic = this.topicSelect.value;
        const subtopic = this.subtopicSelect.value;
        const difficulty = this.difficultySelect.value;

        this.setLoadingState(true);
        const aiService = new AlgebraAIService(this.apiKey);

        try {
            const data = await aiService.generateQuestion(topic, subtopic, difficulty);
            this.currentQuestionData = data;
            this.renderAll();
            this.renderingArea.classList.remove('alg-style-hidden');
            this.showToast('題目生成成功！', 'success');
        } catch (error) {
            console.error(error);
            this.showToast('題目生成失敗: ' + error.message, 'error');
            this.emptyState.classList.remove('alg-style-hidden');
        } finally {
            this.setLoadingState(false);
        }
    }

    renderAll() {
        if (!this.currentQuestionData) return;
        this.renderBadges();
        this.renderQuestion();
        this.renderSolution();
        this.renderMarkingScheme();
    }

    renderBadges() {
        const { metadata } = this.currentQuestionData;
        this.badgesContainer.innerHTML = `
            <span class="alg-topic-badge topic">${metadata.subtopic || metadata.topic}</span>
            <span class="alg-topic-badge difficulty">${metadata.difficulty}</span>
        `;
    }

    renderQuestion() {
        const { question } = this.currentQuestionData;

        // Render main question text
        let htmlContent = question.text;
        htmlContent = htmlContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
        htmlContent = '<p>' + htmlContent + '</p>';
        this.questionTextEl.innerHTML = htmlContent;

        // Render parts (a)(b)(c)
        this.questionPartsEl.innerHTML = '';
        const parts = question.parts || [];
        if (parts.length > 0) {
            parts.forEach(part => {
                const div = document.createElement('div');
                div.className = 'alg-question-part';
                div.innerHTML = `
                    <span class="alg-part-label">${part.label}</span>
                    <span class="alg-part-text">${part.text}</span>
                    <span class="alg-part-marks">${part.marks} 分</span>
                `;
                this.questionPartsEl.appendChild(div);
            });
        }

        // Trigger MathJax
        this.typesetMathJax(this.questionTextEl);
        this.typesetMathJax(this.questionPartsEl);
    }

    renderSolution() {
        const { solution } = this.currentQuestionData;
        this.solutionStepsEl.innerHTML = '';

        solution.steps.forEach((step, index) => {
            const div = document.createElement('div');
            div.className = 'alg-solution-step';
            div.innerHTML = `
                <span class="alg-step-number">${index + 1}</span>
                <div class="alg-step-content">
                    <div class="alg-step-desc">${this.ensureLatexDelimiters(step.description)}</div>
                    <div class="alg-step-expr">$${this.stripDelimiters(step.expression)}$</div>
                </div>
            `;
            this.solutionStepsEl.appendChild(div);
        });

        // Final answer — always wrap in $ delimiters
        const finalAns = solution.final_answer || '';
        this.finalAnswerEl.innerHTML = `$${this.stripDelimiters(finalAns)}$`;

        // Trigger MathJax for all solution content
        this.typesetMathJax(this.solutionStepsEl);
        this.typesetMathJax(this.finalAnswerEl);
    }

    renderMarkingScheme() {
        const { marking_scheme } = this.currentQuestionData;
        this.markingContentEl.innerHTML = '';
        this.totalMarksEl.textContent = `Total: ${marking_scheme.total_marks} marks`;

        marking_scheme.steps.forEach(step => {
            const div = document.createElement('div');
            div.className = 'alg-mark-step';
            div.innerHTML = `
                <span class="alg-mark-desc">${this.ensureLatexDelimiters(step.description)}</span>
                <span class="alg-mark-score">${step.marks}${step.markType}</span>
            `;
            this.markingContentEl.appendChild(div);
        });

        this.typesetMathJax(this.markingContentEl);
    }

    /**
     * Strips existing $ delimiters from a string so we can re-wrap uniformly.
     */
    stripDelimiters(text) {
        return text.replace(/^\$+/, '').replace(/\$+$/, '').trim();
    }

    /**
     * Ensures LaTeX commands within text are wrapped in $ delimiters.
     * Detects common LaTeX patterns (\frac, \sqrt, \Delta, etc.) and wraps them.
     */
    ensureLatexDelimiters(text) {
        if (!text) return '';
        // If already contains $ delimiters, leave it alone
        if (text.includes('$')) return text;
        // Check for common LaTeX command patterns
        const latexPattern = /\\(frac|sqrt|Delta|implies|times|div|leq|geq|neq|pm|mp|cdot|ldots|infty|sum|prod|int|lim|sin|cos|tan|log|ln|alpha|beta|gamma|theta|pi|sigma|omega|left|right|text|mathrm|mathbf)/;
        if (latexPattern.test(text)) {
            return `$${text}$`;
        }
        // Check for patterns like x^2, a_n, etc.
        if (/[a-zA-Z][_^]/.test(text) || /\{.*\}/.test(text)) {
            return `$${text}$`;
        }
        return text;
    }

    typesetMathJax(element) {
        if (window.MathJax && window.MathJax.typesetPromise) {
            // Clear MathJax's internal record of this element to allow re-typesetting
            if (window.MathJax.typesetClear) {
                window.MathJax.typesetClear([element]);
            }
            window.MathJax.typesetPromise([element]).catch(err => {
                console.warn('MathJax typeset warning:', err);
            });
        }
    }

    // ── Save / Export ─────────────────────────────────
    async handleSave() {
        if (!this.currentQuestionData) {
            this.showToast('尚未生成題目，無法儲存。', 'error');
            return;
        }
        try {
            this.saveBtn.disabled = true;
            this.saveBtn.textContent = '⏳ 儲存中…';
            await DBService.saveProblem('algebra', this.currentQuestionData, {}, {
                topic: this.topicSelect.value,
                subtopic: this.subtopicSelect.value,
                difficulty: this.difficultySelect.value
            });
            this.showToast('✅ 題目已儲存到題庫！', 'success');
        } catch (err) {
            console.error(err);
            this.showToast('儲存失敗：' + err.message, 'error');
        } finally {
            this.saveBtn.disabled = false;
            this.saveBtn.textContent = '💾 儲存題目';
        }
    }

    async handleExport(format) {
        if (!this.currentQuestionData) {
            this.showToast('尚未生成題目，無法導出。', 'error');
            return;
        }
        const pseudoRow = {
            id: crypto.randomUUID(),
            type: 'algebra',
            topic: this.topicSelect.value,
            subtopic: this.subtopicSelect.value,
            difficulty: this.difficultySelect.value,
            question_data: this.currentQuestionData,
            variables: {}
        };
        try {
            DBService.exportProblem(pseudoRow, format);
            this.showToast(`📥 已導出 ${format.toUpperCase()} 檔案`, 'success');
        } catch (err) {
            this.showToast('導出失敗：' + err.message, 'error');
        }
    }
}

// ==========================================
// Bootstrap
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    window.algebraApp = new DSEAlgebraController();
});
