/**
 * auth-guard.js
 * Shows a full-screen login modal if no student ID is stored.
 * Must be loaded AFTER supabase-config.js and i18n.js.
 *
 * Usage: include this script on every page that requires authentication.
 */

(function () {
    'use strict';

    const _t = (key) => (window.i18n && window.i18n.t) ? window.i18n.t(key) : key;

    // If already logged in, just update the sidebar user display and return
    if (window.isLoggedIn && window.isLoggedIn()) {
        _injectSidebarUser();
        return;
    }

    // ── Build and show the login overlay ──
    // Hide the sidebar and content to prevent them interfering with the overlay
    const sidebar = document.querySelector('.sidebar');
    const contentArea = document.querySelector('.content-area');
    if (sidebar) sidebar.style.visibility = 'hidden';
    if (contentArea) contentArea.style.visibility = 'hidden';

    const overlay = document.createElement('div');
    overlay.id = 'auth-login-overlay';
    overlay.innerHTML = `
        <div class="auth-login-card">
            <div class="auth-login-logo" aria-hidden="true">∑</div>
            <h2 class="auth-login-title">${_t('auth.welcome')}</h2>
            <p class="auth-login-desc">${_t('auth.description')}</p>
            <form id="auth-login-form" autocomplete="off">
                <div class="auth-input-wrap">
                    <label for="auth-student-id" class="auth-input-label">${_t('auth.studentId')}</label>
                    <input
                        type="text"
                        id="auth-student-id"
                        class="auth-input"
                        placeholder="${_t('auth.placeholder')}"
                        required
                        autofocus
                        minlength="3"
                        maxlength="30"
                        pattern="[A-Za-z0-9_\\-]+"
                        title="${_t('auth.inputTitle')}"
                    />
                    <span class="auth-input-hint" id="auth-input-hint"></span>
                </div>
                <button type="submit" class="auth-login-btn" id="auth-login-btn">
                    ${_t('auth.enter')}
                    <span class="auth-login-arrow" aria-hidden="true">→</span>
                </button>
            </form>
            <p class="auth-login-note">${_t('auth.note')}</p>
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
            hint.textContent = _t('auth.inputHint.empty');
            hint.className = 'auth-input-hint error';
            input.focus();
            return;
        }

        if (!/^[A-Za-z0-9_\-]{3,30}$/.test(raw)) {
            hint.textContent = _t('auth.inputHint.invalid');
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
                    <span class="sidebar-user-label">${_t('auth.idLabel')}</span>
                </div>
            </div>
            <button class="sidebar-logout-btn" id="sidebar-logout-btn" title="${_t('auth.logout')}">
                ${_t('auth.logout')}
            </button>
        `;

        // Insert before footer
        footer.parentNode.insertBefore(badge, footer);

        // Logout handler
        document.getElementById('sidebar-logout-btn').addEventListener('click', () => {
            if (confirm(_t('auth.logoutConfirm'))) {
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
