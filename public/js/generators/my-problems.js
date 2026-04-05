/**
 * my-problems.js
 * Controller for the "My Problems" library page.
 * Lists, filters, exports, and deletes saved problems from Supabase.
 */

class MyProblemsController {
    constructor() {
        this.problems = [];
        this.activeFilter = 'all';
        this.difficultyFilter = '';
        this.pendingDeleteId = null;

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
        } else if (this.activeFilter === 'favorite') {
            filtered = filtered.filter(p => p.is_favorite);
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
    }

    renderCard(problem) {
        const typeLabel = problem.type === 'geometry' ? '幾何' : '代數';
        const typeClass = problem.type;
        const date = new Date(problem.created_at).toLocaleDateString('zh-HK', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const diffLabel = this.getDifficultyLabel(problem.difficulty);
        const favClass = problem.is_favorite ? 'is-fav' : '';
        const favIcon = problem.is_favorite ? '⭐' : '☆';

        return `
        <div class="mp-card" id="card-${problem.id}">
            <div class="mp-card-header">
                <div class="mp-card-badges">
                    <span class="mp-badge ${typeClass}">${typeLabel}</span>
                    <span class="mp-badge difficulty">${diffLabel}</span>
                </div>
                <button class="mp-card-fav ${favClass}" data-action="fav" data-id="${problem.id}" title="切換收藏">
                    ${favIcon}
                </button>
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
                <button class="mp-card-action pdf-export" data-action="export-pdf" data-id="${problem.id}" title="導出 PDF（含圖片）">
                    📑 PDF
                </button>
                <button class="mp-card-action" data-action="export-json" data-id="${problem.id}" title="導出 JSON">
                    📥 JSON
                </button>
                <button class="mp-card-action" data-action="export-txt" data-id="${problem.id}" title="導出 TXT">
                    📄 TXT
                </button>
                <button class="mp-card-action danger" data-action="delete" data-id="${problem.id}" title="刪除">
                    🗑️
                </button>
            </div>
        </div>`;
    }

    handleCardAction(action, id) {
        const problem = this.problems.find(p => p.id === id);
        if (!problem) return;

        switch (action) {
            case 'open':
                this.openProblem(problem);
                break;
            case 'export-pdf':
                this.exportPdf(problem);
                break;
            case 'export-json':
                DBService.exportProblem(problem, 'json');
                this.showToast('📥 JSON 檔案已下載', 'success');
                break;
            case 'export-txt':
                DBService.exportProblem(problem, 'txt');
                this.showToast('📄 TXT 檔案已下載', 'success');
                break;
            case 'fav':
                this.toggleFavorite(problem);
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

    async exportPdf(problem) {
        const btn = this.grid.querySelector(`[data-action="export-pdf"][data-id="${problem.id}"]`);
        const origText = btn ? btn.innerHTML : '';
        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '⏳ 生成中…';
            }
            this.showToast('📑 正在生成 PDF…', 'success');
            await DBService.exportProblem(problem, 'pdf');
            this.showToast('📑 PDF 檔案已下載', 'success');
        } catch (err) {
            console.error('PDF export failed:', err);
            this.showToast('PDF 導出失敗：' + err.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origText;
            }
        }
    }

    async toggleFavorite(problem) {
        const newState = !problem.is_favorite;
        try {
            await DBService.toggleFavorite(problem.id, newState);
            problem.is_favorite = newState;
            this.renderGrid();
            this.showToast(newState ? '⭐ 已加入收藏' : '已取消收藏', 'success');
        } catch (err) {
            this.showToast('收藏操作失敗：' + err.message, 'error');
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
            this.updateStats();
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
