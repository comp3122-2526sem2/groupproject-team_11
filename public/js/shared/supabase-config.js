/**
 * supabase-config.js
 * Initializes the Supabase JS client from CDN.
 * The Supabase library is loaded via <script> tag in HTML pages.
 *
 * Usage: include this file AFTER the Supabase CDN script in your HTML.
 * Then access `window.supabaseClient` from any module.
 */

// =============================================
// ⚠️ CONFIGURE THESE VALUES
// Go to Supabase Dashboard → Settings → API
// =============================================
const SUPABASE_URL = 'https://jyhlihembbifhkkfhaik.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5aGxpaGVtYmJpZmhra2ZoYWlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDU0MDcsImV4cCI6MjA5MDk4MTQwN30.Hk30bw2jfMt79tlCBkyh-hHi_xg31cjCFjtCykQi7lk';

// Initialize client (uses the global `supabase` from CDN)
if (typeof supabase !== 'undefined' && supabase.createClient) {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error('[supabase-config] Supabase SDK not loaded. Make sure the CDN script is included before this file.');
    window.supabaseClient = null;
}

// =============================================
// Student ID Authentication (browser-local)
// Uses student ID as the user identifier.
// Stored in localStorage — no password required.
// =============================================
const STUDENT_ID_KEY = 'mathHub.studentId';

function getStudentId() {
    return localStorage.getItem(STUDENT_ID_KEY);
}

function setStudentId(id) {
    localStorage.setItem(STUDENT_ID_KEY, id);
}

function clearStudentId() {
    localStorage.removeItem(STUDENT_ID_KEY);
}

function isLoggedIn() {
    return !!getStudentId();
}

// Backward-compatible alias — used by DBService._userId()
function getAnonymousUserId() {
    return getStudentId() || '';
}

window.getStudentId = getStudentId;
window.setStudentId = setStudentId;
window.clearStudentId = clearStudentId;
window.isLoggedIn = isLoggedIn;
window.getAnonymousUserId = getAnonymousUserId;
