/**
 * my-problems.js
 * Controller for the "My Problems" library page.
 * Lists, filters, exports (single & batch PDF), and deletes saved problems from Supabase.
 */

class MyProblemsController {
    constructor() {
        this.problems = [];
        this.activeFilter = 'all';
        this.difficultyFilter = '';
        this.pendingDeleteId = null;

        // Batch mode
        this.batchMode = false;
        this.selectedIds = new Set();

        this.initDOM();
        this.attachEvents();
        this.loadProblems();
    }

    initDOM() {
        this.grid = document.getElementById('mp-problems-grid');
        this.emptyState = document.getElementById('mp-empty-state');
        this.loadingState = document.getElementById('mp-loading');
        this.toastContainer = document.getElementById('mp-toast-container');

        // Stats
        this.totalCount = document.getElementById('mp-total-count');
        this.geoCount = document.getElementById('mp-geo-count');
        this.algCount = document.getElementById('mp-alg-count');

        // Filters
        this.filterChips = document.querySelectorAll('.mp-filter-chip');
        this.difficultySelect = document.getElementById('mp-difficulty-filter');

        // Delete modal
        this.deleteModal = document.getElementById('mp-delete-modal');
        this.cancelDeleteBtn = document.getElementById('mp-cancel-delete');
        this.confirmDeleteBtn = document.getElementById('mp-confirm-delete');

        // Batch mode
        this.batchBar = document.getElementById('mp-batch-bar');
        this.batchToggleBtn = document.getElementById('mp-toggle-batch');
        this.selectAllCheckbox = document.getElementById('mp-select-all');
        this.selectedCountEl = document.getElementById('mp-selected-count');
        this.batchPdfBtn = document.getElementById('mp-batch-pdf');
        this.batchTxtBtn = document.getElementById('mp-batch-txt');
        this.batchCancelBtn = document.getElementById('mp-batch-cancel');
    }

    attachEvents() {
        this.filterChips.forEach(chip => {
            chip.addEventListener('click', () => {
                this.filterChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.activeFilter = chip.dataset.filter;
                this.renderGrid();
            });
        });

        this.difficultySelect.addEventListener('change', () => {
            this.difficultyFilter = this.difficultySelect.value;
            this.renderGrid();
        });

        this.cancelDeleteBtn.addEventListener('click', () => this.closeDeleteModal());
        this.confirmDeleteBtn.addEventListener('click', () => this.confirmDelete());

        this.deleteModal.addEventListener('click', (e) => {
            if (e.target === this.deleteModal) this.closeDeleteModal();
        });

        // Batch events
        this.batchToggleBtn.addEventListener('click', () => this.toggleBatchMode());
        this.selectAllCheckbox.addEventListener('change', () => this.handleSelectAll());
        this.batchPdfBtn.addEventListener('click', () => this.exportBatchPdf());
        this.batchTxtBtn.addEventListener('click', () => this.exportBatchTxt());
        this.batchCancelBtn.addEventListener('click', () => this.exitBatchMode());
    }

    async loadProblems() {
        this.loadingState.style.display = 'flex';
        this.grid.style.display = 'none';
        this.emptyState.style.display = 'none';

        try {
            this.problems = await DBService.listProblems();
            this.updateStats();
            this.renderGrid();
        } catch (err) {
            console.error(err);
            this.showToast('載入題庫失敗：' + err.message, 'error');
            this.problems = [];
            this.renderGrid();
        } finally {
            this.loadingState.style.display = 'none';
        }
    }

    updateStats() {
        const total = this.problems.length;
        const geo = this.problems.filter(p => p.type === 'geometry').length;
        const alg = this.problems.filter(p => p.type === 'algebra').length;

        this.totalCount.textContent = total;
        this.geoCount.textContent = geo;
        this.algCount.textContent = alg;
    }

    getFilteredProblems() {
        let filtered = [...this.problems];

        if (this.activeFilter === 'geometry') {
            filtered = filtered.filter(p => p.type === 'geometry');
        } else if (this.activeFilter === 'algebra') {
            filtered = filtered.filter(p => p.type === 'algebra');
        }

        if (this.difficultyFilter) {
            filtered = filtered.filter(p => p.difficulty === this.difficultyFilter);
        }

        return filtered;
    }

    renderGrid() {
        const filtered = this.getFilteredProblems();

        if (filtered.length === 0) {
            this.grid.style.display = 'none';
            this.emptyState.style.display = 'flex';
            return;
        }

        this.emptyState.style.display = 'none';
        this.grid.style.display = 'grid';
        this.grid.innerHTML = filtered.map(p => this.renderCard(p)).join('');

        // Attach card events
        this.grid.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const id = e.currentTarget.dataset.id;
                this.handleCardAction(action, id);
            });
        });

        // Attach batch checkbox events
        if (this.batchMode) {
            this.grid.querySelectorAll('.mp-card-check-input').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    e.stopPropagation();
                    this.toggleSelection(cb.dataset.id, cb.checked);
                });
            });
            // Also allow clicking the card to toggle
            this.grid.querySelectorAll('.mp-card.batch-mode').forEach(card => {
                card.addEventListener('click', (e) => {
                    // Don't toggle if clicking an action button
                    if (e.target.closest('[data-action]') || e.target.closest('.mp-card-check-input')) return;
                    const id = card.id.replace('card-', '');
                    const cb = card.querySelector('.mp-card-check-input');
                    if (cb) {
                        cb.checked = !cb.checked;
                        this.toggleSelection(id, cb.checked);
                    }
                });
            });
        }
    }

    renderCard(problem) {
        const typeLabel = problem.type === 'geometry' ? '幾何' : '代數';
        const typeClass = problem.type;
        const date = new Date(problem.created_at).toLocaleDateString('zh-HK', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const diffLabel = this.getDifficultyLabel(problem.difficulty);


        const batchClass = this.batchMode ? 'batch-mode' : '';
        const selectedClass = this.selectedIds.has(problem.id) ? 'selected' : '';
        const checked = this.selectedIds.has(problem.id) ? 'checked' : '';

        return `
        <div class="mp-card ${batchClass} ${selectedClass}" id="card-${problem.id}">
            <div class="mp-card-checkbox">
                <input type="checkbox" class="mp-card-check-input" data-id="${problem.id}" ${checked}>
            </div>
            <div class="mp-card-header">
                <div class="mp-card-badges">
                    <span class="mp-badge ${typeClass}">${typeLabel}</span>
                    <span class="mp-badge difficulty">${diffLabel}</span>
                </div>
            </div>
            <div class="mp-card-body">
                <p class="mp-card-title">${this.escapeHtml(problem.title)}</p>
                <div class="mp-card-meta">
                    <span>📁 ${this.escapeHtml(problem.topic)}</span>
                    <span>🕐 ${date}</span>
                </div>
            </div>
            <div class="mp-card-footer">
                <button class="mp-card-action primary" data-action="open" data-id="${problem.id}" title="載入到生成器">
                    📂 載入
                </button>
                <button class="mp-card-action danger" data-action="delete" data-id="${problem.id}" title="刪除">
                    🗑️
                </button>
            </div>
        </div>`;
    }

    // ── Batch Mode ──

    toggleBatchMode() {
        this.batchMode = !this.batchMode;
        this.batchToggleBtn.classList.toggle('active', this.batchMode);
        this.batchBar.style.display = this.batchMode ? 'flex' : 'none';

        if (!this.batchMode) {
            this.selectedIds.clear();
            this.selectAllCheckbox.checked = false;
        }
        this.updateBatchUI();
        this.renderGrid();
    }

    exitBatchMode() {
        this.batchMode = false;
        this.selectedIds.clear();
        this.selectAllCheckbox.checked = false;
        this.batchToggleBtn.classList.remove('active');
        this.batchBar.style.display = 'none';
        this.updateBatchUI();
        this.renderGrid();
    }

    toggleSelection(id, isSelected) {
        if (isSelected) {
            this.selectedIds.add(id);
        } else {
            this.selectedIds.delete(id);
        }

        // Update card visual
        const card = document.getElementById(`card-${id}`);
        if (card) {
            card.classList.toggle('selected', isSelected);
        }

        // Sync select-all checkbox
        const filtered = this.getFilteredProblems();
        this.selectAllCheckbox.checked = filtered.length > 0 && filtered.every(p => this.selectedIds.has(p.id));

        this.updateBatchUI();
    }

    handleSelectAll() {
        const filtered = this.getFilteredProblems();
        if (this.selectAllCheckbox.checked) {
            filtered.forEach(p => this.selectedIds.add(p.id));
        } else {
            filtered.forEach(p => this.selectedIds.delete(p.id));
        }
        this.updateBatchUI();
        this.renderGrid();
    }

    updateBatchUI() {
        const count = this.selectedIds.size;
        this.selectedCountEl.textContent = count;
        this.batchPdfBtn.disabled = count === 0;
        this.batchTxtBtn.disabled = count === 0;
    }

    async exportBatchPdf() {
        const selected = this.problems.filter(p => this.selectedIds.has(p.id));
        if (selected.length === 0) return;

        try {
            this.batchPdfBtn.disabled = true;
            this.batchPdfBtn.textContent = '⏳ 生成中…';
            this.showToast(`📑 正在合併 ${selected.length} 題導出 PDF…`, 'success');

            await DBService.exportMultipleAsPdf(selected);

            this.showToast(`📑 已成功導出 ${selected.length} 題的合併 PDF`, 'success');
        } catch (err) {
            console.error('Batch PDF export failed:', err);
            this.showToast('PDF 導出失敗：' + err.message, 'error');
        } finally {
            this.batchPdfBtn.disabled = false;
            this.batchPdfBtn.textContent = '📑 合併導出 PDF';
        }
    }

    async exportBatchTxt() {
        const selected = this.problems.filter(p => this.selectedIds.has(p.id));
        if (selected.length === 0) return;

        try {
            this.batchTxtBtn.disabled = true;
            this.batchTxtBtn.textContent = '⏳ 生成中…';
            this.showToast(`📄 正在合併 ${selected.length} 題導出 TXT…`, 'success');

            DBService.exportMultipleAsTxt(selected);

            this.showToast(`📄 已成功導出 ${selected.length} 題的合併 TXT`, 'success');
        } catch (err) {
            console.error('Batch TXT export failed:', err);
            this.showToast('TXT 導出失敗：' + err.message, 'error');
        } finally {
            this.batchTxtBtn.disabled = false;
            this.batchTxtBtn.textContent = '📄 合併導出 TXT';
        }
    }

    // ── Card Actions ──

    handleCardAction(action, id) {
        const problem = this.problems.find(p => p.id === id);
        if (!problem) return;

        switch (action) {
            case 'open':
                this.openProblem(problem);
                break;

            case 'delete':
                this.showDeleteModal(id);
                break;
        }
    }

    openProblem(problem) {
        // Store in sessionStorage and redirect to the generator
        sessionStorage.setItem('loadProblem', JSON.stringify(problem));
        if (problem.type === 'geometry') {
            window.location.href = 'dse-geometry.html?load=saved';
        } else {
            window.location.href = 'dse-algebra.html?load=saved';
        }
    }



    showDeleteModal(id) {
        this.pendingDeleteId = id;
        this.deleteModal.style.display = 'flex';
    }

    closeDeleteModal() {
        this.pendingDeleteId = null;
        this.deleteModal.style.display = 'none';
    }

    async confirmDelete() {
        if (!this.pendingDeleteId) return;
        const id = this.pendingDeleteId;

        try {
            this.confirmDeleteBtn.disabled = true;
            this.confirmDeleteBtn.textContent = '刪除中…';
            await DBService.deleteProblem(id);
            this.problems = this.problems.filter(p => p.id !== id);
            this.selectedIds.delete(id);
            this.updateStats();
            this.updateBatchUI();
            this.renderGrid();
            this.showToast('🗑️ 題目已刪除', 'success');
        } catch (err) {
            this.showToast('刪除失敗：' + err.message, 'error');
        } finally {
            this.confirmDeleteBtn.disabled = false;
            this.confirmDeleteBtn.textContent = '刪除';
            this.closeDeleteModal();
        }
    }

    getDifficultyLabel(d) {
        const map = {
            'DSE_Level_2': 'Lv.2',
            'DSE_Level_4': 'Lv.4',
            'DSE_Level_5_star': 'Lv.5*'
        };
        return map[d] || d;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text || '');
        return div.innerHTML;
    }

    showToast(message, type = 'error') {
        const toast = document.createElement('div');
        toast.className = `mp-toast ${type}`;
        toast.textContent = message;
        this.toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.myProblems = new MyProblemsController();
});
