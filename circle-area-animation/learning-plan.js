class LearningPlanGenerator {
    constructor() {
        this.storageKey = 'mathExploration.learningPlan.latest';
        this.assessmentData = null;
        this.learningPlan = null;
        this.initializeElements();
        this.attachEventListeners();
        this.loadSavedPlanSummary();
    }

    initializeElements() {
        this.assessmentForm = document.getElementById('assessment-form');
        this.assessmentSection = document.getElementById('assessment-section');
        this.planResultSection = document.getElementById('plan-result-section');
        this.submitBtn = document.getElementById('submit-assessment');
        this.restartBtn = document.getElementById('restart-plan-btn');
        this.startLearningBtn = document.getElementById('start-learning-btn');
        this.downloadPlanBtn = document.getElementById('download-plan-btn');
        this.viewSavedPlanBtn = document.getElementById('view-saved-plan-btn');
        this.savedPlanMeta = document.getElementById('saved-plan-meta');
        this.loadingSpinner = document.getElementById('loading-spinner');
        this.summaryArea = document.getElementById('assessment-summary');
        this.modulesArea = document.getElementById('learning-modules');
    }

    attachEventListeners() {
        this.submitBtn.addEventListener('click', () => this.handleSubmitAssessment());
        this.restartBtn.addEventListener('click', () => this.resetToAssessment());
        this.startLearningBtn.addEventListener('click', () => this.redirectToModule());
        this.downloadPlanBtn.addEventListener('click', () => this.downloadPlan());
        this.viewSavedPlanBtn.addEventListener('click', () => this.viewSavedPlan());
    }

    async handleSubmitAssessment() {
        const formData = new FormData(this.assessmentForm);
        const level = formData.get('level');
        const time = formData.get('time');
        const style = formData.get('style');

        if (!level || !time || !style) {
            this.showError('Please complete all required questions.');
            return;
        }

        const selectedInterests = formData.getAll('interests');
        this.assessmentData = {
            level,
            interests: selectedInterests,
            q3: formData.get('q3'),
            q4: formData.get('q4'),
            q5: formData.get('q5'),
            time,
            style,
            score: this.calculateScore(formData)
        };

        this.showLoading(true);
        try {
            await this.generateLearningPlan();
        } finally {
            this.showLoading(false);
        }
    }

    calculateScore(formData) {
        let correct = 0;
        if (formData.get('q3') === 'correct') correct += 1;
        if (formData.get('q4') === 'correct') correct += 1;
        if (formData.get('q5') === 'correct') correct += 1;
        return Math.round((correct / 3) * 100);
    }

    async generateLearningPlan() {
        const prompt = `You are an expert math tutor creating a personalized learning plan.

Student assessment:
- Current level: ${this.assessmentData.level}
- Topic interests: ${this.assessmentData.interests.join(', ') || 'none'}
- Quiz score: ${this.assessmentData.score}%
- Circle area knowledge: ${this.assessmentData.q3 === 'correct' ? 'correct' : 'needs work'}
- Pythagorean theorem knowledge: ${this.assessmentData.q4 === 'correct' ? 'correct' : 'needs work'}
- Square root of 2 knowledge: ${this.assessmentData.q5 === 'correct' ? 'correct' : 'needs work'}
- Available time per week: ${this.assessmentData.time}
- Learning style: ${this.assessmentData.style}

Return ONLY valid JSON with this structure:
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
  "motivationalMessage": "string"
}

Recommended modules must come from these homepage lessons:
- circle_area -> Circle Area
- cylinder_volume -> Cylinder Surface Area
- pythagoras -> Pythagorean Theorem
- probability -> Law of Large Numbers
- sqrt2 -> Irrational Number sqrt(2)
- exponential -> Exponential Growth vs Linear Growth

Choose 3-5 modules and make the plan practical for the student's level and available time.`;

        const response = await fetch('/api/hf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            throw new Error('AI service error');
        }

        const data = await response.json();
        const planJson = this.extractFirstJsonObject(String(data.generated_text || ''));
        if (!planJson || !Array.isArray(planJson.recommendedModules)) {
            throw new Error('Invalid AI response format');
        }

        this.learningPlan = planJson;
        this.saveCurrentPlan();
        this.renderLearningPlan();
    }

    extractFirstJsonObject(text) {
        if (!text || typeof text !== 'string') return null;

        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (fenced && fenced[1]) {
            try {
                return JSON.parse(fenced[1]);
            } catch (_error) {
                // Fall back to raw parsing below.
            }
        }

        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) return null;

        try {
            return JSON.parse(text.slice(start, end + 1));
        } catch (_error) {
            return null;
        }
    }

    renderLearningPlan() {
        this.summaryArea.innerHTML = `
            <h3>Assessment Results</h3>
            <div class="summary-item"><span class="summary-label">Quiz Score</span><span class="summary-value">${this.assessmentData.score}%</span></div>
            <div class="summary-item"><span class="summary-label">Math Level</span><span class="summary-value">${this.capitalizeFirst(this.assessmentData.level)}</span></div>
            <div class="summary-item"><span class="summary-label">Overall Assessment</span><span class="summary-value">${this.escapeHtml(this.learningPlan.overallAssessment || '')}</span></div>
            <div class="summary-item"><span class="summary-label">Learning Strategy</span><span class="summary-value">${this.escapeHtml(this.learningPlan.learningStrategy || '')}</span></div>
            <div class="summary-item"><span class="summary-label">Motivation</span><span class="summary-value">${this.escapeHtml(this.learningPlan.motivationalMessage || '')}</span></div>
        `;

        const moduleMap = {
            circle_area: 'circle.html',
            cylinder_volume: 'cylinder.html',
            pythagoras: 'pythagoras.html',
            probability: 'probability.html',
            sqrt2: 'sqrt2.html',
            exponential: 'exponential.html'
        };

        this.modulesArea.innerHTML = this.learningPlan.recommendedModules.map((module) => `
            <div class="module-card">
                <div class="module-header">
                    <div class="module-icon">${module.icon || '📘'}</div>
                    <div>
                        <div class="module-title">${this.escapeHtml(module.title || 'Module')}</div>
                        <span class="module-level">${this.capitalizeFirst(module.difficulty || 'beginner')}</span>
                    </div>
                </div>
                <div class="module-description">${this.escapeHtml(module.reason || '')}</div>
                <div class="module-resources">
                    <div class="resource-item" onclick="window.location.href='${moduleMap[module.module] || 'index.html'}'">
                        <span class="resource-icon">📖</span>
                        <span class="resource-name">Start Module</span>
                        <span class="resource-link">→</span>
                    </div>
                    <div style="padding: 8px; color: rgba(255, 255, 255, 0.6); font-size: 0.9em;">
                        ⏱️ Estimated Time: ${this.escapeHtml(module.estimatedTime || '-')}
                    </div>
                </div>
            </div>
        `).join('');

        this.assessmentSection.classList.remove('active-section');
        this.planResultSection.classList.add('active-section');
        this.planResultSection.scrollIntoView({ behavior: 'smooth' });
    }

    saveCurrentPlan() {
        if (!this.assessmentData || !this.learningPlan) return;

        const payload = {
            savedAt: new Date().toISOString(),
            assessmentData: this.assessmentData,
            learningPlan: this.learningPlan
        };

        try {
            localStorage.setItem(this.storageKey, JSON.stringify(payload));
            this.loadSavedPlanSummary();
        } catch (error) {
            console.warn('Failed to save learning plan:', error.message);
        }
    }

    getSavedPlan() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.assessmentData || !parsed.learningPlan) return null;
            return parsed;
        } catch (error) {
            console.warn('Failed to load saved learning plan:', error.message);
            return null;
        }
    }

    loadSavedPlanSummary() {
        const saved = this.getSavedPlan();
        if (!saved) {
            this.viewSavedPlanBtn.style.display = 'none';
            this.savedPlanMeta.textContent = 'No saved plan yet.';
            return;
        }

        this.viewSavedPlanBtn.style.display = 'inline-block';
        this.savedPlanMeta.textContent = `Last saved: ${new Date(saved.savedAt).toLocaleString()}`;
    }

    viewSavedPlan() {
        const saved = this.getSavedPlan();
        if (!saved) {
            this.showError('No saved learning plan found yet. Please complete an assessment first.');
            return;
        }

        this.assessmentData = saved.assessmentData;
        this.learningPlan = saved.learningPlan;
        this.renderLearningPlan();
    }

    redirectToModule() {
        if (this.learningPlan && Array.isArray(this.learningPlan.recommendedModules) && this.learningPlan.recommendedModules.length > 0) {
            const firstModule = this.learningPlan.recommendedModules[0];
            const moduleMap = {
                circle_area: 'circle.html',
                cylinder_volume: 'cylinder.html',
                pythagoras: 'pythagoras.html',
                probability: 'probability.html',
                sqrt2: 'sqrt2.html',
                exponential: 'exponential.html'
            };
            window.location.href = moduleMap[firstModule.module] || 'index.html';
        }
    }

    downloadPlan() {
        if (!this.assessmentData || !this.learningPlan) return;

        const exportData = {
            savedAt: new Date().toISOString(),
            assessmentData: this.assessmentData,
            learningPlan: this.learningPlan
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'learning-plan.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    resetToAssessment() {
        this.assessmentForm.reset();
        this.planResultSection.classList.remove('active-section');
        this.assessmentSection.classList.add('active-section');
        this.assessmentSection.scrollIntoView({ behavior: 'smooth' });
    }

    showLoading(show) {
        this.loadingSpinner.style.display = show ? 'block' : 'none';
        this.submitBtn.disabled = show;
    }

    showError(message) {
        alert(message);
    }

    capitalizeFirst(text) {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text || '');
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.learningPlan = new LearningPlanGenerator();
});
