/**
 * MICA Estate Bookings - Role Management & Password Protection
 *
 * ⚠️ NOTE: For production, store passwords in environment variables or use proper auth
 * Current passwords are stored in sessionStorage for this implementation
 */

// ─── Password Configuration ──────────────────────────────────────────────────
// Change these passwords as needed. In production, use Supabase Auth instead.

const ROLE_PASSWORDS = {
  'mcsa': 'mcsa@2024',           // MCSA portal password
  'administration': 'admin@2024'  // Administration portal password
};

// ─── Session Management ──────────────────────────────────────────────────────

function getMcsaSession() {
  return sessionStorage.getItem('mica_mcsa_session') === '1';
}

function setMcsaSession() {
  sessionStorage.setItem('mica_mcsa_session', '1');
}

function clearMcsaSession() {
  sessionStorage.removeItem('mica_mcsa_session');
}

function getAdminSession() {
  return sessionStorage.getItem('mica_admin_session') === '1';
}

function setAdminSession() {
  sessionStorage.setItem('mica_admin_session', '1');
}

function clearAdminSession() {
  sessionStorage.removeItem('mica_admin_session');
}

// ─── Password Validation ─────────────────────────────────────────────────────

function validatePassword(role, password) {
  return password === ROLE_PASSWORDS[role];
}

// ─── MCSA Login ──────────────────────────────────────────────────────────────

function mcsaLogin() {
  const password = document.getElementById('mcsaPassword').value;
  const alertEl = document.getElementById('mcsaLoginAlert');

  if (!password) {
    flash(alertEl, 'Please enter a password.', 'error');
    return;
  }

  if (validatePassword('mcsa', password)) {
    setMcsaSession();
    showMcsaDashboard();
  } else {
    flash(alertEl, 'Incorrect password.', 'error');
    document.getElementById('mcsaPassword').value = '';
  }
}

function mcsaLogout() {
  clearMcsaSession();
  location.reload();
}

function showMcsaDashboard() {
  const loginScreen = document.getElementById('mcsaLoginScreen');
  const dashboard = document.getElementById('mcsaDashboard');

  if (loginScreen) loginScreen.style.display = 'none';
  if (dashboard) dashboard.style.display = 'block';

  // Load initial data
  loadMcsaPendingBookings();
}

// ─── Administration Login ────────────────────────────────────────────────────

function adminLogin() {
  const password = document.getElementById('adminPassword').value;
  const alertEl = document.getElementById('adminLoginAlert');

  if (!password) {
    flash(alertEl, 'Please enter a password.', 'error');
    return;
  }

  if (validatePassword('administration', password)) {
    setAdminSession();
    showAdminDashboard();
  } else {
    flash(alertEl, 'Incorrect password.', 'error');
    document.getElementById('adminPassword').value = '';
  }
}

function adminLogout() {
  clearAdminSession();
  location.reload();
}

function showAdminDashboard() {
  const loginScreen = document.getElementById('adminLoginScreen');
  const dashboard = document.getElementById('adminDashboard');

  if (loginScreen) loginScreen.style.display = 'none';
  if (dashboard) dashboard.style.display = 'block';

  // Load initial data
  loadAdminCompiledLists();
}

// ─── Page Initialization ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  // Check if this is MCSA page
  if (document.getElementById('mcsaLoginScreen')) {
    if (getMcsaSession()) {
      showMcsaDashboard();
    } else {
      document.getElementById('mcsaLoginScreen').style.display = 'flex';
      document.getElementById('mcsaDashboard').style.display = 'none';
    }

    // Enter key support
    document.getElementById('mcsaPassword')?.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') mcsaLogin();
    });
  }

  // Check if this is Administration page
  if (document.getElementById('adminLoginScreen')) {
    if (getAdminSession()) {
      showAdminDashboard();
    } else {
      document.getElementById('adminLoginScreen').style.display = 'flex';
      document.getElementById('adminDashboard').style.display = 'none';
    }

    // Enter key support
    document.getElementById('adminPassword')?.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') adminLogin();
    });
  }
});

// ─── UI Helper ───────────────────────────────────────────────────────────────

function flash(elementOrId, msg, type = 'success') {
  let el = elementOrId;
  if (typeof elementOrId === 'string') {
    el = document.getElementById(elementOrId);
  }

  if (!el) return;

  el.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  setTimeout(() => {
    if (el) el.innerHTML = '';
  }, 6000);
}

// ─── Export for use in other files ───────────────────────────────────────────
window.roleHelpers = {
  getMcsaSession,
  getAdminSession,
  mcsaLogin,
  mcsaLogout,
  adminLogin,
  adminLogout,
  validatePassword
};
