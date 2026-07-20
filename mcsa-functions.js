/**
 * MCSA Portal Functions
 * Functions for MCSA to review and compile bookings
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const ESTATES = [
  'Mani Iyer Auditorium',
  'SH1','SH2','SH3','SH4','SH5','SH6','SH7','SH8',
  'CR1','CR2','CR3','CR4',
  'Discussion Room',
  'FPM Board Room'
];

// Global variable to track current booking being reviewed
let _mcsaCurrentBookingId = null;

// ─── Tab Switching ──────────────────────────────────────────────────────────

function switchMcsaTab(tabId, element) {
  // Hide all tabs
  document.querySelectorAll('.tab-pane').forEach(tab => {
    tab.classList.remove('active');
  });

  // Remove active from all tab buttons
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  const tab = document.getElementById(tabId);
  if (tab) {
    tab.classList.add('active');
    element.classList.add('active');

    // Load data for this tab
    if (tabId === 'mcsaPending') loadMcsaPendingBookings();
    if (tabId === 'mcsaCompiled') loadMcsaCompiledLists();
    if (tabId === 'mcsaStats') loadMcsaStats();
  }
}

// ─── Load Pending Bookings ───────────────────────────────────────────────────

async function loadMcsaPendingBookings() {
  try {
    const dateFilter = document.getElementById('mcsaFilterDate')?.value;
    const estateFilter = document.getElementById('mcsaFilterEstate')?.value;

    // Populate estate dropdown if not done
    if (!document.getElementById('mcsaFilterEstate')?.innerHTML.includes('Mani')) {
      const select = document.getElementById('mcsaFilterEstate');
      select.innerHTML = '<option value="">All Estates</option>';
      ESTATES.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e;
        opt.textContent = e;
        select.appendChild(opt);
      });
    }

    const { data, error } = await db
      .from('bookings')
      .select('*')
      .eq('status', 'pending')
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching bookings:', error);
      flash('mcsaAlert', 'Failed to load bookings', 'error');
      return;
    }

    // Apply filters
    let filtered = data || [];

    if (dateFilter) {
      filtered = filtered.filter(b => b.booking_date === dateFilter);
    }

    if (estateFilter) {
      filtered = filtered.filter(b =>
        b.requested_estate === estateFilter || b.allocated_estate === estateFilter
      );
    }

    // Display
    const container = document.getElementById('mcsaPendingList');
    if (!filtered.length) {
      container.innerHTML = `
        <div class="empty">
          <div class="empty-icon">✅</div>
          <p>All caught up!</p>
          <span>No pending bookings to review.</span>
        </div>`;
      return;
    }

    container.innerHTML = filtered.map(b => `
      <div class="booking-card booking-card-pending">
        <div class="booking-header">
          <h3>${b.requested_estate}</h3>
          <span class="status-badge pending">Pending Review</span>
        </div>

        <div class="booking-details">
          <div class="detail-row">
            <span class="label">Student:</span>
            <span class="value">${b.student_name} (${b.student_roll})</span>
          </div>
          <div class="detail-row">
            <span class="label">Email:</span>
            <span class="value">${b.student_email}</span>
          </div>
          <div class="detail-row">
            <span class="label">Date & Time:</span>
            <span class="value">${formatDate(b.booking_date)} • ${formatTime(b.start_time)} – ${formatTime(b.end_time)}</span>
          </div>
          <div class="detail-row">
            <span class="label">Purpose:</span>
            <span class="value">${b.purpose}</span>
          </div>
          <div class="detail-row">
            <span class="label">People:</span>
            <span class="value">${b.num_people}</span>
          </div>
          ${b.description ? `<div class="detail-row"><span class="label">Description:</span><span class="value">${b.description}</span></div>` : ''}
        </div>

        <div class="booking-actions">
          <button class="btn btn-sm btn-primary" onclick="openMcsaModal('${b.id}')">
            Review Booking
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Unexpected error:', err);
    flash('mcsaAlert', 'Error loading bookings', 'error');
  }
}

// ─── MCSA Modal Functions ────────────────────────────────────────────────────

async function openMcsaModal(bookingId) {
  try {
    _mcsaCurrentBookingId = bookingId;

    const { data, error } = await db
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Error fetching booking:', error);
      return;
    }

    // Check for conflicts
    const { data: conflicts } = await db
      .from('bookings')
      .select('*')
      .eq('allocated_estate', data.requested_estate)
      .in('status', ['mcsa_approved', 'admin_approved'])
      .neq('id', bookingId)
      .or(`booking_date.eq.${data.booking_date},booking_date.eq.${data.end_date}`);

    let conflictHtml = '';
    if (conflicts && conflicts.length > 0) {
      conflictHtml = `
        <div class="alert alert-warning">
          ⚠️ <strong>Potential Conflict:</strong> "${data.requested_estate}" has existing bookings:
          <ul>
            ${conflicts.map(c => `<li>${c.student_name} on ${formatDate(c.booking_date)} ${formatTime(c.start_time)}-${formatTime(c.end_time)}</li>`).join('')}
          </ul>
        </div>`;
    }

    document.getElementById('mcsaModalInfo').innerHTML = `
      <div class="info-grid">
        <div><span class="info-lbl">Booking ID</span><code>${data.id}</code></div>
        <div><span class="info-lbl">Student</span>${data.student_name}</div>
        <div><span class="info-lbl">Roll No</span>${data.student_roll}</div>
        <div><span class="info-lbl">Email</span>${data.student_email}</div>
        <div><span class="info-lbl">Requested Estate</span><strong>${data.requested_estate}</strong></div>
        <div><span class="info-lbl">Date</span>${formatDate(data.booking_date)}</div>
        <div><span class="info-lbl">Time</span>${formatTime(data.start_time)} – ${formatTime(data.end_time)}</div>
        <div><span class="info-lbl">People</span>${data.num_people}</div>
        <div><span class="info-lbl">Purpose</span>${data.purpose}</div>
        ${data.description ? `<div style="grid-column: 1/-1"><span class="info-lbl">Description</span>${data.description}</div>` : ''}
        ${conflictHtml}
      </div>`;

    document.getElementById('mcsaModalNote').value = data.mcsa_note || '';

    // Show modal
    document.getElementById('mcsaModal').classList.add('active');
  } catch (err) {
    console.error('Error:', err);
  }
}

function closeMcsaModal() {
  document.getElementById('mcsaModal').classList.remove('active');
  _mcsaCurrentBookingId = null;
}

async function processMcsaApprove() {
  if (!_mcsaCurrentBookingId) return;

  const note = document.getElementById('mcsaModalNote').value;

  try {
    const { data, error } = await db
      .from('bookings')
      .update({
        status: 'mcsa_approved',
        mcsa_note: note,
        mcsa_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', _mcsaCurrentBookingId)
      .select();

    if (error) {
      console.error('Error:', error);
      flash('mcsaAlert', 'Failed to approve booking', 'error');
      return;
    }

    flash('mcsaAlert', `✅ Booking approved`, 'success');
    closeMcsaModal();
    loadMcsaPendingBookings();
  } catch (err) {
    console.error('Unexpected error:', err);
    flash('mcsaAlert', 'Error approving booking', 'error');
  }
}

async function processMcsaReject() {
  if (!_mcsaCurrentBookingId) return;

  const note = document.getElementById('mcsaModalNote').value;

  if (!note) {
    flash('mcsaAlert', 'Please add a reason for rejection', 'error');
    return;
  }

  try {
    const { data, error } = await db
      .from('bookings')
      .update({
        status: 'mcsa_rejected',
        mcsa_note: note,
        mcsa_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', _mcsaCurrentBookingId)
      .select();

    if (error) {
      console.error('Error:', error);
      flash('mcsaAlert', 'Failed to reject booking', 'error');
      return;
    }

    flash('mcsaAlert', `❌ Booking rejected`, 'success');
    closeMcsaModal();
    loadMcsaPendingBookings();
  } catch (err) {
    console.error('Unexpected error:', err);
    flash('mcsaAlert', 'Error rejecting booking', 'error');
  }
}

// ─── Compile Daily Bookings ─────────────────────────────────────────────────

async function compileTodayBookings() {
  try {
    const compilationDate = document.getElementById('compilationDate').value;

    if (!compilationDate) {
      flash('mcsaAlert', 'Please select a date to compile', 'error');
      return;
    }

    // Get all MCSA-approved bookings for the day
    const { data: bookings, error: bkError } = await db
      .from('bookings')
      .select('*')
      .eq('booking_date', compilationDate)
      .in('status', ['mcsa_approved', 'mcsa_rejected']);

    if (bkError) {
      console.error('Error:', bkError);
      flash('mcsaAlert', 'Failed to fetch bookings', 'error');
      return;
    }

    const approvedCount = (bookings || []).filter(b => b.status === 'mcsa_approved').length;
    const rejectedCount = (bookings || []).filter(b => b.status === 'mcsa_rejected').length;

    // Create compilation record
    const { data: compilation, error: cError } = await db
      .from('daily_compilations')
      .insert([{
        compilation_date: compilationDate,
        compiled_by: 'mcsa_team', // In real app, use auth email
        total_bookings: (bookings || []).length,
        approved_count: approvedCount,
        rejected_count: rejectedCount,
        status: 'pending_admin'
      }])
      .select();

    if (cError) {
      console.error('Error:', cError);
      flash('mcsaAlert', 'Failed to create compilation', 'error');
      return;
    }

    flash('mcsaAlert',
      `✅ Compiled ${approvedCount} approved + ${rejectedCount} rejected bookings for ${compilationDate}. Sent to Administration!`,
      'success');

    loadMcsaCompiledLists();
  } catch (err) {
    console.error('Unexpected error:', err);
    flash('mcsaAlert', 'Error compiling bookings', 'error');
  }
}

// ─── Load Compiled Lists ─────────────────────────────────────────────────────

async function loadMcsaCompiledLists() {
  try {
    const { data, error } = await db
      .from('daily_compilations')
      .select('*')
      .order('compilation_date', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error:', error);
      return;
    }

    const container = document.getElementById('mcsaCompiledList');

    if (!data || !data.length) {
      container.innerHTML = `
        <div class="empty">
          <div class="empty-icon">📦</div>
          <p>No compilations yet</p>
          <span>Compile today's bookings to get started</span>
        </div>`;
      return;
    }

    container.innerHTML = data.map(c => `
      <div class="compilation-card">
        <div class="compilation-header">
          <h3>📅 ${formatDate(c.compilation_date)}</h3>
          <span class="status-badge ${c.status === 'pending_admin' ? 'pending' : 'success'}">
            ${c.status === 'pending_admin' ? '⏳ Pending Admin Review' : '✅ Admin Reviewed'}
          </span>
        </div>

        <div class="compilation-stats">
          <div class="stat">
            <div class="stat-num">${c.total_bookings}</div>
            <div class="stat-lbl">Total Bookings</div>
          </div>
          <div class="stat">
            <div class="stat-num" style="color: #10b981;">${c.approved_count}</div>
            <div class="stat-lbl">Approved</div>
          </div>
          <div class="stat">
            <div class="stat-num" style="color: #ef4444;">${c.rejected_count}</div>
            <div class="stat-lbl">Rejected</div>
          </div>
        </div>

        <div class="compilation-meta">
          <small>Compiled on ${new Date(c.compiled_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// ─── Statistics ──────────────────────────────────────────────────────────────

async function loadMcsaStats() {
  try {
    const { data, error } = await db
      .from('bookings')
      .select('status');

    if (error) {
      console.error('Error:', error);
      return;
    }

    const stats = {
      pending: (data || []).filter(b => b.status === 'pending').length,
      mcsa_approved: (data || []).filter(b => b.status === 'mcsa_approved').length,
      mcsa_rejected: (data || []).filter(b => b.status === 'mcsa_rejected').length
    };

    const container = document.getElementById('mcsaStatsCards');
    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-num pending-col">${stats.pending}</div>
        <div class="stat-lbl">Pending Review</div>
      </div>
      <div class="stat-card">
        <div class="stat-num approved-col">${stats.mcsa_approved}</div>
        <div class="stat-lbl">MCSA Approved</div>
      </div>
      <div class="stat-card">
        <div class="stat-num rejected-col">${stats.mcsa_rejected}</div>
        <div class="stat-lbl">MCSA Rejected</div>
      </div>
    `;
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// ─── Filters ─────────────────────────────────────────────────────────────────

function clearMcsaFilters() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('mcsaFilterDate').value = today;
  document.getElementById('mcsaFilterEstate').value = '';
  loadMcsaPendingBookings();
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hr = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${hr}:${m} ${ampm}`;
}

function flash(elementId, msg, type = 'success') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  setTimeout(() => { if (el) el.innerHTML = ''; }, 6000);
}
