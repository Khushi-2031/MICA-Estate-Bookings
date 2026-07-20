# MICA Estate Bookings × Supabase Integration Guide

## 📊 Current Architecture

**Repository:** `Khushi-2031/MICA-Estate-Bookings`

### Tech Stack
- **Frontend:** Vanilla JavaScript (HTML, CSS, JS)
- **Storage:** Browser `localStorage` (no backend)
- **Deployment:** GitHub Pages
- **Structure:** Single-page app with student & admin portals

### Key Features
- Student registration + booking submission
- Admin approval/rejection/modification workflow
- Conflict detection for overlapping bookings
- Support for same-day and overnight bookings
- Real-time stats and filtering

**Problem:** All data is lost when users clear browser cache. No data persistence, no centralized database.

---

## 🎯 Why Supabase?

Supabase gives you:
- ✅ PostgreSQL database (persistent storage)
- ✅ Real-time updates (live collaboration features)
- ✅ Authentication (email/password, magic links, OAuth)
- ✅ Row-level security (fine-grained access control)
- ✅ REST API + JavaScript SDK (easy integration)
- ✅ Free tier (perfect for MVP)

---

## 📋 Database Schema

### Table: `bookings`

```sql
create table bookings (
  id text primary key default gen_random_uuid()::text,
  student_name text not null,
  student_roll text not null,
  student_email text not null,
  requested_estate text not null,
  allocated_estate text not null,
  booking_date date not null,
  end_date date not null,
  start_time text not null,
  end_time text not null,
  purpose text not null,
  num_people integer not null,
  description text,
  status text not null default 'pending',
  admin_note text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes for performance
create index idx_student_roll on bookings(student_roll);
create index idx_status on bookings(status);
create index idx_allocated_estate on bookings(allocated_estate);
create index idx_booking_date on bookings(booking_date);
```

### Table: `admin_users` (Optional - for role-based access)

```sql
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamp with time zone default now()
);
```

---

## 🚀 Step-by-Step Setup

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up / log in
3. Create a new project:
   - **Name:** `mica-estate-bookings`
   - **Database Password:** Generate a strong one (save it!)
   - **Region:** Choose closest to India (Singapore is good)
4. Wait for project to initialize (~2 min)

### Step 2: Create Database Tables

1. Go to **SQL Editor** in your Supabase dashboard
2. Paste the schema above and run it
3. Verify tables are created

### Step 3: Set Up Row-Level Security (RLS)

Enable RLS on the `bookings` table:

```sql
alter table bookings enable row level security;

-- Allow students to see only their own bookings
create policy "Students can view own bookings"
  on bookings for select
  using (auth.jwt() ->> 'email' = student_email);

-- Allow students to insert their own bookings
create policy "Students can insert own bookings"
  on bookings for insert
  with check (auth.jwt() ->> 'email' = student_email);

-- Allow admins to view all bookings (optional - add email checks)
create policy "Admins can view all bookings"
  on bookings for select
  using (true); -- Replace with admin email check if needed

-- Allow admins to update any booking
create policy "Admins can update bookings"
  on bookings for update
  using (true); -- Replace with admin email check if needed
```

### Step 4: Get Your Supabase Credentials

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://your-project.supabase.co`)
   - **Anon Key** (public key for frontend)
3. Keep these safe!

---

## 💻 Code Integration

### Step 1: Add Supabase to Your Project

```html
<!-- In index.html, admin.html, student.html -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### Step 2: Create `supabase-client.js`

Create a new file `supabase-client.js` in your repo root:

```javascript
// supabase-client.js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in app.js
window.supabaseDB = db;
```

### Step 3: Update `app.js` - Replace localStorage with Supabase

**Old (localStorage):**
```javascript
function getBookings() {
  return JSON.parse(localStorage.getItem('mba_bookings') || '[]');
}

function saveBookings(arr) {
  localStorage.setItem('mba_bookings', JSON.stringify(arr));
}
```

**New (Supabase):**
```javascript
// Global cache to avoid excessive API calls
let bookingsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds

async function getBookings() {
  const now = Date.now();
  
  // Return cache if still fresh
  if (bookingsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return bookingsCache;
  }

  try {
    const { data, error } = await db
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching bookings:', error);
      return [];
    }
    
    // Transform database fields to match app's camelCase
    bookingsCache = data.map(b => ({
      id: b.id,
      studentName: b.student_name,
      studentRoll: b.student_roll,
      studentEmail: b.student_email,
      requestedEstate: b.requested_estate,
      allocatedEstate: b.allocated_estate,
      date: b.booking_date,
      endDate: b.end_date,
      startTime: b.start_time,
      endTime: b.end_time,
      purpose: b.purpose,
      numPeople: b.num_people,
      description: b.description,
      status: b.status,
      adminNote: b.admin_note,
      createdAt: b.created_at,
      updatedAt: b.updated_at
    }));
    
    cacheTimestamp = now;
    return bookingsCache;
  } catch (err) {
    console.error('Unexpected error:', err);
    return [];
  }
}

async function addBooking(booking) {
  try {
    const { data, error } = await db
      .from('bookings')
      .insert([{
        student_name: booking.studentName,
        student_roll: booking.studentRoll,
        student_email: booking.studentEmail,
        requested_estate: booking.requestedEstate,
        allocated_estate: booking.allocatedEstate,
        booking_date: booking.date,
        end_date: booking.endDate,
        start_time: booking.startTime,
        end_time: booking.endTime,
        purpose: booking.purpose,
        num_people: booking.numPeople,
        description: booking.description,
        status: booking.status
      }])
      .select();
    
    if (error) {
      console.error('Error adding booking:', error);
      return null;
    }
    
    // Clear cache to force refresh
    bookingsCache = null;
    return data[0];
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}

async function updateBooking(id, changes) {
  try {
    // Convert camelCase to snake_case
    const dbChanges = {};
    if (changes.status) dbChanges.status = changes.status;
    if (changes.adminNote) dbChanges.admin_note = changes.adminNote;
    if (changes.allocatedEstate) dbChanges.allocated_estate = changes.allocatedEstate;
    if (changes.startTime) dbChanges.start_time = changes.startTime;
    if (changes.endTime) dbChanges.end_time = changes.endTime;
    if (changes.endDate) dbChanges.end_date = changes.endDate;
    
    dbChanges.updated_at = new Date().toISOString();

    const { data, error } = await db
      .from('bookings')
      .update(dbChanges)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating booking:', error);
      return null;
    }

    // Clear cache
    bookingsCache = null;
    return data[0];
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}
```

### Step 4: Update HTML Files

Add this to `<head>` of **index.html**, **student.html**, and **admin.html**:

```html
<script src="supabase-client.js"></script>
```

---

## ⚠️ Important Changes to Functions

Since `getBookings()` is now **async**, functions that call it need updates:

**Before:**
```javascript
function loadMyBookings() {
  const s = getStudent();
  let list = getBookings().filter(b => b.studentRoll === s.roll);
  // ...
}
```

**After:**
```javascript
async function loadMyBookings() {
  const s = getStudent();
  const bookings = await getBookings();
  let list = bookings.filter(b => b.studentRoll === s.roll);
  // ...
}
```

**Functions to update (make async & await):**
- `loadMyBookings()`
- `loadStats()`
- `loadPending()`
- `loadAll()`
- `loadSchedule()`
- `submitBooking()` (call `addBooking()` with await)
- `processAction()` (call `updateBooking()` with await)
- `hasConflict()` (make async, await `getBookings()`)

**Event listeners that call async functions:**
```javascript
// OLD
document.getElementById('submitBtn').addEventListener('click', submitBooking);

// NEW
document.getElementById('submitBtn').addEventListener('click', async () => {
  await submitBooking();
});
```

---

## 🔐 Authentication (Optional but Recommended)

Replace hardcoded `sessionStorage` with Supabase Auth:

```javascript
// Sign up / login student
async function studentLogin() {
  const name  = document.getElementById('sName').value.trim();
  const roll  = document.getElementById('sRoll').value.trim();
  const email = document.getElementById('sEmail').value.trim();

  if (!name || !roll || !email) {
    flash('loginAlert', 'Please fill in all fields.', 'error');
    return;
  }

  try {
    // Sign in with passwordless link (magic link)
    const { error } = await db.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: window.location.origin + '/student.html',
      },
    });

    if (error) {
      flash('loginAlert', error.message, 'error');
      return;
    }

    flash('loginAlert', `Check your email (${email}) for login link!`, 'success');
    
    // Store local info temporarily
    const s = { name, roll, email };
    setStudent(s);
  } catch (err) {
    flash('loginAlert', 'Login failed: ' + err.message, 'error');
  }
}

// Check if user is logged in on page load
async function checkAuth() {
  const { data } = await db.auth.getSession();
  if (data.session) {
    const user = data.session.user;
    // Auto-login if session exists
    const s = getStudent();
    if (s) showStudentApp(s);
  }
}

// Call on page load
document.addEventListener('DOMContentLoaded', checkAuth);
```

---

## 🧪 Testing Your Integration

1. **Add a test booking in Supabase dashboard:**
   - Go to SQL Editor
   - Insert test data
   - Refresh your app

2. **Test in browser:**
   - Open student.html
   - Submit a booking
   - Check Supabase dashboard → `bookings` table
   - Verify data appears!

3. **Test admin approval:**
   - Go to admin.html
   - Approve/reject booking
   - Check if status updates in Supabase

---

## 🐛 Common Issues & Solutions

### Issue 1: CORS Error
**Error:** `No 'Access-Control-Allow-Origin' header`

**Solution:** Supabase handles CORS automatically. Make sure you're using the correct URL (with `https://`).

### Issue 2: Authentication Required
**Error:** `Row Level Security (RLS) policy rejected`

**Solution:** Disable RLS temporarily for testing:
```sql
alter table bookings disable row level security;
```

Then re-enable after testing with proper policies.

### Issue 3: Async/Await Issues
**Error:** `getBookings is not a function / undefined`

**Solution:** Ensure you're using `await getBookings()` in async functions.

### Issue 4: Real-time Updates Not Working
**Solution:** Subscribe to changes:
```javascript
db.from('bookings')
  .on('*', payload => {
    console.log('Change received!', payload);
    bookingsCache = null; // Clear cache
    loadMyBookings(); // Refresh UI
  })
  .subscribe();
```

---

## 📦 File Checklist

Files to modify:
- ✅ `index.html` - Add Supabase script
- ✅ `student.html` - Add Supabase script
- ✅ `admin.html` - Add Supabase script
- ✅ `app.js` - Replace localStorage functions
- ✅ Create `supabase-client.js` - New file with credentials

---

## 🎉 What's Next?

After integration:
1. **Add email notifications** - Send email when booking is approved/rejected
2. **Real-time collaboration** - Admins see live updates of new bookings
3. **User profiles** - Store student preferences
4. **Analytics** - Track booking patterns, peak times
5. **Mobile app** - Use the same Supabase backend for React Native/Flutter

---

## 📚 Resources

- [Supabase Docs](https://supabase.com/docs)
- [Supabase JavaScript SDK](https://supabase.com/docs/reference/javascript)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Async/Await Reference](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Promises)

---

## 💡 Pro Tips

1. **Use environment variables** for Supabase credentials in production
2. **Enable RLS** for security - don't expose all data to all users
3. **Cache aggressively** - Supabase has rate limits on free tier
4. **Monitor logs** - Use Supabase dashboard to debug issues
5. **Test with dummy data** before going live

---

**Need help? Message me or check Supabase Discord community!** 🚀
