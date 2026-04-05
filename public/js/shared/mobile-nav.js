/**
 * mobile-nav.js
 * Injects a hamburger menu button and backdrop overlay for mobile sidebar navigation.
 * Auto-detects mobile breakpoint (<=600px) and injects DOM elements.
 * Must be loaded AFTER the DOM contains .sidebar and .content-topbar.
 */

(function () {
    'use strict';

    const MOBILE_BREAKPOINT = 600;

    // ── Create DOM elements once ──
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    backdrop.id = 'sidebar-backdrop';
    document.body.appendChild(backdrop);

    const menuBtn = document.createElement('button');
    menuBtn.className = 'mobile-menu-btn';
    menuBtn.id = 'mobile-menu-btn';
    menuBtn.setAttribute('aria-label', '開啟導覽選單');
    menuBtn.setAttribute('type', 'button');
    menuBtn.innerHTML = '☰';

    // Insert hamburger button at the start of topbar
    const topbar = document.querySelector('.content-topbar');
    if (topbar) {
        topbar.insertBefore(menuBtn, topbar.firstChild);
    }

    const sidebar = document.querySelector('.sidebar');

    // ── Toggle functions ──
    function openSidebar() {
        if (!sidebar) return;
        sidebar.classList.add('sidebar-open');
        backdrop.classList.add('active');
        document.body.classList.add('sidebar-nav-open');
        menuBtn.innerHTML = '✕';
        menuBtn.setAttribute('aria-label', '關閉導覽選單');
    }

    function closeSidebar() {
        if (!sidebar) return;
        sidebar.classList.remove('sidebar-open');
        backdrop.classList.remove('active');
        document.body.classList.remove('sidebar-nav-open');
        menuBtn.innerHTML = '☰';
        menuBtn.setAttribute('aria-label', '開啟導覽選單');
    }

    function toggleSidebar() {
        if (sidebar && sidebar.classList.contains('sidebar-open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    // ── Event listeners ──
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSidebar();
    });

    backdrop.addEventListener('click', closeSidebar);

    // Close sidebar when a nav item is clicked (for page navigation)
    if (sidebar) {
        sidebar.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                closeSidebar();
            });
        });
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar && sidebar.classList.contains('sidebar-open')) {
            closeSidebar();
        }
    });

    // Close sidebar on resize if becoming desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth > MOBILE_BREAKPOINT) {
            closeSidebar();
        }
    });

})();
