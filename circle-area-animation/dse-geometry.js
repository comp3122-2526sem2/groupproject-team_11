/**
 * dse-geometry.js
 * Frontend logic for DSE Dynamic Geometry Generator
 * Ported from dse-geometry/core TypeScript models to Vanilla JS
 */

// ==========================================
// 0. Validation System
// ==========================================

/**
 * SchemaValidator — 檢查 LLM 輸出的 JSON 結構完整性
 */
class SchemaValidator {
    validate(data) {
        const errors = [];
        const warnings = [];

        // 1. Top-level structure
        if (!data || typeof data !== 'object') {
            errors.push('JSON 最頂層不是物件');
            return { errors, warnings };
        }
        if (!data.geometry_state) errors.push('缺少 geometry_state');
        if (!data.question_template) errors.push('缺少 question_template');
        if (!data.marking_scheme) errors.push('缺少 marking_scheme');
        if (!data.controls) errors.push('缺少 controls');

        if (errors.length > 0) return { errors, warnings };

        const gs = data.geometry_state;

        // 2. Variables must be a record of numbers
        if (!gs.variables || typeof gs.variables !== 'object') {
            errors.push('geometry_state.variables 缺少或不是物件');
        }

        // 3. Points
        if (!gs.points || typeof gs.points !== 'object') {
            errors.push('geometry_state.points 缺少或不是物件');
        } else {
            const pointIds = Object.keys(gs.points);
            for (const [id, def] of Object.entries(gs.points)) {
                if (!['absolute', 'polar', 'polar_eval'].includes(def.type)) {
                    errors.push(`點 ${id} 的 type "${def.type}" 不合法 (需為 absolute/polar/polar_eval)`);
                }
                if (def.type === 'polar' || def.type === 'polar_eval') {
                    if (!pointIds.includes(def.refOrigin) && def.refOrigin !== id) {
                        errors.push(`點 ${id} 的 refOrigin "${def.refOrigin}" 未定義`);
                    }
                    if (gs.variables && def.radiusVar && !(def.radiusVar in gs.variables)) {
                        errors.push(`點 ${id} 的 radiusVar "${def.radiusVar}" 不在 variables 中`);
                    }
                    if (def.type === 'polar' && gs.variables && def.angleVar && !(def.angleVar in gs.variables)) {
                        errors.push(`點 ${id} 的 angleVar "${def.angleVar}" 不在 variables 中`);
                    }
                }
            }
        }

        // 4. Elements — check references
        const elements = gs.elements || {};
        const allPointIds = gs.points ? Object.keys(gs.points) : [];

        if (elements.lines) {
            elements.lines.forEach((l, i) => {
                if (!allPointIds.includes(l.from)) errors.push(`lines[${i}].from "${l.from}" 未定義`);
                if (!allPointIds.includes(l.to)) errors.push(`lines[${i}].to "${l.to}" 未定義`);
            });
        }
        if (elements.circles) {
            elements.circles.forEach((c, i) => {
                if (!allPointIds.includes(c.center)) errors.push(`circles[${i}].center "${c.center}" 未定義`);
                if (gs.variables && typeof c.radiusVar === 'string' && !(c.radiusVar in gs.variables)) {
                    errors.push(`circles[${i}].radiusVar "${c.radiusVar}" 不在 variables 中`);
                }
            });
        }
        if (elements.labels) {
            elements.labels.forEach((lb, i) => {
                if (!allPointIds.includes(lb.point)) {
                    warnings.push(`labels[${i}].point "${lb.point}" 未定義，標籤可能無法正確顯示`);
                }
            });
        }

        // 5. Controls — slider targetVariable must exist
        if (data.controls?.sliders) {
            data.controls.sliders.forEach((s, i) => {
                if (gs.variables && !(s.targetVariable in gs.variables)) {
                    errors.push(`sliders[${i}].targetVariable "${s.targetVariable}" 不在 variables 中`);
                }
            });
        }

        // 6. Question template
        if (!data.question_template?.text || data.question_template.text.trim() === '') {
            errors.push('question_template.text 為空');
        }

        // 7. Marking scheme
        if (!data.marking_scheme?.steps || data.marking_scheme.steps.length === 0) {
            warnings.push('marking_scheme.steps 為空，沒有評分步驟');
        }

        return { errors, warnings };
    }
}

/**
 * GeometryValidator — 檢查解算後的座標是否符合幾何約束
 */
class GeometryValidator {
    validate(resolvedPoints, geometryState, variables) {
        const errors = [];
        const warnings = [];

        // 1. NaN / Infinity 檢測
        for (const [id, coords] of resolvedPoints) {
            if (isNaN(coords.x) || isNaN(coords.y)) {
                errors.push(`點 ${id} 的座標包含 NaN (x=${coords.x}, y=${coords.y})`);
            }
            if (!isFinite(coords.x) || !isFinite(coords.y)) {
                errors.push(`點 ${id} 的座標包含 Infinity`);
            }
        }

        // 2. 座標範圍驗證 (viewBox: -200 to 200)
        for (const [id, coords] of resolvedPoints) {
            if (Math.abs(coords.x) > 200 || Math.abs(coords.y) > 200) {
                warnings.push(`點 ${id} 座標 (${coords.x.toFixed(1)}, ${coords.y.toFixed(1)}) 超出 viewBox 範圍`);
            }
        }

        // 3. 點重疊檢測 (min distance threshold = 5px)
        const pointEntries = [...resolvedPoints.entries()];
        for (let i = 0; i < pointEntries.length; i++) {
            for (let j = i + 1; j < pointEntries.length; j++) {
                const [id1, p1] = pointEntries[i];
                const [id2, p2] = pointEntries[j];
                const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                if (dist < 5) {
                    warnings.push(`點 ${id1} 和 ${id2} 幾乎重疊 (距離=${dist.toFixed(1)}px)`);
                }
            }
        }

        // 4. 「圓上的點」驗證：polar 類型指向圓心、且 radiusVar 與圓的 radiusVar 相同的點應在圓上
        const circles = geometryState.elements?.circles || [];
        for (const circle of circles) {
            const centerCoords = resolvedPoints.get(circle.center);
            if (!centerCoords) continue;
            const circleRadius = typeof circle.radiusVar === 'number' ? circle.radiusVar : (variables[circle.radiusVar] || 0);
            if (circleRadius <= 0) continue;

            // Check all polar points that reference this center with matching radiusVar
            for (const [pointId, def] of Object.entries(geometryState.points)) {
                if ((def.type === 'polar' || def.type === 'polar_eval') && def.refOrigin === circle.center && def.radiusVar === circle.radiusVar) {
                    const ptCoords = resolvedPoints.get(pointId);
                    if (!ptCoords) continue;
                    const distToCenter = Math.hypot(ptCoords.x - centerCoords.x, ptCoords.y - centerCoords.y);
                    const tolerance = circleRadius * 0.05; // 5% tolerance
                    if (Math.abs(distToCenter - circleRadius) > tolerance) {
                        errors.push(`點 ${pointId} 應在圓上 (距圓心=${distToCenter.toFixed(1)}, 半徑=${circleRadius})`);
                    }
                }
            }
        }

        // 5. 檢查所有點是否都有合理的分佈（不是全部擠在一個小區域）
        if (pointEntries.length >= 3) {
            const xs = pointEntries.map(([, p]) => p.x);
            const ys = pointEntries.map(([, p]) => p.y);
            const rangeX = Math.max(...xs) - Math.min(...xs);
            const rangeY = Math.max(...ys) - Math.min(...ys);
            if (rangeX < 20 && rangeY < 20) {
                warnings.push(`所有點集中在很小的區域 (${rangeX.toFixed(0)}x${rangeY.toFixed(0)}px)，圖形過小可能不清晰`);
            }
        }

        return { errors, warnings };
    }
}

/**
 * LatexValidator — 檢查 LaTeX 語法正確性
 */
class LatexValidator {
    /**
     * 預渲染語法檢查
     */
    validateSyntax(text) {
        const warnings = [];

        if (!text || text.trim() === '') return { warnings };

        // 1. 檢查 $...$ 是否成對
        const dollarMatches = text.match(/(?<!\\)\$/g) || [];
        if (dollarMatches.length % 2 !== 0) {
            warnings.push(`LaTeX 的 $ 符號不成對 (共 ${dollarMatches.length} 個)，可能導致渲染錯誤`);
        }

        // 2. 檢查 $$...$$ 成對
        const doubleDollarMatches = text.match(/\$\$/g) || [];
        if (doubleDollarMatches.length % 2 !== 0) {
            warnings.push(`LaTeX 的 $$ 符號不成對 (共 ${doubleDollarMatches.length} 個)`);
        }

        // 3. 檢查常見 LaTeX 命令拼寫
        const commonCommands = {
            '\\anlge': '\\angle',
            '\\angele': '\\angle',
            '\\tirangle': '\\triangle',
            '\\traingle': '\\triangle',
            '\\cric': '\\circ',
            '\\degre': '\\degree',
        };
        for (const [wrong, correct] of Object.entries(commonCommands)) {
            if (text.includes(wrong.replace(/\\\\/g, '\\'))) {
                warnings.push(`可能的 LaTeX 拼寫錯誤："${wrong.replace(/\\\\/g, '\\')}"，應為 "${correct.replace(/\\\\/g, '\\')}"`);
            }
        }

        // 4. 檢查未閉合的 \left \right
        const leftCount = (text.match(/\\left/g) || []).length;
        const rightCount = (text.match(/\\right/g) || []).length;
        if (leftCount !== rightCount) {
            warnings.push(`\\left (${leftCount}) 和 \\right (${rightCount}) 不成對`);
        }

        return { warnings };
    }

    /**
     * 渲染後 DOM 檢查 — 偵測 MathJax 錯誤元素 AND 未渲染的 $...$ 原始文字
     */
    checkRenderedErrors(containerEl) {
        const errors = [];
        const warnings = [];
        
        // 1. Check for MathJax error elements
        const errorNodes = containerEl.querySelectorAll('mjx-merror');
        if (errorNodes.length > 0) {
            errorNodes.forEach((node, i) => {
                errors.push(`MathJax 渲染錯誤 #${i + 1}: "${node.textContent.trim().substring(0, 60)}"`);
            });
        }
        
        // 2. Check if raw $...$ delimiters are still visible in text nodes
        //    (means MathJax completely failed to process them)
        const textContent = containerEl.textContent || '';
        const rawDollarMatches = textContent.match(/\$[^$]+\$/g) || [];
        // Filter out false positives (MathJax processed content won't have $ in text nodes)
        const genuineRaw = rawDollarMatches.filter(m => {
            // Common LaTeX commands that indicate unrendered math
            return m.includes('\\angle') || m.includes('\\circ') || m.includes('\\frac') 
                || m.includes('\\triangle') || m.includes('\\sqrt') || m.includes('\\pi')
                || /\$[A-Z]{1,3}\$/.test(m); // single letters like $A$, $AC$
        });
        if (genuineRaw.length > 0) {
            errors.push(`MathJax 未能渲染 ${genuineRaw.length} 個公式，$ 符號仍然可見: ${genuineRaw.slice(0, 3).join(', ')}${genuineRaw.length > 3 ? '...' : ''}`);
        }
        
        return { errors, warnings };
    }
}

/**
 * ValidationReport — 匯整所有驗證結果
 */
class ValidationReport {
    constructor() {
        this.sections = []; // { name, errors: [], warnings: [], passed: bool }
    }

    addSection(name, errors, warnings) {
        this.sections.push({
            name,
            errors: errors || [],
            warnings: warnings || [],
            passed: (!errors || errors.length === 0)
        });
    }

    get hasErrors() {
        return this.sections.some(s => s.errors.length > 0);
    }

    get hasWarnings() {
        return this.sections.some(s => s.warnings.length > 0);
    }

    get allPassed() {
        return !this.hasErrors && !this.hasWarnings;
    }

    /** Generate error summary for self-healing prompt injection */
    toErrorSummary() {
        const lines = [];
        for (const section of this.sections) {
            for (const err of section.errors) {
                lines.push(`[${section.name}] ERROR: ${err}`);
            }
        }
        return lines.join('\n');
    }
}


// ==========================================
// 1. Core Logic: LLM Service
// ==========================================
class AIGenerationService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.modelName = 'gemini-3-flash-preview'; // 使用具備 Reasoning/Thinking 能力的 Gemini 3 Flash 模型
    }

    async generateQuestion(topic, difficulty, promptText, healingHints = '') {
        let systemInstruction = `
    你是一位專業的香港 DSE 數學科出題專家。
    請根據使用者提供的「主題」、「難度」與「自訂指令」，生成一題符合 DSE 格式的數學幾何題。
    
    【重要輸出規範】
    你必須且只能輸出一個合法的 JSON 物件，不可以包含任何 Markdown 標籤 (例如 \`\`\`json) 或其他廢話。
    該 JSON 必須符合以下結構：
    
    {
      "geometry_state": {
        "variables": { "變數名稱": 預設數值 (Number) },
        "points": {
          "點的ID例如A": { 
              "type": "absolute", "x": 0, "y": 0 
          } 或 { 
              "type": "polar", "refOrigin": "A", "radiusVar": "r", "angleVar": "theta" 
          } 或 { 
              "type": "polar_eval", "refOrigin": "A", "radiusVar": "r", "angleExpression": "theta / 2" 
          }
        },
        "elements": {
          "lines": [{ "from": "A", "to": "B" }],
          "circles": [{ "center": "A", "radiusVar": "r" }],
          "arcs": [{ "center": "A", "from": "B", "to": "C", "radius": 20 }],
          "labels": [{ "point": "A", "text": "A", "offset": { "x": -10, "y": -10 } }]
        }
      },
      "question_template": { "text": "題目文字，支援 LaTeX 公式 $...$。用 _{{var}}_ 來綁定變數以動態顯示。" },
      "marking_scheme": { 
        "steps": [
            { "description": "給分步驟描述，支援 LaTeX 公式 $...$", "marks": 1, "markType": "M" }
        ]
      },
      "controls": {
        "sliders": [
            { "targetVariable": "變數名稱", "label": "UI顯示標籤", "min": 1, "max": 100, "step": 1 }
        ]
      }
    }
    
    【LaTeX 規範】
    - question_template.text 和 marking_scheme.steps[].description 中的數學公式，必須用 $...$ 包裹。
    - 確保所有 $ 符號成對出現。
    - 使用標準 LaTeX 命令：\\angle, \\triangle, \\circ, \\frac{}{}, \\sqrt{} 等。
    - 度數符號請用 ^\\circ，例如 $90^\\circ$。
    - 變數佔位符 _{{var}}_ 裡只能放「已定義的變數名」，不能放運算式。
    - marking_scheme 的 description 裡，數值一律直接寫死（例如 $180^\\circ - 90^\\circ = 90^\\circ$），不要使用 _{{...}}_ 佔位符。
    - question_template.text 可使用 _{{var}}_ 來綁定 slider 控制的變數。
    
    【幾何約束規範】
    - 點 ID 彼此存在依賴時，不會產生循環依賴。
    - 預設一律將原點設為 center 或 (0,0)，並且合理佈局 x,y 給 viewBox (-200 -200 400 400)。所以座標系盡量介於 -150 到 150 之間。
    - 如果某些點聲稱在圓上，則其 polar 定義的 radiusVar 必須與對應 circle 的 radiusVar 一致。
    - 所有不同的點之間至少要有 10px 的距離，避免重疊。
    - JSON 格式必須完美無缺，能被 JSON.parse() 解析。`;

        // 如果有 self-healing hints (前次驗證失敗)，注入到 system instruction
        if (healingHints) {
            systemInstruction += `\n\n【前次生成的錯誤，請務必修正】\n${healingHints}`;
        }

        const userMessage = `主題：${topic}\n難度：${difficulty}\n指令：${promptText}`;

        const MAX_RETRIES = 2;
        let attempt = 0;

        while (attempt <= MAX_RETRIES) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system_instruction: { parts: [{ text: systemInstruction }] },
                        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
                        generationConfig: {
                            temperature: 0.2, // Low temp for structured JSON
                            responseMimeType: "application/json"
                        }
                    })
                });

                if (!response.ok) {
                    const errPayload = await response.json().catch(()=>({}));
                    throw new Error(`Gemini API Error (${response.status}): ${errPayload.error?.message || ''}`);
                }

                const data = await response.json();
                if (!data.candidates || data.candidates.length === 0) {
                    throw new Error("No candidates returned from Gemini");
                }

                const rawText = data.candidates[0].content.parts[0].text;
                const cleanedText = rawText.replace(/^\s*```json\s*/, '').replace(/\s*```\s*$/, '');
                
                return JSON.parse(cleanedText);
            } catch (error) {
                attempt++;
                console.error(`Attempt ${attempt} failed:`, error);
                if (attempt > MAX_RETRIES) {
                    throw error;
                }
            }
        }
    }
}

// ==========================================
// 2. Core Logic: Geometry Resolver
// ==========================================
class GeometryResolver {
    
    resolveCoordinates(points, variables) {
        const resolved = new Map();
        const processing = new Set();

        const resolvePoint = (pointId) => {
            if (resolved.has(pointId)) return resolved.get(pointId);
            if (processing.has(pointId)) throw new Error(`Circular dependency detected at point: ${pointId}`);

            processing.add(pointId);
            const def = points[pointId];

            if (!def) throw new Error(`Definition for point ${pointId} not found.`);

            let result;

            switch (def.type) {
                case 'absolute':
                    result = { x: def.x, y: def.y };
                    break;
                case 'polar': {
                    const originCoords = resolvePoint(def.refOrigin);
                    const r = variables[def.radiusVar];
                    const thetaDeg = variables[def.angleVar];

                    if (r === undefined || thetaDeg === undefined) {
                        throw new Error(`Missing variable for polar calculation: ${def.radiusVar} or ${def.angleVar}`);
                    }
                    
                    const thetaRad = thetaDeg * (Math.PI / 180);
                    result = {
                        x: originCoords.x + r * Math.cos(thetaRad),
                        y: originCoords.y + r * Math.sin(thetaRad)
                    };
                    break;
                }
                case 'polar_eval': {
                    const originCoords = resolvePoint(def.refOrigin);
                    const r = variables[def.radiusVar];
                    if (r === undefined) throw new Error(`Missing radius variable: ${def.radiusVar}`);

                    const thetaDeg = this.evaluateExpression(def.angleExpression, variables);
                    const thetaRad = thetaDeg * (Math.PI / 180);
                    
                    result = {
                        x: originCoords.x + r * Math.cos(thetaRad),
                        y: originCoords.y + r * Math.sin(thetaRad)
                    };
                    break;
                }
                default:
                    throw new Error(`Unknown point definition type for ${pointId}`);
            }

            processing.delete(pointId);
            resolved.set(pointId, result);
            return result;
        };

        for (const pointId of Object.keys(points)) {
            try {
                resolvePoint(pointId);
            } catch (e) {
                console.error(`Error resolving point ${pointId}:`, e);
            }
        }

        return resolved;
    }

    evaluateExpression(expression, variables) {
        try {
            const varNames = Object.keys(variables);
            const varValues = Object.values(variables);
            const mathFunc = new Function(...varNames, `return ${expression};`);
            const result = mathFunc(...varValues);
            
            if (isNaN(result)) throw new Error(`Expression resulted in NaN`);
            return result;
        } catch (e) {
            console.error(`Failed to evaluate expression: ${expression}`, e);
            throw new Error(`Evaluation error: ${e.message}`);
        }
    }
}

// ==========================================
// 3. UI Controller
// ==========================================
class DSEGeometryController {
    constructor() {
        this.resolver = new GeometryResolver();
        this.schemaValidator = new SchemaValidator();
        this.geometryValidator = new GeometryValidator();
        this.latexValidator = new LatexValidator();
        this.currentQuestionData = null;
        this.sliderVariables = {};
        this.resolvedPoints = new Map();
        this.lastValidationReport = null;
        this.apiKey = '';

        this.initDOM();
        this.attachEvents();
        this.loadApiKey(); // Auto-fetch from server
    }

    initDOM() {
        this.btnApiKey = document.getElementById('btn-api-key');
        // Hide the manual API key button — key is loaded automatically from server
        if (this.btnApiKey) this.btnApiKey.style.display = 'none';
        
        // Generator Form
        this.topicInput = document.getElementById('topic-input');
        this.difficultyInput = document.getElementById('difficulty-input');
        this.generateBtn = document.getElementById('generate-btn');
        this.generateBtnText = this.generateBtn.querySelector('.btn-text');
        this.generateBtnSpinner = this.generateBtn.querySelector('.spinner');
        
        // Panels
        this.emptyState = document.getElementById('empty-state');
        this.skeletonLoader = document.getElementById('skeleton-loader');
        this.renderingArea = document.getElementById('rendering-area');
        this.slidersContent = document.getElementById('sliders-content');
        
        // Rendering Targets
        this.questionDescription = document.getElementById('question-description');
        this.svgElements = document.getElementById('svg-elements');
        this.markingContent = document.getElementById('marking-content');
        this.toastContainer = document.getElementById('toast-container');
        this.validationReportContent = document.getElementById('validation-report-content');
    }

    attachEvents() {
        this.generateBtn.addEventListener('click', () => this.handleGenerate());
    }

    async loadApiKey() {
        try {
            const res = await fetch('/api/gemini-key');
            if (!res.ok) throw new Error('Key endpoint not available');
            const data = await res.json();
            this.apiKey = data.key || '';
        } catch (e) {
            // Fallback: try localStorage for backward compatibility
            this.apiKey = localStorage.getItem('GEMINI_API_KEY') || '';
            if (!this.apiKey) {
                console.warn('GEMINI_API_KEY not found. Add it to .env and restart the server.');
                this.showToast('未找到 API Key，請在 .env 設定 GEMINI_API_KEY 並重啟伺服器。', 'error');
            }
        }
    }

    showToast(message, type = 'error') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        this.toastContainer.appendChild(toast);
        
        // trigger animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    setLoadingState(isLoading) {
        if (isLoading) {
            this.generateBtn.disabled = true;
            this.generateBtnText.style.display = 'none';
            this.generateBtnSpinner.style.display = 'block';
            
            this.emptyState.classList.add('style-hidden');
            this.renderingArea.classList.add('style-hidden');
            this.skeletonLoader.classList.remove('style-hidden');
            
            this.slidersContent.innerHTML = '<div class="empty-text">載入中...</div>';
        } else {
            this.generateBtn.disabled = false;
            this.generateBtnText.style.display = 'block';
            this.generateBtnSpinner.style.display = 'none';
            
            this.skeletonLoader.classList.add('style-hidden');
            // We only show renderingArea if data exists, handled in handleGenerate
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

        const topic = this.topicInput.value;
        const difficulty = this.difficultyInput.value;
        const promptText = '請自動出題';

        this.setLoadingState(true);
        const aiService = new AIGenerationService(this.apiKey);

        const HEAL_MAX_RETRIES = 2;
        let healAttempt = 0;
        let healingHints = '';

        while (healAttempt <= HEAL_MAX_RETRIES) {
            try {
                const data = await aiService.generateQuestion(topic, difficulty, promptText, healingHints);

                // === Phase 1: Schema Validation ===
                const schemaResult = this.schemaValidator.validate(data);
                const report = new ValidationReport();
                report.addSection('Schema 結構驗證', schemaResult.errors, schemaResult.warnings);

                if (schemaResult.errors.length > 0) {
                    // Fatal schema error — try self-healing
                    healingHints = report.toErrorSummary();
                    healAttempt++;
                    console.warn(`Schema validation failed (attempt ${healAttempt}):`, schemaResult.errors);
                    if (healAttempt > HEAL_MAX_RETRIES) {
                        this.showToast('題目結構驗證失敗（已重試），請更換主題或難度。', 'error');
                        this.lastValidationReport = report;
                        this.renderValidationReport();
                        this.emptyState.classList.remove('style-hidden');
                        break;
                    }
                    continue; // retry
                }

                this.currentQuestionData = data;
                this.sliderVariables = { ...data.geometry_state.variables };

                // === Phase 2: Geometry Validation ===
                try {
                    const tempResolved = this.resolver.resolveCoordinates(
                        data.geometry_state.points, this.sliderVariables
                    );
                    const geoResult = this.geometryValidator.validate(
                        tempResolved, data.geometry_state, this.sliderVariables
                    );
                    report.addSection('幾何約束驗證', geoResult.errors, geoResult.warnings);

                    if (geoResult.errors.length > 0) {
                        healingHints = report.toErrorSummary();
                        healAttempt++;
                        console.warn(`Geometry validation failed (attempt ${healAttempt}):`, geoResult.errors);
                        if (healAttempt > HEAL_MAX_RETRIES) {
                            // Render anyway but show errors
                            this.lastValidationReport = report;
                            this.renderUI();
                            this.renderValidationReport();
                            this.renderingArea.classList.remove('style-hidden');
                            this.showToast('幾何約束檢測到問題，請查看驗證報告。', 'error');
                            break;
                        }
                        continue; // retry
                    }
                } catch (resolveErr) {
                    report.addSection('座標解算', [resolveErr.message], []);
                    healingHints = report.toErrorSummary();
                    healAttempt++;
                    if (healAttempt > HEAL_MAX_RETRIES) {
                        this.lastValidationReport = report;
                        this.renderValidationReport();
                        this.showToast('座標解算失敗（已重試），請更換主題。', 'error');
                        this.emptyState.classList.remove('style-hidden');
                        break;
                    }
                    continue;
                }

                // === Phase 3: LaTeX Pre-check ===
                const questionLatex = this.latexValidator.validateSyntax(data.question_template?.text || '');
                const markingTexts = (data.marking_scheme?.steps || []).map(s => s.description).join(' ');
                const markingLatex = this.latexValidator.validateSyntax(markingTexts);
                report.addSection('LaTeX 語法檢查',
                    [],
                    [...questionLatex.warnings, ...markingLatex.warnings]
                );

                // === All validations passed (or only warnings) ===
                this.lastValidationReport = report;
                this.renderUI();
                this.renderValidationReport();
                this.renderingArea.classList.remove('style-hidden');

                // === Phase 4: Post-render LaTeX check (delayed) ===
                setTimeout(() => {
                    const qResult = this.latexValidator.checkRenderedErrors(this.questionDescription);
                    const mResult = this.latexValidator.checkRenderedErrors(this.markingContent);
                    const postErrors = [...(qResult.errors || []), ...(mResult.errors || [])];
                    const postWarnings = [...(qResult.warnings || []), ...(mResult.warnings || [])];
                    if (postErrors.length > 0 || postWarnings.length > 0) {
                        report.addSection('MathJax 渲染後檢查', postErrors, postWarnings);
                        this.lastValidationReport = report;
                        this.renderValidationReport();
                        if (postErrors.length > 0) {
                            this.showToast('❌ MathJax 渲染失敗，部分公式未顯示。', 'error');
                        }
                    }
                }, 3000); // Wait for MathJax async render

                if (report.allPassed) {
                    this.showToast('✅ 題目生成成功，所有驗證通過！', 'success');
                } else if (!report.hasErrors && report.hasWarnings) {
                    this.showToast('⚠️ 題目已生成，但有部份警告，請查看驗證報告。', 'success');
                }
                break; // success, exit loop

            } catch (error) {
                console.error(error);
                this.showToast('題目生成失敗: ' + error.message, 'error');
                this.emptyState.classList.remove('style-hidden');
                break;
            }
        }

        this.setLoadingState(false);
    }

    renderUI() {
        if (!this.currentQuestionData) return;

        // 1. Render Sliders
        this.slidersContent.innerHTML = '';
        const controls = this.currentQuestionData.controls?.sliders || [];
        
        if (controls.length === 0) {
            this.slidersContent.innerHTML = '<div class="empty-text">沒有動態操作項</div>';
        }

        controls.forEach(control => {
            const val = this.sliderVariables[control.targetVariable];
            const div = document.createElement('div');
            div.className = 'slider-group';
            div.innerHTML = `
                <div class="slider-header">
                    <span>${control.label}</span>
                    <span class="slider-val" id="val-${control.targetVariable}">${val}</span>
                </div>
                <input type="range" 
                    id="slider-${control.targetVariable}" 
                    min="${control.min}" 
                    max="${control.max}" 
                    step="${control.step}" 
                    value="${val}">
            `;
            
            const input = div.querySelector('input');
            const valDisplay = div.querySelector('.slider-val');
            
            input.addEventListener('input', (e) => {
                const newVal = parseFloat(e.target.value);
                valDisplay.textContent = newVal;
                this.sliderVariables[control.targetVariable] = newVal;
                this.updateGeometry();
            });
            
            this.slidersContent.appendChild(div);
        });

        // 2. Question text is rendered via updateGeometry()->updateQuestionText()
        //    Do NOT call updateQuestionText() here to avoid MathJax race condition

        // 3. Render Marking Scheme (with LaTeX support)
        this.markingContent.innerHTML = '';
        const steps = this.currentQuestionData.marking_scheme?.steps || [];
        steps.forEach(step => {
            const div = document.createElement('div');
            div.className = 'mark-step';
            // Replace variables in marking scheme description
            let desc = step.description;
            // Sort keys by length descending to avoid partial matches
            const sortedKeys = Object.keys(this.sliderVariables).sort((a, b) => b.length - a.length);
            sortedKeys.forEach(key => {
                const val = this.sliderVariables[key];
                desc = desc.replace(new RegExp(`_\\{\\{${key}\\}\\}_`, 'g'), String(val));
                desc = desc.replace(new RegExp(`_\\{\\{${key}\\}\\}`, 'g'), String(val));
                desc = desc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val));
                desc = desc.replace(new RegExp(`_\\{${key}\\}`, 'g'), String(val));
            });
            // Handle expression placeholders like _{{90 - angleCBD}}_ 
            // by evaluating the expression with current variable values
            desc = desc.replace(/_\{\{([^}]+)\}\}_/g, (match, expr) => {
                try {
                    let evalExpr = expr;
                    sortedKeys.forEach(k => {
                        evalExpr = evalExpr.replace(new RegExp(k, 'g'), String(this.sliderVariables[k]));
                    });
                    const result = Function('return (' + evalExpr + ')')();
                    return isNaN(result) ? match : String(result);
                } catch { return match; }
            });
            // Clean orphaned underscores before digits
            desc = desc.replace(/([=\s])_(\d)/g, '$1$2');
            div.innerHTML = `
                <span class="mark-desc">${desc}</span>
                <span class="mark-score">${step.marks}${step.markType}</span>
            `;
            this.markingContent.appendChild(div);
        });

        // Trigger MathJax on marking scheme — must clear first, then typeset
        this.typesetElement(this.markingContent);

        // 4. Update core SVG
        this.updateGeometry();
    }

    updateQuestionText() {
        if (!this.currentQuestionData) return;
        
        let text = this.currentQuestionData.question_template.text;
        
        // Sort variable keys by length descending to avoid partial matches
        const sortedKeys = Object.keys(this.sliderVariables).sort((a, b) => b.length - a.length);
        
        // Comprehensive variable replacement — handles all known LLM output patterns
        sortedKeys.forEach(key => {
            const val = this.sliderVariables[key];
            // Pattern 1: _{{var}}_ (standard documented format)
            text = text.replace(new RegExp(`_\\{\\{${key}\\}\\}_`, 'g'), String(val));
            // Pattern 2: _{{var}} (no trailing underscore)
            text = text.replace(new RegExp(`_\\{\\{${key}\\}\\}`, 'g'), String(val));
            // Pattern 3: {{var}} (no underscores)
            text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val));
            // Pattern 4: _{var} (LaTeX subscript-like, common in $...$ blocks)
            text = text.replace(new RegExp(`_\\{${key}\\}`, 'g'), String(val));
        });
        
        // Clean up any LaTeX artifacts from replacement:
        // e.g. if after replacement we get "= _30" → fix to "= 30"  
        // Remove orphaned underscore before a digit (outside of valid LaTeX subscript context)
        // This handles cases like "$\angle X = _30^\circ$" → "$\angle X = 30^\circ$"
        text = text.replace(/([=\s])_(\d)/g, '$1$2');

        // Convert newlines
        let htmlContent = text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
        htmlContent = '<p>' + htmlContent + '</p>';

        this.questionDescription.innerHTML = htmlContent;
        
        // Re-run MathJax rendering — clear previous state first
        this.typesetElement(this.questionDescription);
    }

    /**
     * Helper: safely typeset an element with MathJax 3.
     * Clears previous typeset state first to avoid stale output.
     */
    typesetElement(el) {
        if (!window.MathJax) return;
        // MathJax 3 may still be loading
        if (window.MathJax.typesetClear && window.MathJax.typesetPromise) {
            MathJax.typesetClear([el]);
            MathJax.typesetPromise([el]).catch(err => console.warn('MathJax typeset error:', err));
        } else {
            // MathJax not ready yet — retry after a delay
            setTimeout(() => this.typesetElement(el), 500);
        }
    }

    updateGeometry() {
        if (!this.currentQuestionData) return;

        try {
            // Recalculate all coordinates
            this.resolvedPoints = this.resolver.resolveCoordinates(
                this.currentQuestionData.geometry_state.points,
                this.sliderVariables
            );

            this.renderSVG();
            this.updateQuestionText();
        } catch (error) {
            console.error("Geometry Resolve Error:", error);
        }
    }

    renderSVG() {
        const elements = this.currentQuestionData.geometry_state.elements || {};
        this.svgElements.innerHTML = ''; // Clear SVG

        // Helper to get {x,y}
        const getPt = (id) => this.resolvedPoints.get(id) || {x:0, y:0};

        // Draw circles
        if (elements.circles) {
            elements.circles.forEach(c => {
                const center = getPt(c.center);
                let r = 0;
                // radius can be a number or a mapped variable
                if (typeof c.radiusVar === 'number') r = c.radiusVar;
                else r = this.sliderVariables[c.radiusVar] || 0;
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', center.x);
                // Note: Standard math: Y is up, SVG Y is down. 
                // Gemini generated coordinates without knowing. 
                // Let's standardly flip Y for presentation so +y is up mathematically
                circle.setAttribute('cy', -center.y);
                circle.setAttribute('r', r);
                circle.setAttribute('class', 'geom-circle');
                this.svgElements.appendChild(circle);
            });
        }

        // Draw Lines
        if (elements.lines) {
            elements.lines.forEach(l => {
                const pt1 = getPt(l.from);
                const pt2 = getPt(l.to);
                
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', pt1.x);
                line.setAttribute('y1', -pt1.y);
                line.setAttribute('x2', pt2.x);
                line.setAttribute('y2', -pt2.y);
                line.setAttribute('class', 'geom-line');
                
                // Add arrow marker if requested (we can extend spec to allow l.arrow)
                if (l.arrow) line.setAttribute('marker-end', 'url(#arrow)');
                
                this.svgElements.appendChild(line);
            });
        }

        // Draw Arcs (Requires SVG Path Math)
        if (elements.arcs) {
            elements.arcs.forEach(a => {
                const center = getPt(a.center);
                const p1 = getPt(a.from);
                const p2 = getPt(a.to);
                const r = a.radius;
                
                // Angle logic: from center to p1, center to p2
                const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
                let a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
                
                // Quick hack simple SVG arc from angle a1 to a2 at distance r
                // SVG Y is inverted
                const startX = center.x + r * Math.cos(a1);
                const startY = -(center.y + r * Math.sin(a1));
                const endX = center.x + r * Math.cos(a2);
                const endY = -(center.y + r * Math.sin(a2));
                
                // Determine sweep flag (simplified)
                let diff = a2 - a1;
                while (diff <= -Math.PI) diff += 2 * Math.PI;
                while (diff > Math.PI) diff -= 2 * Math.PI;
                const largeArc = Math.abs(diff) > Math.PI ? 1 : 0;
                const sweep = diff > 0 ? 0 : 1; // Flipped Y makes sweep flip
                
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} ${sweep} ${endX} ${endY}`);
                path.setAttribute('class', 'geom-arc');
                this.svgElements.appendChild(path);
            });
        }

        // Draw points (optional debugging overlay or explicit UI)
        this.resolvedPoints.forEach((coords, id) => {
            const pt = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            pt.setAttribute('cx', coords.x);
            pt.setAttribute('cy', -coords.y);
            pt.setAttribute('r', 3);
            pt.setAttribute('class', 'geom-point');
            this.svgElements.appendChild(pt);
        });

        // Draw Labels
        if (elements.labels) {
            elements.labels.forEach(lb => {
                const pt = getPt(lb.point);
                const offset = lb.offset || {x: 0, y: 0};
                
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', pt.x + offset.x);
                text.setAttribute('y', -pt.y - offset.y); // Y is flipped
                text.setAttribute('class', 'geom-label');
                text.textContent = lb.text;
                this.svgElements.appendChild(text);
            });
        }
    }

    // ==========================================
    // Validation Report Renderer
    // ==========================================
    renderValidationReport() {
        if (!this.validationReportContent || !this.lastValidationReport) return;

        const report = this.lastValidationReport;
        this.validationReportContent.innerHTML = '';

        if (report.allPassed) {
            this.validationReportContent.innerHTML = `
                <div class="validation-all-pass">
                    <span class="validation-icon">✅</span>
                    <span>所有驗證項目通過</span>
                </div>`;
            return;
        }

        report.sections.forEach(section => {
            if (section.errors.length === 0 && section.warnings.length === 0) {
                // Passed section
                const row = document.createElement('div');
                row.className = 'validation-row pass';
                row.innerHTML = `<span class="validation-icon">✅</span><span class="validation-name">${section.name}</span>`;
                this.validationReportContent.appendChild(row);
                return;
            }

            // Section with issues
            const sectionEl = document.createElement('div');
            sectionEl.className = 'validation-section';

            const header = document.createElement('div');
            header.className = `validation-row ${section.errors.length > 0 ? 'error' : 'warning'}`;
            header.innerHTML = `
                <span class="validation-icon">${section.errors.length > 0 ? '❌' : '⚠️'}</span>
                <span class="validation-name">${section.name}</span>
                <span class="validation-count">${section.errors.length} 錯誤 / ${section.warnings.length} 警告</span>
            `;
            sectionEl.appendChild(header);

            section.errors.forEach(err => {
                const item = document.createElement('div');
                item.className = 'validation-item error';
                item.textContent = err;
                sectionEl.appendChild(item);
            });
            section.warnings.forEach(warn => {
                const item = document.createElement('div');
                item.className = 'validation-item warning';
                item.textContent = warn;
                sectionEl.appendChild(item);
            });

            this.validationReportContent.appendChild(sectionEl);
        });
    }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    window.geometryApp = new DSEGeometryController();
});
