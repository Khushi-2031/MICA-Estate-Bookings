/**
 * Administration Portal Functions
 * Functions for administrators to review and finalize bookings
 */

// Global variable to track current booking being reviewed
let _adminCurrentBookingId = null;

// ─── Tab Switching ──────────────────────────────────────────────────────────

function switchAdminTab(tabId, element) {
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
    if (tabId === 'adminCompilations') loadAdminCompiledLists();
    if (tabId === 'adminReviewDay') {
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('adminReviewDate').value = today;
    }
    if (tabId === 'adminHistory') {
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('adminHistoryEndDate').value = today;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      document.getElementById('adminHistoryStartDate').value = sevenDaysAgo.toISOString().split('T')[0];
    }
  }
}

// ─── Load Compilations Inbox ────────────────────────────────────────────────

async function loadAdminCompiledLists() {
  try {
    const { data, error } = await db
      .from('daily_compilations')
      .select('*')
      .eq('status', 'pending_admin')
      .order('compilation_date', { ascending: false });

    if (error) {
      console.error('Error:', error);
      flash('adminAlert', 'Failed to load compilations', 'error');
      return;
    }

    const container = document.getElementById('adminCompilationsList');

    if (!data || !data.length) {
      container.innerHTML = `
        <div class="empty">
          <div class="empty-icon">✅</div>
          <p>No compilations pending review</p>
          <span>All MCSA compilations have been reviewed</span>
        </div>`;
      return;
    }

    container.innerHTML = data.map(c => `
      <div class="compilation-card compilation-card-pending">
        <div class="compilation-header">
          <h3>📋 ${formatDate(c.compilation_date)}</h3>
          <span class="status-badge pending">⏳ Awaiting Review</span>
        </div>

        <div class="compilation-stats">
          <div class="stat">
            <div class="stat-num">${c.total_bookings}</div>
            <div class="stat-lbl">Total Bookings</div>
          </div>
          <div class="stat">
            <div class="stat-num" style="color: #10b981;">${c.approved_count}</div>
            <div class="stat-lbl">Approved by MCSA</div>
          </div>
          <div class="stat">
            <div class="stat-num" style="color: #ef4444;">${c.rejected_count}</div>
            <div class="stat-lbl">Rejected by MCSA</div>
          </div>
        </div>

        <div class="compilation-action">
          <button class="btn btn-primary" onclick="loadAdminBookingsForCompilation('${c.id}')">
            Review Compilation
          </button>
        </div>

        <div class="compilation-meta">
          <small>Compiled on ${new Date(c.compiled_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Unexpected error:', err);
    flash('adminAlert', 'Error loading compilations', 'error');
  }
}

// ─── Load Bookings for Compilation ──────────────────────────────────────────

async function loadAdminBookingsForCompilation(compilationId) {
  try {
    // Get compilation details
    const { data: compilation, error: cError } = await db
      .from('daily_compilations')
      .select('*')
      .eq('id', compilationId)
      .single();

    if (cError) {
      console.error('Error:', cError);
      flash('adminAlert', 'Failed to load compilation', 'error');
      return;
    }

    // Get all bookings for that date
    const { data: bookings, error: bError } = await db
      .from('bookings')
      .select('*')
      .eq('booking_date', compilation.compilation_date)
      .in('status', ['mcsa_approved', 'mcsa_rejected'])
      .order('start_time', { ascending: true });

    if (bError) {
      console.error('Error:', bError);
      flash('adminAlert', 'Failed to load bookings', 'error');
      return;
    }

    // Display in review tab
    const container = document.getElementById('adminBookingsList');
    const bookingsToReview = bookings.filter(b => b.status === 'mcsa_approved');
    const rejectedBookings = bookings.filter(b => b.status === 'mcsa_rejected');

    let html = `<div class="compilation-review">`;

    if (bookingsToReview.length > 0) {
      html += `<h3>📋 Awaiting Your Final Decision (${bookingsToReview.length})</h3>`;
      html += bookingsToReview.map(b => `
        <div class="booking-card booking-card-review">
          <div class="booking-header">
            <h4>${b.allocated_estate}</h4>
            <span class="status-badge" style="background: #60a5fa;">MCSA Approved</span>
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
            ${b.mcsa_note ? `<div class="detail-row" style="background: #f0f0f0; padding: 8px; border-radius: 4px;">
              <span class="label">MCSA Note:</span>
              <span class="value">${b.mcsa_note}</span>
            </div>` : ''}
          </div>

          <div class="booking-actions">
            <button class="btn btn-sm btn-primary" onclick="openAdminModal('${b.id}')">
              Final Decision
            </button>
          </div>
        </div>
      `).join('');
    }

    if (rejectedBookings.length > 0) {
      html += `<h3 style="margin-top: 20px;">❌ Already Rejected by MCSA (${rejectedBookings.length})</h3>`;
      html += rejectedBookings.map(b => `
        <div class="booking-card" style="opacity: 0.7;">
          <div class="booking-header">
            <h4>${b.allocated_estate}</h4>
            <span class="status-badge" style="background: #ef4444;">Rejected by MCSA</span>
          </div>
          <div class="detail-row">
            <span class="label">Student:</span>
            <span class="value">${b.student_name}</span>
          </div>
          ${b.mcsa_note ? `<div class="detail-row"><span class="label">Reason:</span><span class="value">${b.mcsa_note}</span></div>` : ''}
        </div>
      `).join('');
    }

    html += `</div>`;
    container.innerHTML = html;

    // Update compilation status
    await db
      .from('daily_compilations')
      .update({ status: 'admin_reviewed' })
      .eq('id', compilationId);

  } catch (err) {
    console.error('Unexpected error:', err);
    flash('adminAlert', 'Error loading bookings', 'error');
  }
}

// ─── Load Bookings by Date ──────────────────────────────────────────────────

async function loadAdminBookingsForDate() {
  try {
    const date = document.getElementById('adminReviewDate').value;
    const status = document.getElementById('adminReviewStatus').value;

    if (!date) {
      flash('adminAlert', 'Please select a date', 'error');
      return;
    }

    let query = db
      .from('bookings')
      .select('*')
      .eq('booking_date', date)
      .in('status', ['mcsa_approved', 'mcsa_rejected', 'admin_approved', 'admin_rejected']);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('start_time', { ascending: true });

    if (error) {
      console.error('Error:', error);
      flash('adminAlert', 'Failed to load bookings', 'error');
      return;
    }

    const container = document.getElementById('adminBookingsList');

    if (!data || !data.length) {
      container.innerHTML = `
        <div class="empty">
          <div class="empty-icon">📭</div>
          <p>No bookings found</p>
          <span>for ${date}</span>
        </div>`;
      return;
    }

    container.innerHTML = data.map(b => {
      const isFinalized = ['admin_approved', 'admin_rejected'].includes(b.status);
      return `
        <div class="booking-card ${isFinalized ? 'booking-card-finalized' : 'booking-card-review'}">
          <div class="booking-header">
            <h4>${b.allocated_estate}</h4>
            <span class="status-badge ${getStatusClass(b.status)}">${getStatusLabel(b.status)}</span>
          </div>

          <div class="booking-details">
            <div class="detail-row">
              <span class="label">Student:</span>
              <span class="value">${b.student_name} (${b.student_roll})</span>
            </div>
            <div class="detail-row">
              <span class="label">Time:</span>
              <span class="value">${formatTime(b.start_time)} – ${formatTime(b.end_time)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Purpose:</span>
              <span class="value">${b.purpose}</span>
            </div>
            ${b.mcsa_note ? `<div class="detail-row"><span class="label">MCSA Note:</span><span class="value">${b.mcsa_note}</span></div>` : ''}
            ${b.admin_comment ? `<div class="detail-row"><span class="label">Admin Comment:</span><span class="value">${b.admin_comment}</span></div>` : ''}
          </div>

          ${!isFinalized && b.status === 'mcsa_approved' ? `
            <div class="booking-actions">
              <button class="btn btn-sm btn-primary" onclick="openAdminModal('${b.id}')">
                Final Decision
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Unexpected error:', err);
    flash('adminAlert', 'Error loading bookings', 'error');
  }
}

// ─── Load History ────────────────────────────────────────────────────────────

async function loadAdminHistory() {
  try {
    const startDate = document.getElementById('adminHistoryStartDate').value;
    const endDate = document.getElementById('adminHistoryEndDate').value;

    if (!startDate || !endDate) {
      flash('adminAlert', 'Please select date range', 'error');
      return;
    }

    const { data, error } = await db
      .from('bookings')
      .select('*')
      .gte('booking_date', startDate)
      .lte('booking_date', endDate)
      .in('status', ['admin_approved', 'admin_rejected'])
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (error) {
      console.error('Error:', error);
      flash('adminAlert', 'Failed to load history', 'error');
      return;
    }

    const container = document.getElementById('adminHistoryList');

    if (!data || !data.length) {
      container.innerHTML = `
        <div class="empty">
          <div class="empty-icon">📭</div>
          <p>No completed bookings</p>
          <span>in this date range</span>
        </div>`;
      return;
    }

    // Group by date
    const byDate = {};
    data.forEach(b => {
      if (!byDate[b.booking_date]) byDate[b.booking_date] = [];
      byDate[b.booking_date].push(b);
    });

    container.innerHTML = Object.entries(byDate).map(([date, bookings]) => `
      <div class="history-section">
        <h3>📅 ${formatDate(date)}</h3>
        ${bookings.map(b => `
          <div class="booking-card booking-card-finalized">
            <div class="booking-header">
              <h4>${b.allocated_estate}</h4>
              <span class="status-badge ${b.status === 'admin_approved' ? 'success' : 'danger'}">
                ${b.status === 'admin_approved' ? '✅ Approved' : '❌ Rejected'}
              </span>
            </div>
            <div class="booking-details">
              <div class="detail-row">
                <span class="label">Student:</span>
                <span class="value">${b.student_name}</span>
              </div>
              <div class="detail-row">
                <span class="label">Time:</span>
                <span class="value">${formatTime(b.start_time)} – ${formatTime(b.end_time)}</span>
              </div>
              <div class="detail-row">
                <span class="label">Purpose:</span>
                <span class="value">${b.purpose}</span>
              </div>
              ${b.admin_comment ? `<div class="detail-row"><span class="label">Comment:</span><span class="value">${b.admin_comment}</span></div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');
  } catch (err) {
    console.error('Unexpected error:', err);
    flash('adminAlert', 'Error loading history', 'error');
  }
}

// ─── Admin Modal Functions ───────────────────────────────────────────────────

async function openAdminModal(bookingId) {
  try {
    _adminCurrentBookingId = bookingId;

    const { data, error } = await db
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Error:', error);
      return;
    }

    document.getElementById('adminModalInfo').innerHTML = `
      <div class="info-grid">
        <div><span class="info-lbl">Booking ID</span><code>${data.id}</code></div>
        <div><span class="info-lbl">Student</span>${data.student_name}</div>
        <div><span class="info-lbl">Roll No</span>${data.student_roll}</div>
        <div><span class="info-lbl">Email</span>${data.student_email}</div>
        <div><span class="info-lbl">Estate</span><strong>${data.allocated_estate}</strong></div>
        <div><span class="info-lbl">Date</span>${formatDate(data.booking_date)}</div>
        <div><span class="info-lbl">Time</span>${formatTime(data.start_time)} – ${formatTime(data.end_time)}</div>
        <div><span class="info-lbl">People</span>${data.num_people}</div>
        <div><span class="info-lbl">Purpose</span>${data.purpose}</div>
        ${data.description ? `<div style="grid-column: 1/-1"><span class="info-lbl">Description</span>${data.description}</div>` : ''}
        ${data.mcsa_note ? `<div style="grid-column: 1/-1; background: #f0f0f0; padding: 8px; border-radius: 4px;"><span class="info-lbl">MCSA Note:</span>${data.mcsa_note}</div>` : ''}
      </div>`;

    document.getElementById('adminModalComment').value = data.admin_comment || '';

    // Show modal
    document.getElementById('adminModal').classList.add('active');
  } catch (err) {
    console.error('Error:', err);
  }
}

function closeAdminModal() {
  document.getElementById('adminModal').classList.remove('active');
  _adminCurrentBookingId = null;
}

async function processAdminApprove() {
  if (!_adminCurrentBookingId) return;

  const comment = document.getElementById('adminModalComment').value;

  try {
    const { error } = await db
      .from('bookings')
      .update({
        status: 'admin_approved',
        admin_comment: comment,
        admin_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', _adminCurrentBookingId);

    if (error) {
      console.error('Error:', error);
      flash('adminAlert', 'Failed to approve booking', 'error');
      return;
    }

    flash('adminAlert', `✅ Booking approved and finalized`, 'success');
    closeAdminModal();
    switchAdminTab('adminCompilations', document.querySelector('.tab'));
    loadAdminCompiledLists();
  } catch (err) {
    console.error('Unexpected error:', err);
    flash('adminAlert', 'Error approving booking', 'error');
  }
}

async function processAdminReject() {
  if (!_adminCurrentBookingId) return;

  const comment = document.getElementById('adminModalComment').value;

  if (!comment) {
    flash('adminAlert', 'Please add a reason for rejection', 'error');
    return;
  }

  try {
    const { error } = await db
      .from('bookings')
      .update({
        status: 'admin_rejected',
        admin_comment: comment,
        admin_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', _adminCurrentBookingId);

    if (error) {
      console.error('Error:', error);
      flash('adminAlert', 'Failed to reject booking', 'error');
      return;
    }

    flash('adminAlert', `❌ Booking rejected`, 'success');
    closeAdminModal();
    switchAdminTab('adminCompilations', document.querySelector('.tab'));
    loadAdminCompiledLists();
  } catch (err) {
    console.error('Unexpected error:', err);
    flash('adminAlert', 'Error rejecting booking', 'error');
  }
}

async function processAdminComment() {
  if (!_adminCurrentBookingId) return;

  const comment = document.getElementById('adminModalComment').value;

  if (!comment) {
    flash('adminAlert', 'Please add a comment', 'error');
    return;
  }

  try {
    const { error } = await db
      .from('bookings')
      .update({
        status: 'admin_comments_pending',
        admin_comment: comment,
        updated_at: new Date().toISOString()
      })
      .eq('id', _adminCurrentBookingId);

    if (error) {
      console.error('Error:', error);
      flash('adminAlert', 'Failed to add comment', 'error');
      return;
    }

    flash('adminAlert', `💬 Comment sent back to MCSA`, 'success');
    closeAdminModal();
    switchAdminTab('adminCompilations', document.querySelector('.tab'));
    loadAdminCompiledLists();
  } catch (err) {
    console.error('Unexpected error:', err);
    flash('adminAlert', 'Error adding comment', 'error');
  }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function getStatusClass(status) {
  const classes = {
    'mcsa_approved': 'primary',
    'mcsa_rejected': 'danger',
    'admin_approved': 'success',
    'admin_rejected': 'danger',
    'admin_comments_pending': 'warning'
  };
  return classes[status] || 'secondary';
}

function getStatusLabel(status) {
  const labels = {
    'mcsa_approved': 'MCSA Approved',
    'mcsa_rejected': 'Rejected by MCSA',
    'admin_approved': '✅ Approved',
    'admin_rejected': '❌ Rejected',
    'admin_comments_pending': '💬 Awaiting MCSA'
  };
  return labels[status] || status;
}

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
