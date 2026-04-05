/**
 * auth-guard.js
 * Shows a full-screen login modal if no student ID is stored.
 * Must be loaded AFTER supabase-config.js.
 *
 * Usage: include this script on every page that requires authentication.
 */

(function () {
    'use strict';

    // If already logged in, just update the sidebar user display and return
    if (window.isLoggedIn && window.isLoggedIn()) {
        _injectSidebarUser();
        return;
    }

    // ── Build and show the login overlay ──
    // Hide the sidebar and content to prevent them interfering with the overlay
    const sidebar = document.querySelector('.sidebar');
    const contentArea = document.querySelector('.content-area');
    if (sidebar) sidebar.style.display = 'none';
    if (contentArea) contentArea.style.display = 'none';

    const overlay = document.createElement('div');
    overlay.id = 'auth-login-overlay';
    overlay.innerHTML = `
        <div class="auth-login-card">
            <div class="auth-login-logo" aria-hidden="true">∑</div>
            <h2 class="auth-login-title">歡迎來到 Math Hub</h2>
            <p class="auth-login-desc">請輸入你的學號以開始使用平台</p>
            <form id="auth-login-form" autocomplete="off">
                <div class="auth-input-wrap">
                    <label for="auth-student-id" class="auth-input-label">學號 Student ID</label>
                    <input
                        type="text"
                        id="auth-student-id"
                        class="auth-input"
                        placeholder="例如：23456789"
                        required
                        autofocus
                        minlength="3"
                        maxlength="30"
                        pattern="[A-Za-z0-9_\\-]+"
                        title="請輸入英文字母、數字、底線或連字號"
                    />
                    <span class="auth-input-hint" id="auth-input-hint"></span>
                </div>
                <button type="submit" class="auth-login-btn" id="auth-login-btn">
                    進入平台
                    <span class="auth-login-arrow" aria-hidden="true">→</span>
                </button>
            </form>
            <p class="auth-login-note">⚠️ 無需密碼 — 任何人都可使用你的學號登入查看你的紀錄。</p>
        </div>
    `;
    document.body.appendChild(overlay);

    // Prevent interaction with background
    document.body.style.overflow = 'hidden';

    // ── Form logic ──
    const form = document.getElementById('auth-login-form');
    const input = document.getElementById('auth-student-id');
    const hint = document.getElementById('auth-input-hint');

    input.addEventListener('input', () => {
        hint.textContent = '';
        hint.className = 'auth-input-hint';
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const raw = input.value.trim();

        // Basic validation
        if (!raw) {
            hint.textContent = '請輸入學號';
            hint.className = 'auth-input-hint error';
            input.focus();
            return;
        }

        if (!/^[A-Za-z0-9_\-]{3,30}$/.test(raw)) {
            hint.textContent = '學號只可包含英文、數字、_、-（3-30 個字元）';
            hint.className = 'auth-input-hint error';
            input.focus();
            return;
        }

        // Save and enter
        window.setStudentId(raw);

        // Animate out
        overlay.classList.add('auth-fade-out');
        setTimeout(() => {
            overlay.remove();
            document.body.style.overflow = '';
            _injectSidebarUser();
            // Reload the page to pick up the new user context
            window.location.reload();
        }, 350);
    });

    // ── Sidebar user badge ──
    function _injectSidebarUser() {
        const studentId = window.getStudentId();
        if (!studentId) return;

        // Find sidebar footer
        const footer = document.querySelector('.sidebar-footer');
        if (!footer) return;

        // Avoid duplicate injection
        if (document.getElementById('sidebar-user-badge')) return;

        const badge = document.createElement('div');
        badge.id = 'sidebar-user-badge';
        badge.className = 'sidebar-user-badge';
        badge.innerHTML = `
            <div class="sidebar-user-info">
                <div class="sidebar-user-avatar" aria-hidden="true">👤</div>
                <div class="sidebar-user-text">
                    <span class="sidebar-user-id">${_escHtml(studentId)}</span>
                    <span class="sidebar-user-label">學號</span>
                </div>
            </div>
            <button class="sidebar-logout-btn" id="sidebar-logout-btn" title="登出">
                ↪ 登出
            </button>
        `;

        // Insert before footer
        footer.parentNode.insertBefore(badge, footer);

        // Logout handler
        document.getElementById('sidebar-logout-btn').addEventListener('click', () => {
            if (confirm('確定要登出嗎？登出後需重新輸入學號。')) {
                window.clearStudentId();
                window.location.reload();
            }
        });
    }

    function _escHtml(str) {
        const el = document.createElement('span');
        el.textContent = str;
        return el.innerHTML;
    }
})();
