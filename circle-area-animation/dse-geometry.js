/**
 * dse-geometry.js
 * Frontend logic for DSE Dynamic Geometry Generator
 * Ported from dse-geometry/core TypeScript models to Vanilla JS
 */

// ==========================================
// 1. Core Logic: LLM Service
// ==========================================
class AIGenerationService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.modelName = 'gemini-3-flash-preview'; // 使用具備 Reasoning/Thinking 能力的 Gemini 3 Flash 模型
    }

    async generateQuestion(topic, difficulty, promptText) {
        const systemInstruction = `
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
      "question_template": { "text": "題目文字，支援 KaTeX 公式 $...$。用 _{{var}}_ 來綁定變數以動態顯示。" },
      "marking_scheme": { 
        "steps": [
            { "description": "給分步驟描述", "marks": 1, "markType": "M" }
        ]
      },
      "controls": {
        "sliders": [
            { "targetVariable": "變數名稱", "label": "UI顯示標籤", "min": 1, "max": 100, "step": 1 }
        ]
      }
    }
    
    請確保：
    - 點 ID 彼此存在依賴時，不會產生循環依賴。
    - 預設一律將原點設為 center 或 (0,0)，並且合理佈局 x,y 給 viewBox (-200 -200 400 400)。所以座標系盡量介於 -150 到 150 之間。
    - JSON 格式必須完美無缺，能被 JSON.parse() 解析。`;

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
                    const errPayload = await response.json().catch(() => ({}));
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
        this.currentQuestionData = null;
        this.sliderVariables = {};
        this.resolvedPoints = new Map();
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
        this.promptInput = document.getElementById('prompt-input');
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
            // Try fetching one more time before giving up
            await this.loadApiKey();
        }
        if (!this.apiKey) {
            this.showToast('未找到 API Key，請確認 .env 已設定 GEMINI_API_KEY 並重啟伺服器。', 'error');
            return;
        }

        const topic = this.topicInput.value;
        const difficulty = this.difficultyInput.value;
        const promptText = this.promptInput.value.trim() || '請自動出題';

        this.setLoadingState(true);
        const aiService = new AIGenerationService(this.apiKey);

        try {
            const data = await aiService.generateQuestion(topic, difficulty, promptText);
            this.currentQuestionData = data;

            // Initialize slider variables
            this.sliderVariables = { ...data.geometry_state.variables };

            this.renderUI();
            this.renderingArea.classList.remove('style-hidden');
        } catch (error) {
            console.error(error);
            this.showToast('題目生成失敗: ' + error.message, 'error');
            this.emptyState.classList.remove('style-hidden');
        } finally {
            this.setLoadingState(false);
        }
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

        // 2. Render Text Template initially
        this.updateQuestionText();

        // 3. Render Marking Scheme
        this.markingContent.innerHTML = '';
        const steps = this.currentQuestionData.marking_scheme?.steps || [];
        steps.forEach(step => {
            const div = document.createElement('div');
            div.className = 'mark-step';
            div.innerHTML = `
                <span class="mark-desc">${step.description}</span>
                <span class="mark-score">${step.marks}${step.markType}</span>
            `;
            this.markingContent.appendChild(div);
        });

        // 4. Update core SVG
        this.updateGeometry();
    }

    updateQuestionText() {
        if (!this.currentQuestionData) return;

        let htmlContent = this.currentQuestionData.question_template.text;

        // Convert Markdown newlines strictly
        htmlContent = htmlContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
        htmlContent = '<p>' + htmlContent + '</p>';

        // Handle variable replacement e.g. _{{var}}_
        Object.keys(this.sliderVariables).forEach(key => {
            const regex = new RegExp(`_\\{\\{${key}\\}\\}_`, 'g');
            htmlContent = htmlContent.replace(regex, `<strong style="color: #3b82f6;">${this.sliderVariables[key]}</strong>`);
        });

        this.questionDescription.innerHTML = htmlContent;

        // Re-run MathJax rendering if available
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([this.questionDescription]).catch(err => console.log('MathJax err', err));
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
            // Optionally update text if it depends heavily on variables dynamically (we do it above)
            this.updateQuestionText();
        } catch (error) {
            console.error("Geometry Resolve Error:", error);
            // Ignore partial render if logic fails
        }
    }

    renderSVG() {
        const elements = this.currentQuestionData.geometry_state.elements || {};
        this.svgElements.innerHTML = ''; // Clear SVG

        // Helper to get {x,y}
        const getPt = (id) => this.resolvedPoints.get(id) || { x: 0, y: 0 };

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
                const offset = lb.offset || { x: 0, y: 0 };

                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', pt.x + offset.x);
                text.setAttribute('y', -pt.y - offset.y); // Y is flipped
                text.setAttribute('class', 'geom-label');
                text.textContent = lb.text;
                this.svgElements.appendChild(text);
            });
        }
    }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    window.geometryApp = new DSEGeometryController();
});
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
