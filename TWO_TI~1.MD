# MICA Estate Bookings: Two-Tier Approval System (Admin + MCSA)

## 📋 Workflow Overview

```
STUDENT SUBMITS BOOKING
        ↓
    [PENDING]
        ↓
   MCSA REVIEWS & APPROVES/REJECTS
        ↓
   [MCSA_APPROVED] or [MCSA_REJECTED]
        ↓
   MCSA COMPILES DAILY LIST
        ↓
   ADMIN REVIEWS COMPILED LIST
        ↓
[ADMIN_APPROVED] or [ADMIN_REJECTED] or [COMMENTS_ADDED]
```

---

## 🗄️ Updated Database Schema

### Table: `users`

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  role text not null default 'student', -- student, mcsa, admin
  created_at timestamp with time zone default now()
);

create index idx_users_email on users(email);
create index idx_users_role on users(role);
```

### Table: `bookings` (Updated)

```sql
-- Drop old table if migrating
-- drop table bookings;

create table bookings (
  id text primary key default gen_random_uuid()::text,
  
  -- Student info
  student_name text not null,
  student_roll text not null,
  student_email text not null,
  
  -- Booking details
  requested_estate text not null,
  allocated_estate text not null,
  booking_date date not null,
  end_date date not null,
  start_time text not null,
  end_time text not null,
  purpose text not null,
  num_people integer not null,
  description text,
  
  -- Approval workflow
  status text not null default 'pending',
  -- Status values:
  -- pending → awaiting MCSA review
  -- mcsa_approved → MCSA approved, awaiting admin
  -- mcsa_rejected → MCSA rejected
  -- admin_approved → Admin approved (final)
  -- admin_rejected → Admin rejected (final)
  -- admin_comments_pending → Admin wants to comment before final decision
  
  -- Admin notes (MCSA level)
  mcsa_note text,
  mcsa_approved_by text, -- MCSA email
  mcsa_approved_at timestamp with time zone,
  
  -- Admin notes (Admin level)
  admin_note text,
  admin_comment text, -- For communication back to MCSA
  admin_approved_by text, -- Admin email
  admin_approved_at timestamp with time zone,
  
  -- Audit
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes
create index idx_bookings_student_roll on bookings(student_roll);
create index idx_bookings_status on bookings(status);
create index idx_bookings_allocated_estate on bookings(allocated_estate);
create index idx_bookings_booking_date on bookings(booking_date);
create index idx_bookings_mcsa_approved_by on bookings(mcsa_approved_by);
create index idx_bookings_admin_approved_by on bookings(admin_approved_by);
```

### Table: `daily_compilations` (New - for tracking MCSA's compiled lists)

```sql
create table daily_compilations (
  id uuid primary key default gen_random_uuid(),
  compilation_date date not null,
  compiled_by text not null, -- MCSA email
  compiled_at timestamp with time zone default now(),
  total_bookings integer not null default 0,
  approved_count integer not null default 0,
  rejected_count integer not null default 0,
  status text not null default 'pending_admin', 
  -- pending_admin, admin_reviewed, admin_approved
  admin_reviewed_by text, -- Admin email
  admin_reviewed_at timestamp with time zone,
  notes text,
  
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_compilations_date on daily_compilations(compilation_date);
create index idx_compilations_status on daily_compilations(status);
```

---

## 🔐 Row-Level Security (RLS) Policies

```sql
-- Enable RLS
alter table users enable row level security;
alter table bookings enable row level security;
alter table daily_compilations enable row level security;

-- USERS: Students can only view their own; MCSA/Admin see all
create policy "Users can view own profile"
  on users for select
  using (auth.jwt() ->> 'email' = email);

create policy "MCSA and Admin can view all users"
  on users for select
  using ((select role from users where email = auth.jwt() ->> 'email') in ('mcsa', 'admin'));

-- BOOKINGS: Role-based access
create policy "Students can view own bookings"
  on bookings for select
  using (auth.jwt() ->> 'email' = student_email);

create policy "Students can insert own bookings"
  on bookings for insert
  with check (auth.jwt() ->> 'email' = student_email);

create policy "MCSA can view all pending bookings"
  on bookings for select
  using ((select role from users where email = auth.jwt() ->> 'email') = 'mcsa');

create policy "MCSA can update bookings (approve/reject)"
  on bookings for update
  using ((select role from users where email = auth.jwt() ->> 'email') = 'mcsa'
    and status = 'pending');

create policy "Admin can view all bookings (MCSA approved only)"
  on bookings for select
  using ((select role from users where email = auth.jwt() ->> 'email') = 'admin'
    and status in ('mcsa_approved', 'mcsa_rejected'));

create policy "Admin can update approved bookings"
  on bookings for update
  using ((select role from users where email = auth.jwt() ->> 'email') = 'admin'
    and status = 'mcsa_approved');

-- DAILY_COMPILATIONS
create policy "MCSA can create compilations"
  on daily_compilations for insert
  with check ((select role from users where email = auth.jwt() ->> 'email') = 'mcsa');

create policy "MCSA can view own compilations"
  on daily_compilations for select
  using ((select role from users where email = auth.jwt() ->> 'email') = 'mcsa'
    and compiled_by = auth.jwt() ->> 'email');

create policy "Admin can view all compilations"
  on daily_compilations for select
  using ((select role from users where email = auth.jwt() ->> 'email') = 'admin');

create policy "Admin can update compilations"
  on daily_compilations for update
  using ((select role from users where email = auth.jwt() ->> 'email') = 'admin');
```

---

## 💻 Updated Code Structure

### New File: `roles.js` - Role-based helpers

```javascript
// ─── Role Management ─────────────────────────────────────────────────────────

const ROLES = {
  STUDENT: 'student',
  MCSA: 'mcsa',
  ADMIN: 'admin'
};

// Get current user's role
async function getCurrentUserRole() {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return null;

    const { data, error } = await db
      .from('users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (error) {
      console.error('Error fetching role:', error);
      return null;
    }

    return data.role;
  } catch (err) {
    console.error('Error:', err);
    return null;
  }
}

// Check if user has permission
async function hasPermission(requiredRole) {
  const userRole = await getCurrentUserRole();
  const roleHierarchy = {
    'student': 0,
    'mcsa': 1,
    'admin': 2
  };
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

// Show/hide UI based on role
async function updateUIByRole() {
  const role = await getCurrentUserRole();

  // Hide all portals by default
  document.querySelectorAll('[data-role]').forEach(el => {
    el.style.display = 'none';
  });

  // Show only the appropriate portal
  const portal = document.querySelector(`[data-role="${role}"]`);
  if (portal) {
    portal.style.display = 'block';
  }

  // Hide admin-only elements if not admin
  if (role !== 'admin') {
    document.querySelectorAll('[data-admin-only]').forEach(el => {
      el.style.display = 'none';
    });
  }

  // Hide MCSA-only elements if not MCSA
  if (role !== 'mcsa') {
    document.querySelectorAll('[data-mcsa-only]').forEach(el => {
      el.style.display = 'none';
    });
  }
}

// ─── Authentication ──────────────────────────────────────────────────────────

/**
 * Login with email/password and check role
 */
async function loginUser(email, password) {
  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      console.error('Login error:', error.message);
      return null;
    }

    // Fetch user role
    const role = await getCurrentUserRole();
    console.log(`User logged in as ${role}`);

    return { user: data.user, role: role };
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}

/**
 * Register a new user and assign role
 */
async function registerUser(email, password, name, role = 'student') {
  try {
    // Sign up in auth
    const { data, error } = await db.auth.signUp({
      email: email,
      password: password
    });

    if (error) {
      console.error('Sign up error:', error.message);
      return null;
    }

    // Add to users table
    const { error: dbError } = await db
      .from('users')
      .insert([{
        email: email,
        name: name,
        role: role
      }]);

    if (dbError) {
      console.error('Error creating user record:', dbError.message);
      return null;
    }

    console.log(`User registered as ${role}`);
    return data.user;
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}
```

---

## 📊 MCSA Portal Functions

### New File: `mcsa-functions.js`

```javascript
// ─── MCSA: View Pending Bookings ──────────────────────────────────────────────

async function loadMcsaPendingBookings() {
  try {
    const { data, error } = await db
      .from('bookings')
      .select('*')
      .eq('status', 'pending')
      .order('booking_date', { ascending: true });

    if (error) {
      console.error('Error fetching pending bookings:', error);
      return [];
    }

    return data.map(b => transformBooking(b));
  } catch (err) {
    console.error('Unexpected error:', err);
    return [];
  }
}

// ─── MCSA: Approve/Reject Booking ────────────────────────────────────────────

async function mcsaApproveBooking(bookingId, note = '') {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return null;

    const { data, error } = await db
      .from('bookings')
      .update({
        status: 'mcsa_approved',
        mcsa_note: note,
        mcsa_approved_by: session.user.email,
        mcsa_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select();

    if (error) {
      console.error('Error approving booking:', error);
      flash('mcsaAlert', 'Failed to approve booking', 'error');
      return null;
    }

    flash('mcsaAlert', `✅ Booking ${bookingId} approved by MCSA`, 'success');
    return transformBooking(data[0]);
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}

async function mcsaRejectBooking(bookingId, note = '') {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return null;

    const { data, error } = await db
      .from('bookings')
      .update({
        status: 'mcsa_rejected',
        mcsa_note: note,
        mcsa_approved_by: session.user.email,
        mcsa_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select();

    if (error) {
      console.error('Error rejecting booking:', error);
      flash('mcsaAlert', 'Failed to reject booking', 'error');
      return null;
    }

    flash('mcsaAlert', `❌ Booking ${bookingId} rejected by MCSA`, 'success');
    return transformBooking(data[0]);
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}

// ─── MCSA: Compile Daily List ────────────────────────────────────────────────

async function compileDailyBookings(compilationDate) {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return null;

    // Get all MCSA-approved bookings for the day
    const { data: bookings, error: bookingsError } = await db
      .from('bookings')
      .select('*')
      .eq('booking_date', compilationDate)
      .in('status', ['mcsa_approved', 'mcsa_rejected']);

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      return null;
    }

    const approvedCount = bookings.filter(b => b.status === 'mcsa_approved').length;
    const rejectedCount = bookings.filter(b => b.status === 'mcsa_rejected').length;

    // Create daily compilation record
    const { data: compilation, error: compilationError } = await db
      .from('daily_compilations')
      .insert([{
        compilation_date: compilationDate,
        compiled_by: session.user.email,
        total_bookings: bookings.length,
        approved_count: approvedCount,
        rejected_count: rejectedCount,
        status: 'pending_admin'
      }])
      .select();

    if (compilationError) {
      console.error('Error creating compilation:', compilationError);
      flash('mcsaAlert', 'Failed to create daily compilation', 'error');
      return null;
    }

    flash('mcsaAlert', 
      `✅ Compiled ${approvedCount} approved bookings for ${compilationDate}. Sent to Admin for review.`, 
      'success');

    return {
      compilation: compilation[0],
      bookings: bookings.map(b => transformBooking(b))
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}

// ─── MCSA: View Compiled Lists ───────────────────────────────────────────────

async function loadMcsaCompiledLists() {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return [];

    const { data, error } = await db
      .from('daily_compilations')
      .select('*')
      .eq('compiled_by', session.user.email)
      .order('compilation_date', { ascending: false });

    if (error) {
      console.error('Error fetching compilations:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Unexpected error:', err);
    return [];
  }
}
```

---

## 📋 Admin Portal (Updated)

### New File: `admin-functions.js`

```javascript
// ─── Admin: View Daily Compilations ──────────────────────────────────────────

async function loadAdminCompiledLists() {
  try {
    const { data, error } = await db
      .from('daily_compilations')
      .select('*')
      .eq('status', 'pending_admin')
      .order('compilation_date', { ascending: false });

    if (error) {
      console.error('Error fetching compilations:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Unexpected error:', err);
    return [];
  }
}

// ─── Admin: View Bookings for a Date ─────────────────────────────────────────

async function loadAdminBookingsForDate(compilationId) {
  try {
    // Get compilation details
    const { data: compilation, error: compError } = await db
      .from('daily_compilations')
      .select('*')
      .eq('id', compilationId)
      .single();

    if (compError) {
      console.error('Error fetching compilation:', compError);
      return null;
    }

    // Get all bookings for that date (that were MCSA-approved)
    const { data: bookings, error: bookingsError } = await db
      .from('bookings')
      .select('*')
      .eq('booking_date', compilation.compilation_date)
      .in('status', ['mcsa_approved', 'mcsa_rejected'])
      .order('start_time', { ascending: true });

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      return null;
    }

    return {
      compilation: compilation,
      bookings: bookings.map(b => transformBooking(b))
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}

// ─── Admin: Approve Booking (Final) ──────────────────────────────────────────

async function adminApproveFinal(bookingId, comment = '') {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return null;

    const { data, error } = await db
      .from('bookings')
      .update({
        status: 'admin_approved',
        admin_comment: comment,
        admin_approved_by: session.user.email,
        admin_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select();

    if (error) {
      console.error('Error approving booking:', error);
      flash('adminAlert', 'Failed to approve booking', 'error');
      return null;
    }

    flash('adminAlert', `✅ Booking approved by Admin`, 'success');
    return transformBooking(data[0]);
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}

// ─── Admin: Reject Booking (Final) ───────────────────────────────────────────

async function adminRejectFinal(bookingId, comment = '') {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return null;

    const { data, error } = await db
      .from('bookings')
      .update({
        status: 'admin_rejected',
        admin_comment: comment,
        admin_approved_by: session.user.email,
        admin_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select();

    if (error) {
      console.error('Error rejecting booking:', error);
      flash('adminAlert', 'Failed to reject booking', 'error');
      return null;
    }

    flash('adminAlert', `❌ Booking rejected by Admin`, 'success');
    return transformBooking(data[0]);
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}

// ─── Admin: Add Comments/Communication ───────────────────────────────────────

async function adminAddComments(bookingId, comment) {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return null;

    const { data, error } = await db
      .from('bookings')
      .update({
        status: 'admin_comments_pending',
        admin_comment: comment,
        admin_approved_by: session.user.email,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select();

    if (error) {
      console.error('Error adding comment:', error);
      flash('adminAlert', 'Failed to add comment', 'error');
      return null;
    }

    flash('adminAlert', `💬 Comment added for MCSA review`, 'success');
    return transformBooking(data[0]);
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}

// ─── Admin: Mark Compilation as Reviewed ─────────────────────────────────────

async function adminMarkCompilationReviewed(compilationId) {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return null;

    const { data, error } = await db
      .from('daily_compilations')
      .update({
        status: 'admin_reviewed',
        admin_reviewed_by: session.user.email,
        admin_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', compilationId)
      .select();

    if (error) {
      console.error('Error marking compilation as reviewed:', error);
      return null;
    }

    return data[0];
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}
```

---

## 📄 New HTML Portals

### Structure for Three Portals

```html
<!-- index.html - Portal Selection -->
<div class="landing">
  <h1>Estate Booking Portal</h1>
  <div class="portal-cards">
    <a href="student.html" class="portal-card">
      <div class="portal-icon">👨‍🎓</div>
      <div class="portal-title">Student</div>
    </a>
    <a href="mcsa.html" class="portal-card">
      <div class="portal-icon">📋</div>
      <div class="portal-title">MCSA</div>
    </a>
    <a href="admin.html" class="portal-card">
      <div class="portal-icon">👨‍💼</div>
      <div class="portal-title">Admin / Registrar</div>
    </a>
  </div>
</div>

<!-- mcsa.html - MCSA Portal Structure -->
<div id="mcsaPortal" data-role="mcsa">
  <!-- Tab: Pending Bookings -->
  <div class="tab-pane" id="mcsaPending">
    <h2>📋 Pending Bookings (To Review)</h2>
    <div id="mcsaPendingList"></div>
  </div>

  <!-- Tab: Compiled Lists -->
  <div class="tab-pane" id="mcsaCompiled">
    <h2>✅ My Compiled Lists</h2>
    <button onclick="compileTodayBookings()">Compile Today's Bookings</button>
    <div id="mcsaCompiledList"></div>
  </div>

  <!-- Modal for MCSA Decision -->
  <div id="mcsaModal">
    <h3>Review Booking Request</h3>
    <div id="mcsaBookingInfo"></div>
    <textarea id="mcsaNoteInput" placeholder="Add internal note..."></textarea>
    <button onclick="processMcsaApprove()">✅ Approve</button>
    <button onclick="processMcsaReject()">❌ Reject</button>
  </div>
</div>

<!-- admin.html - Admin Portal Structure -->
<div id="adminPortal" data-role="admin">
  <!-- Tab: Daily Compilations -->
  <div class="tab-pane" id="adminCompilations">
    <h2>📊 Today's Compiled Bookings (From MCSA)</h2>
    <div id="adminCompilationsList"></div>
  </div>

  <!-- Tab: Review Compilation -->
  <div class="tab-pane" id="adminReviewDay">
    <h2>📅 Review Date's Bookings</h2>
    <input type="date" id="adminReviewDate">
    <button onclick="loadAdminBookingsForSelectedDate()">Load Bookings</button>
    <div id="adminBookingsList"></div>
  </div>

  <!-- Modal for Admin Final Decision -->
  <div id="adminModal">
    <h3>Final Decision on Booking</h3>
    <div id="adminBookingInfo"></div>
    <textarea id="adminCommentInput" placeholder="Add comment/communication..."></textarea>
    <button onclick="processAdminApprove()">✅ Approve</button>
    <button onclick="processAdminReject()">❌ Reject</button>
    <button onclick="processAdminComment()">💬 Add Comment Only</button>
  </div>
</div>
```

---

## 🔄 Updated Booking Status Values

```javascript
const BOOKING_STATUSES = {
  PENDING: 'pending',                    // Waiting for MCSA review
  MCSA_APPROVED: 'mcsa_approved',        // MCSA approved, awaiting admin
  MCSA_REJECTED: 'mcsa_rejected',        // MCSA rejected (final)
  ADMIN_COMMENTS_PENDING: 'admin_comments_pending', // Admin has questions
  ADMIN_APPROVED: 'admin_approved',      // Admin approved (final)
  ADMIN_REJECTED: 'admin_rejected'       // Admin rejected (final)
};

function getStatusColor(status) {
  const colors = {
    'pending': '#fbbf24',           // amber
    'mcsa_approved': '#60a5fa',     // blue
    'mcsa_rejected': '#ef4444',     // red
    'admin_comments_pending': '#f59e0b', // orange
    'admin_approved': '#10b981',    // green
    'admin_rejected': '#dc2626'     // dark red
  };
  return colors[status] || '#6b7280';
}

function getStatusLabel(status) {
  const labels = {
    'pending': 'Awaiting MCSA Review',
    'mcsa_approved': 'MCSA Approved - Awaiting Admin',
    'mcsa_rejected': 'Rejected by MCSA',
    'admin_comments_pending': 'Admin Comments - Awaiting MCSA Response',
    'admin_approved': '✅ Approved (Final)',
    'admin_rejected': '❌ Rejected (Final)'
  };
  return labels[status] || status;
}
```

---

## 🔑 Key Functions Comparison

| Function | Student | MCSA | Admin |
|----------|---------|------|-------|
| Submit booking | ✅ YES | ❌ NO | ❌ NO |
| View own bookings | ✅ YES | ❌ NO | ❌ NO |
| View all pending bookings | ❌ NO | ✅ YES | ❌ NO |
| Approve/reject (MCSA level) | ❌ NO | ✅ YES | ❌ NO |
| Compile daily list | ❌ NO | ✅ YES | ❌ NO |
| View compiled lists | ❌ NO | ✅ YES | ✅ YES |
| Final approve/reject | ❌ NO | ❌ NO | ✅ YES |
| Add comments | ❌ NO | ❌ NO | ✅ YES |

---

## 📊 Daily Compilation Flow

```
MCSA Panel:
1. View all pending bookings
2. Review each booking (approve/reject with notes)
3. Click "Compile Today's Bookings"
   → Creates daily_compilation record
   → Sends to admin for review
4. Can see status: "Pending Admin Review"

Admin Panel:
1. Sees list of compilations awaiting review
2. Clicks on a compilation date
3. Sees all MCSA-approved bookings in detail:
   - Student info
   - Estate & timing
   - MCSA notes
   - Conflict info
4. Makes final decision:
   - ✅ Approve → Booking becomes "admin_approved"
   - ❌ Reject → Booking becomes "admin_rejected"
   - 💬 Comment → Sends back to MCSA for revision
5. Marks compilation as "admin_reviewed"

Student (for tracking):
- Can see current status of their bookings
- See comments from Admin/MCSA when relevant
```

---

## 🧪 Testing the Two-Tier System

1. **Create test users:**
   ```sql
   insert into users (email, name, role) values
   ('student@mica.edu', 'Test Student', 'student'),
   ('mcsa@mica.edu', 'MCSA Team', 'mcsa'),
   ('admin@mica.edu', 'Registrar', 'admin');
   ```

2. **Student flow:**
   - Login as student@mica.edu
   - Submit booking (status: pending)

3. **MCSA flow:**
   - Login as mcsa@mica.edu
   - See booking in "Pending" tab
   - Approve with note → status changes to mcsa_approved
   - Click "Compile Today's Bookings"
   - Daily compilation created

4. **Admin flow:**
   - Login as admin@mica.edu
   - See compilation in inbox
   - Review all approved bookings
   - Approve or reject or comment
   - Booking status updates to admin_approved/rejected

---

## ✅ Summary: What Changed

**Database:**
- Added `users` table for role management
- Updated `bookings` with MCSA approval fields
- Added `daily_compilations` table for tracking

**Code:**
- New `roles.js` for role-based access
- New `mcsa-functions.js` for MCSA operations
- Updated `admin-functions.js` for admin workflow
- Three separate portals: student.html, mcsa.html, admin.html

**Workflow:**
- Student submits → MCSA approves → compiles list → Admin reviews → final decision
- Comments can flow back for revisions
- Audit trail tracking who approved/rejected and when

---

## 🚀 Next Steps

1. Update your database schema with new tables and fields
2. Implement RLS policies for role-based security
3. Create the three portal HTML files
4. Implement the role-based functions
5. Add authentication with Supabase Auth
6. Test the full workflow end-to-end

Need help implementing any part of this?
