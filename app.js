// ─── Constants ───────────────────────────────────────────────────────────────

const ESTATES = [
  'Mani Iyer Auditorium',
  'SH1','SH2','SH3','SH4','SH5','SH6','SH7','SH8',
  'CR1','CR2','CR3','CR4',
  'Discussion Room',
  'FPM Board Room'
];

const PURPOSES = ['Case Competition', 'Committee Work', 'Personal Project'];

const ADMIN_PASSWORD = 'admin@mba2024';

// 24-hour full-day hourly slots
const TIME_SLOTS = [];
for (let h = 0; h <= 23; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2,'0')}:00`);
}
// START_TIMES: all except midnight end (can't start at 23:00 with no end after it)
// Actually allow starting at any hour; end must be after start
const START_TIMES = TIME_SLOTS.slice(0, -1); // 00:00 to 22:00

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hr}:${String(m).padStart(2,'0')} ${ampm}`;
}

function formatDate(d) {
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function generateId() {
  return 'BK' + Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).substr(2, 3).toUpperCase();
}

function getPurposeClass(p) {
  if (p === 'Case Competition') return 'tag-case';
  if (p === 'Committee Work')  return 'tag-committee';
  return 'tag-personal';
}

function timesOverlap(s1, e1, s2, e2) {
  return s1 < e2 && e1 > s2;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

function getBookings() {
  return JSON.parse(localStorage.getItem('mba_bookings') || '[]');
}

function saveBookings(arr) {
  localStorage.setItem('mba_bookings', JSON.stringify(arr));
}

function addBooking(b) {
  const arr = getBookings();
  arr.push(b);
  saveBookings(arr);
}

function updateBooking(id, changes) {
  const arr = getBookings();
  const idx = arr.findIndex(b => b.id === id);
  if (idx === -1) return null;
  arr[idx] = { ...arr[idx], ...changes, updatedAt: new Date().toISOString() };
  saveBookings(arr);
  return arr[idx];
}

// ─── Conflict detection ───────────────────────────────────────────────────────
// Only approved/modified bookings block slots

function hasConflict(estate, date, start, end, excludeId = null) {
  return getBookings().filter(b =>
    b.id !== excludeId &&
    (b.status === 'approved' || b.status === 'modified') &&
    b.allocatedEstate === estate &&
    b.date === date &&
    timesOverlap(start, end, b.startTime, b.endTime)
  );
}

// ─── Session helpers ──────────────────────────────────────────────────────────

function getStudent()    { return JSON.parse(sessionStorage.getItem('mba_student') || 'null'); }
function setStudent(s)   { sessionStorage.setItem('mba_student', JSON.stringify(s)); }
function clearStudent()  { sessionStorage.removeItem('mba_student'); }

function isAdmin()       { return sessionStorage.getItem('mba_admin') === '1'; }
function setAdmin()      { sessionStorage.setItem('mba_admin', '1'); }
function clearAdmin()    { sessionStorage.removeItem('mba_admin'); }

// ─── UI helpers ───────────────────────────────────────────────────────────────

function flash(id, msg, type = 'success') {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  setTimeout(() => { if (el) el.innerHTML = ''; }, 6000);
}

function fillSelect(id, options, selectedVal = '') {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = '';
  options.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.value ?? o;
    opt.textContent = o.label ?? o;
    if (opt.value === selectedVal) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ─── Page init (called on DOMContentLoaded in each HTML file) ─────────────────

function initStudentPage() {
  // Populate estate dropdown
  fillSelect('estateSelect',
    [{ value: '', label: '— Select an estate —' }, ...ESTATES.map(e => ({ value: e, label: e }))]);

  // Populate start times
  fillSelect('startTime',
    [{ value: '', label: '— Select start time —' },
     ...START_TIMES.map(t => ({ value: t, label: formatTime(t) }))]);

  document.getElementById('bookingDate').min = todayStr();
  document.getElementById('bookingDate').value = todayStr();

  document.getElementById('startTime').addEventListener('change', refreshEndTimes);

  // Auto-restore session
  const s = getStudent();
  if (s) showStudentApp(s);
}

function initAdminPage() {
  fillSelect('filterEstate',
    [{ value: '', label: 'All Estates' }, ...ESTATES.map(e => ({ value: e, label: e }))]);

  fillSelect('modalEstate', ESTATES.map(e => ({ value: e, label: e })));

  const timeOpts = TIME_SLOTS.map(t => ({ value: t, label: formatTime(t) }));
  fillSelect('modalStart', timeOpts);
  fillSelect('modalEnd',   timeOpts);

  document.getElementById('scheduleDate').value = todayStr();

  if (isAdmin()) showAdminDash();
}

// ─── Student: auth ────────────────────────────────────────────────────────────

function studentLogin() {
  const name  = document.getElementById('sName').value.trim();
  const roll  = document.getElementById('sRoll').value.trim();
  const email = document.getElementById('sEmail').value.trim();

  if (!name || !roll || !email) {
    flash('loginAlert', 'Please fill in all fields.', 'error'); return;
  }
  if (!email.includes('@')) {
    flash('loginAlert', 'Enter a valid email address.', 'error'); return;
  }

  const s = { name, roll, email };
  setStudent(s);
  showStudentApp(s);
}

function showStudentApp(s) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display   = 'block';
  document.getElementById('greeting').textContent = `Hi, ${s.name} (${s.roll})`;
  loadMyBookings();
}

function studentLogout() {
  clearStudent();
  location.reload();
}

// ─── Student: tabs ────────────────────────────────────────────────────────────

function switchTab(tabId, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(tabId).classList.add('active');
  if (tabId === 'paneMyBookings') loadMyBookings();
}

// ─── Student: booking list ────────────────────────────────────────────────────

let myFilter = 'all';

function setFilter(status, btn) {
  myFilter = status;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadMyBookings();
}

function loadMyBookings() {
  const s = getStudent();
  if (!s) return;

  let list = getBookings().filter(b => b.studentRoll === s.roll);
  if (myFilter !== 'all') list = list.filter(b => b.status === myFilter);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const c = document.getElementById('bookingsList');
  if (!c) return;

  if (!list.length) {
    c.innerHTML = `<div class="empty"><div class="empty-icon">📋</div>
      <p>No bookings found.</p>
      <span>Use the "New Request" tab to submit a booking.</span></div>`;
    return;
  }

  c.innerHTML = list.map(b => {
    const reassigned = b.status === 'modified' && b.allocatedEstate !== b.requestedEstate;
    return `
    <div class="bcard bcard-${b.status}">
      <div class="bcard-left">
        <div class="bcard-estate">${b.allocatedEstate}</div>
        ${reassigned ? `<div class="bcard-reassigned">Originally: ${b.requestedEstate} → Reassigned by admin</div>` : ''}
        <div class="bcard-meta">
          <span>📅 ${formatDate(b.date)}</span>
          <span>🕐 ${formatTime(b.startTime)} – ${formatTime(b.endTime)}</span>
          <span>👥 ${b.numPeople} ${b.numPeople === 1 ? 'person' : 'people'}</span>
        </div>
        <div class="bcard-tags">
          <span class="purpose-tag ${getPurposeClass(b.purpose)}">${b.purpose}</span>
        </div>
        ${b.adminNote ? `<div class="admin-note">💬 Admin: ${b.adminNote}</div>` : ''}
      </div>
      <div class="bcard-right">
        <span class="badge badge-${b.status}">${b.status}</span>
        <div class="bcard-id">${b.id}</div>
        <div class="bcard-date">Submitted ${new Date(b.createdAt).toLocaleDateString('en-IN')}</div>
      </div>
    </div>`;
  }).join('');
}

// ─── Student: submit booking ──────────────────────────────────────────────────

function refreshEndTimes() {
  const start = document.getElementById('startTime').value;
  const endSel = document.getElementById('endTime');
  endSel.innerHTML = '<option value="">— Select end time —</option>';
  if (!start) return;
  const idx = TIME_SLOTS.indexOf(start);
  TIME_SLOTS.slice(idx + 1).forEach(t => {
    const o = document.createElement('option');
    o.value = t; o.textContent = formatTime(t);
    endSel.appendChild(o);
  });
}

function submitBooking() {
  const s = getStudent();
  if (!s) return;

  const estate  = document.getElementById('estateSelect').value;
  const date    = document.getElementById('bookingDate').value;
  const start   = document.getElementById('startTime').value;
  const end     = document.getElementById('endTime').value;
  const purpose = document.querySelector('input[name="purpose"]:checked')?.value;
  const desc      = document.getElementById('description').value.trim();
  const numPeople = parseInt(document.getElementById('numPeople').value, 10);

  if (!estate || !date || !start || !end || !purpose) {
    flash('formAlert', 'Please fill in all required fields.', 'error'); return;
  }
  if (!numPeople || numPeople < 1) {
    flash('formAlert', 'Please enter the number of people attending.', 'error'); return;
  }
  if (start >= end) {
    flash('formAlert', 'End time must be after start time.', 'error'); return;
  }

  // Prevent student from double-booking the same time slot (their own pending/approved)
  const clash = getBookings().filter(b =>
    b.studentRoll === s.roll &&
    b.date === date &&
    b.status !== 'rejected' &&
    timesOverlap(start, end, b.startTime, b.endTime)
  );
  if (clash.length) {
    flash('formAlert', 'You already have a booking request for this time window.', 'error'); return;
  }

  const booking = {
    id: generateId(),
    studentName:  s.name,
    studentRoll:  s.roll,
    studentEmail: s.email,
    requestedEstate: estate,
    allocatedEstate: estate,
    date, startTime: start, endTime: end,
    purpose, numPeople, description: desc,
    status: 'pending',
    adminNote: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  addBooking(booking);
  flash('formAlert', `✅ Request submitted! ID: <strong>${booking.id}</strong> — awaiting admin approval.`);
  resetForm();
}

function resetForm() {
  document.getElementById('estateSelect').value = '';
  document.getElementById('bookingDate').value  = todayStr();
  document.getElementById('startTime').value    = '';
  document.getElementById('endTime').innerHTML  = '<option value="">— Select end time —</option>';
  document.querySelectorAll('input[name="purpose"]').forEach(r => r.checked = false);
  document.getElementById('numPeople').value    = '';
  document.getElementById('description').value  = '';
}

// ─── Admin: auth ──────────────────────────────────────────────────────────────

function adminLogin() {
  const pwd = document.getElementById('adminPwd').value;
  if (pwd === ADMIN_PASSWORD) {
    setAdmin();
    showAdminDash();
  } else {
    flash('adminLoginAlert', 'Incorrect password.', 'error');
  }
}

function adminLogout() {
  clearAdmin();
  location.reload();
}

function showAdminDash() {
  document.getElementById('adminLoginScreen').style.display = 'none';
  document.getElementById('adminDash').style.display        = 'block';
  loadStats();
  loadPending();
}

// ─── Admin: tabs ──────────────────────────────────────────────────────────────

function switchAdminTab(tabId, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(tabId).classList.add('active');
  if (tabId === 'aPending')  loadPending();
  if (tabId === 'aAll')      loadAll();
  if (tabId === 'aSchedule') loadSchedule();
}

// ─── Admin: stats ─────────────────────────────────────────────────────────────

function loadStats() {
  const all = getBookings();
  const s = {
    total:    all.length,
    pending:  all.filter(b => b.status === 'pending').length,
    approved: all.filter(b => b.status === 'approved' || b.status === 'modified').length,
    rejected: all.filter(b => b.status === 'rejected').length
  };
  document.getElementById('stats').innerHTML = `
    <div class="stat-card"><div class="stat-num">${s.total}</div><div class="stat-lbl">Total Requests</div></div>
    <div class="stat-card"><div class="stat-num pending-col">${s.pending}</div><div class="stat-lbl">Pending</div></div>
    <div class="stat-card"><div class="stat-num approved-col">${s.approved}</div><div class="stat-lbl">Approved</div></div>
    <div class="stat-card"><div class="stat-num rejected-col">${s.rejected}</div><div class="stat-lbl">Rejected</div></div>
  `;
}

// ─── Admin: pending list ──────────────────────────────────────────────────────

function loadPending() {
  const list = getBookings()
    .filter(b => b.status === 'pending')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const c = document.getElementById('pendingList');
  if (!list.length) {
    c.innerHTML = `<div class="empty"><div class="empty-icon">✅</div>
      <p>All caught up!</p><span>No pending requests at this time.</span></div>`;
    return;
  }
  c.innerHTML = buildTable(list, true);
}

// ─── Admin: all bookings ──────────────────────────────────────────────────────

function loadAll() {
  const statusF = document.getElementById('filterStatus').value;
  const estateF = document.getElementById('filterEstate').value;
  const dateF   = document.getElementById('filterDate').value;

  let list = getBookings();
  if (statusF) list = list.filter(b => b.status === statusF);
  if (estateF) list = list.filter(b => b.allocatedEstate === estateF || b.requestedEstate === estateF);
  if (dateF)   list = list.filter(b => b.date === dateF);
  list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const c = document.getElementById('allList');
  if (!list.length) {
    c.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><p>No bookings match the filters.</p></div>`;
    return;
  }
  c.innerHTML = buildTable(list, false);
}

function clearFilters() {
  document.getElementById('filterStatus').value = '';
  document.getElementById('filterEstate').value = '';
  document.getElementById('filterDate').value   = '';
  loadAll();
}

function buildTable(list, pendingOnly) {
  return `<div class="table-wrap">
  <table class="table">
    <thead><tr>
      <th>ID</th><th>Student</th><th>Requested Estate</th><th>Date & Time</th>
      <th>Purpose</th><th>Status</th><th>Admin Note</th><th>Action</th>
    </tr></thead>
    <tbody>
    ${list.map(b => `
      <tr>
        <td class="mono">${b.id}</td>
        <td>
          <strong>${b.studentName}</strong><br>
          <span class="dim">${b.studentRoll}</span><br>
          <span class="dim small">${b.studentEmail}</span>
        </td>
        <td>
          <strong>${b.allocatedEstate}</strong>
          ${b.allocatedEstate !== b.requestedEstate
            ? `<br><span class="dim small strike">${b.requestedEstate}</span>` : ''}
        </td>
        <td>
          ${formatDate(b.date)}<br>
          <strong>${formatTime(b.startTime)} – ${formatTime(b.endTime)}</strong>
        </td>
        <td><span class="purpose-tag ${getPurposeClass(b.purpose)}">${b.purpose}</span></td>
        <td><span class="badge badge-${b.status}">${b.status}</span></td>
        <td class="dim small">${b.adminNote || '—'}</td>
        <td>
          <button class="btn btn-sm ${b.status === 'pending' ? 'btn-primary' : 'btn-outline'}"
            onclick="openModal('${b.id}')">
            ${b.status === 'pending' ? 'Review' : 'Edit'}
          </button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

// ─── Admin: schedule ──────────────────────────────────────────────────────────

function loadSchedule() {
  const date = document.getElementById('scheduleDate').value;
  if (!date) return;

  const list = getBookings().filter(b =>
    b.date === date && (b.status === 'approved' || b.status === 'modified'));

  const c = document.getElementById('scheduleList');
  if (!list.length) {
    c.innerHTML = `<div class="empty"><div class="empty-icon">📅</div>
      <p>No approved bookings for ${formatDate(date)}.</p></div>`;
    return;
  }

  const byEstate = {};
  list.forEach(b => {
    if (!byEstate[b.allocatedEstate]) byEstate[b.allocatedEstate] = [];
    byEstate[b.allocatedEstate].push(b);
  });

  c.innerHTML = Object.entries(byEstate).map(([estate, bks]) => `
    <div class="card">
      <div class="card-title">🏛 ${estate}</div>
      ${bks.sort((a,b) => a.startTime.localeCompare(b.startTime)).map(b => `
        <div class="schedule-row">
          <div>
            <strong>${formatTime(b.startTime)} – ${formatTime(b.endTime)}</strong>
            <span class="purpose-tag ${getPurposeClass(b.purpose)}" style="margin-left:.5rem">${b.purpose}</span>
            <div class="dim small">${b.studentName} · ${b.studentRoll}</div>
          </div>
          <span class="badge badge-${b.status}">${b.status}</span>
        </div>`).join('')}
    </div>`).join('');
}

// ─── Admin: modal ─────────────────────────────────────────────────────────────

let _modalId   = null;
let _modifying = false;

function openModal(id) {
  _modalId   = id;
  _modifying = false;

  const b = getBookings().find(x => x.id === id);
  if (!b) return;

  document.getElementById('modalTitle').textContent = `Review Request — ${b.id}`;
  document.getElementById('adminNote').value         = b.adminNote || '';
  document.getElementById('modifyFields').style.display = 'none';
  document.getElementById('conflictWarn').style.display = 'none';

  // Pre-fill modify fields with current values
  document.getElementById('modalEstate').value = b.allocatedEstate;
  document.getElementById('modalStart').value  = b.startTime;
  document.getElementById('modalEnd').value    = b.endTime;

  const pc = getPurposeClass(b.purpose);
  document.getElementById('modalInfo').innerHTML = `
    <div class="info-grid">
      <div><span class="info-lbl">Student</span>${b.studentName}</div>
      <div><span class="info-lbl">Roll No</span>${b.studentRoll}</div>
      <div><span class="info-lbl">Email</span>${b.studentEmail}</div>
      <div><span class="info-lbl">Purpose</span><span class="purpose-tag ${pc}">${b.purpose}</span></div>
      <div><span class="info-lbl">Requested Estate</span><strong>${b.requestedEstate}</strong></div>
      <div><span class="info-lbl">Allocated Estate</span><strong>${b.allocatedEstate}</strong></div>
      <div><span class="info-lbl">Date</span>${formatDate(b.date)}</div>
      <div><span class="info-lbl">Time</span><strong>${formatTime(b.startTime)} – ${formatTime(b.endTime)}</strong></div>
      <div><span class="info-lbl">No. of People</span><strong>${b.numPeople || '—'}</strong></div>
      ${b.description ? `<div style="grid-column:1/-1"><span class="info-lbl">Notes</span>${b.description}</div>` : ''}
      <div style="grid-column:1/-1"><span class="info-lbl">Status</span><span class="badge badge-${b.status}">${b.status}</span></div>
    </div>`;

  // Warn if requested estate already has a conflict
  const conflicts = hasConflict(b.requestedEstate, b.date, b.startTime, b.endTime, b.id);
  if (conflicts.length) {
    const w = document.getElementById('conflictWarn');
    w.style.display = 'block';
    w.textContent   = `⚠️ Conflict: "${b.requestedEstate}" is already booked during this slot by ${conflicts.map(c => c.studentName).join(', ')}. Use "Modify" to reassign.`;
  }

  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  _modalId   = null;
  _modifying = false;
}

function toggleModify() {
  _modifying = !_modifying;
  document.getElementById('modifyFields').style.display = _modifying ? 'block' : 'none';
  document.getElementById('modifyBtn').textContent = _modifying ? 'Cancel Modify' : 'Modify';
}

function processAction(action) {
  if (!_modalId) return;
  const b = getBookings().find(x => x.id === _modalId);
  if (!b) return;

  const note = document.getElementById('adminNote').value.trim();
  let updates = { adminNote: note };

  if (action === 'reject') {
    updates.status = 'rejected';

  } else if (action === 'approve') {
    if (_modifying) {
      const newEstate = document.getElementById('modalEstate').value;
      const newStart  = document.getElementById('modalStart').value;
      const newEnd    = document.getElementById('modalEnd').value;

      if (!newEstate || !newStart || !newEnd) {
        flash('dashAlert', 'Please fill in all modification fields.', 'error'); return;
      }
      if (newStart >= newEnd) {
        flash('dashAlert', 'End time must be after start time.', 'error'); return;
      }

      const conflicts = hasConflict(newEstate, b.date, newStart, newEnd, b.id);
      if (conflicts.length) {
        flash('dashAlert', `⚠️ Conflict: "${newEstate}" is already booked for that slot.`, 'error'); return;
      }

      updates = { ...updates, status: 'modified',
        allocatedEstate: newEstate, startTime: newStart, endTime: newEnd };

    } else {
      // Direct approve — re-check conflicts
      const conflicts = hasConflict(b.requestedEstate, b.date, b.startTime, b.endTime, b.id);
      if (conflicts.length) {
        const w = document.getElementById('conflictWarn');
        w.style.display = 'block';
        w.textContent   = `⚠️ Cannot approve: conflict exists. Use "Modify" to reassign the estate.`;
        return;
      }
      updates = { ...updates, status: 'approved', allocatedEstate: b.requestedEstate };
    }
  }

  updateBooking(_modalId, updates);
  closeModal();
  loadStats();
  loadPending();

  const verb = updates.status === 'approved' ? 'approved' :
               updates.status === 'modified' ? 'approved with modifications' : 'rejected';
  flash('dashAlert', `✅ Booking <strong>${_modalId}</strong> has been ${verb}.`);
}
