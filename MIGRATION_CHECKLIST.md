# MICA Estate Bookings: Supabase Migration Checklist

## ⚡ Quick Start (15 mins)

### Phase 1: Setup (5 minutes)

- [ ] Sign up at [supabase.com](https://supabase.com)
- [ ] Create new project `mica-estate-bookings`
- [ ] Wait for project initialization
- [ ] Go to **Settings → API**
- [ ] Copy **Project URL** → save to `supabase-client.js`
- [ ] Copy **Anon Key** → save to `supabase-client.js`

### Phase 2: Database (3 minutes)

- [ ] Go to **SQL Editor** in Supabase
- [ ] Run the schema SQL from `SUPABASE_INTEGRATION_GUIDE.md`
- [ ] Verify `bookings` table is created
- [ ] Check all columns exist (booking_date, start_time, etc.)

### Phase 3: Files (7 minutes)

- [ ] Add `supabase-client.js` to your repo
- [ ] Add Supabase script to `index.html`:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="supabase-client.js"></script>
  ```
- [ ] Add same scripts to `student.html`
- [ ] Add same scripts to `admin.html`
- [ ] Copy `supabase-client.js` to your project directory

---

## 🔄 Converting app.js Functions

### Step 1: Student Portal - `loadMyBookings()`

**Location:** Line ~280 in app.js

**Current Code:**
```javascript
function loadMyBookings() {
  const s = getStudent();
  if (!s) return;

  let list = getBookings().filter(b => b.studentRoll === s.roll);
  // ... rest of function
}
```

**New Code:**
```javascript
async function loadMyBookings() {
  const s = getStudent();
  if (!s) return;

  const bookings = await getBookings(); // Add await
  let list = bookings.filter(b => b.studentRoll === s.roll);
  // ... rest of function stays the same
}
```

**Changes:**
- Add `async` keyword to function signature
- Add `await` before `getBookings()`
- Store result in variable first

---

### Step 2: Student Portal - `submitBooking()`

**Location:** Line ~355 in app.js

**Current Code:**
```javascript
function submitBooking() {
  const s = getStudent();
  if (!s) return;

  // ... validation code ...

  const booking = { /* ... */ };

  addBooking(booking);
  flash('formAlert', `✅ Request submitted! ID: <strong>${booking.id}</strong>`);
  resetForm();
}
```

**New Code:**
```javascript
async function submitBooking() {
  const s = getStudent();
  if (!s) return;

  // ... validation code stays the same ...

  const booking = { /* ... */ };

  const result = await addBooking(booking); // Add await
  if (!result) {
    // Error is already flashed by addBooking()
    return;
  }

  flash('formAlert', `✅ Request submitted! ID: <strong>${result.id}</strong>`);
  resetForm();
}
```

**Changes:**
- Add `async` keyword
- Add `await` before `addBooking()`
- Check if result is null (error handling)
- Use `result.id` instead of `booking.id`

**Also update the event listener:**
```javascript
// OLD
document.getElementById('submitBtn').addEventListener('click', submitBooking);

// NEW
document.getElementById('submitBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  await submitBooking();
});
```

---

### Step 3: Admin Panel - `loadStats()`

**Location:** Line ~535 in app.js

**Current Code:**
```javascript
function loadStats() {
  const all = getBookings();
  const s = {
    total:    all.length,
    pending:  all.filter(b => b.status === 'pending').length,
    // ...
  };
  // ... render stats ...
}
```

**New Code:**
```javascript
async function loadStats() {
  const all = await getBookings(); // Add await
  const s = {
    total:    all.length,
    pending:  all.filter(b => b.status === 'pending').length,
    // ... rest stays the same
  };
  // ... render stats ...
}
```

**Changes:**
- Add `async` keyword
- Add `await` before `getBookings()`

---

### Step 4: Admin Panel - `loadPending()`

**Location:** Line ~557 in app.js

**Current Code:**
```javascript
function loadPending() {
  const list = getBookings()
    .filter(b => b.status === 'pending')
    // ...
}
```

**New Code:**
```javascript
async function loadPending() {
  const bookings = await getBookings(); // Add await
  const list = bookings
    .filter(b => b.status === 'pending')
    // ... rest stays the same
}
```

---

### Step 5: Admin Panel - `loadAll()`

**Location:** Line ~580 in app.js

**Current Code:**
```javascript
function loadAll() {
  const statusF = document.getElementById('filterStatus').value;
  // ...
  let list = getBookings();
  if (statusF) list = list.filter(/* ... */);
  // ...
}
```

**New Code:**
```javascript
async function loadAll() {
  const statusF = document.getElementById('filterStatus').value;
  // ...
  let list = await getBookings(); // Add await
  if (statusF) list = list.filter(/* ... */);
  // ... rest stays the same
}
```

---

### Step 6: Admin Panel - `loadSchedule()`

**Location:** Line ~612 in app.js

**Current Code:**
```javascript
function loadSchedule() {
  const date = document.getElementById('scheduleDate').value;
  if (!date) return;

  const list = getBookings().filter(/* ... */);
  // ...
}
```

**New Code:**
```javascript
async function loadSchedule() {
  const date = document.getElementById('scheduleDate').value;
  if (!date) return;

  const bookings = await getBookings(); // Add await
  const list = bookings.filter(/* ... */);
  // ... rest stays the same
}
```

---

### Step 7: Admin Panel - `hasConflict()` Helper

**Location:** Line ~120 in app.js

**Current Code:**
```javascript
function hasConflict(estate, startDate, startTime, endDate, endTime, excludeId = null) {
  return getBookings().filter(b => {
    // ... conflict logic ...
  });
}
```

**New Code:**
```javascript
async function hasConflict(estate, startDate, startTime, endDate, endTime, excludeId = null) {
  const bookings = await getBookings(); // Add await
  return bookings.filter(b => {
    // ... conflict logic stays the same ...
  });
}
```

**Also update calls to `hasConflict()`** - they now need `await`:
```javascript
// OLD
const clash = getBookings().filter(b => { ... });

// NEW
const bookings = await getBookings();
const clash = bookings.filter(b => { ... });
```

---

### Step 8: Admin Panel - `processAction()`

**Location:** Line ~705 in app.js

**Current Code:**
```javascript
function processAction(action) {
  if (!_modalId) return;
  const b = getBookings().find(x => x.id === _modalId);
  if (!b) return;

  // ... action logic ...

  updateBooking(_modalId, updates);
  // ... refresh views ...
}
```

**New Code:**
```javascript
async function processAction(action) {
  if (!_modalId) return;
  const bookings = await getBookings(); // Add await
  const b = bookings.find(x => x.id === _modalId);
  if (!b) return;

  // ... action logic stays the same ...

  await updateBooking(_modalId, updates); // Add await
  closeModal();
  await loadStats(); // Add await
  await loadPending(); // Add await
  
  const verb = updates.status === 'approved' ? 'approved' :
               updates.status === 'modified' ? 'approved with modifications' : 'rejected';
  flash('dashAlert', `✅ Booking <strong>${_modalId}</strong> has been ${verb}.`);
}
```

**Changes:**
- Add `async` keyword
- Add `await` before `getBookings()`
- Add `await` before `updateBooking()`
- Add `await` before `loadStats()` and `loadPending()`

---

### Step 9: Tab Switch Handlers

**Location:** Lines ~515, ~595, etc.

**Current Code:**
```javascript
function switchTab(tabId, el) {
  // ... DOM updates ...
  if (tabId === 'paneMyBookings') loadMyBookings();
}
```

**New Code:**
```javascript
async function switchTab(tabId, el) {
  // ... DOM updates stay the same ...
  if (tabId === 'paneMyBookings') await loadMyBookings();
}

function switchAdminTab(tabId, el) {
  // ... DOM updates stay the same ...
  if (tabId === 'aPending')  void loadPending();
  if (tabId === 'aAll')      void loadAll();
  if (tabId === 'aSchedule') void loadSchedule();
}
```

**Changes:**
- Add `async` to `switchTab`
- Use `await` with `loadMyBookings()`
- For admin tab, use `void` to ignore the returned promise (or make switchAdminTab async)

---

## 🧪 Testing Checklist

### Test 1: Data Persistence
- [ ] Submit a booking as student
- [ ] Refresh page
- [ ] Booking still appears (NOT lost like localStorage)
- [ ] Check Supabase dashboard → `bookings` table for the entry

### Test 2: Admin Functions
- [ ] Login as admin
- [ ] See pending bookings from database
- [ ] Approve a booking
- [ ] Check status changed in Supabase
- [ ] Modify a booking (change estate/time)
- [ ] Verify changes in database

### Test 3: Conflict Detection
- [ ] Submit overlapping booking
- [ ] Should be rejected with conflict message
- [ ] Try to approve conflicting booking as admin
- [ ] Should show warning

### Test 4: Multiple Users
- [ ] Open app in two browser windows
- [ ] Student A submits booking in window 1
- [ ] Student B sees it (or admin sees pending)
- [ ] Real-time updates work (optional: only if you implemented subscriptions)

### Test 5: Error Handling
- [ ] Temporarily disconnect from internet
- [ ] Try to submit booking
- [ ] Should show error message (not crash)
- [ ] Reconnect and try again
- [ ] Should work

---

## 🚨 Common Errors & Fixes

### Error: "Cannot read property 'map' of undefined"

**Cause:** Function not awaited, trying to use promise as array

**Fix:**
```javascript
// ❌ Wrong
let list = getBookings().filter(...);

// ✅ Correct
const bookings = await getBookings();
let list = bookings.filter(...);
```

---

### Error: "SUPABASE_URL is not defined"

**Cause:** `supabase-client.js` not loaded or credentials missing

**Fix:**
1. Check `<script src="supabase-client.js"></script>` is in HTML
2. Check you filled in real URL and key in `supabase-client.js`
3. Test in browser console: `console.log(window.supabaseDB)`

---

### Error: "No 'Access-Control-Allow-Origin' header"

**Cause:** Usually incorrect Supabase URL (missing https://)

**Fix:**
```javascript
// ❌ Wrong
const SUPABASE_URL = 'your-project.supabase.co';

// ✅ Correct
const SUPABASE_URL = 'https://your-project.supabase.co';
```

---

### Error: "RLS policy rejected this operation"

**Cause:** Row-level security blocking access

**Fix (temporary):**
```sql
-- In Supabase SQL Editor, disable RLS for testing
alter table bookings disable row level security;
```

Then re-enable after testing:
```sql
alter table bookings enable row level security;
```

---

## 📋 Function Conversion Summary

| Function | Needs `async`? | Needs `await`? | Lines to change |
|----------|---|---|---|
| `getBookings()` | N/A (already async in client) | N/A | 0 |
| `addBooking()` | N/A (already async in client) | N/A | 0 |
| `updateBooking()` | N/A (already async in client) | N/A | 0 |
| `hasConflict()` | ✅ YES | ✅ YES | ~2 |
| `loadMyBookings()` | ✅ YES | ✅ YES | ~2 |
| `submitBooking()` | ✅ YES | ✅ YES | ~3 |
| `loadStats()` | ✅ YES | ✅ YES | ~1 |
| `loadPending()` | ✅ YES | ✅ YES | ~1 |
| `loadAll()` | ✅ YES | ✅ YES | ~1 |
| `loadSchedule()` | ✅ YES | ✅ YES | ~1 |
| `switchTab()` | ✅ YES | ✅ YES | ~1 |
| `switchAdminTab()` | ✅ YES | ✅ YES | ~3 |
| `processAction()` | ✅ YES | ✅ YES | ~5 |

---

## ✅ Post-Migration Validation

Run this in browser console to verify setup:

```javascript
// Check 1: Supabase client loaded
console.log('✓ Supabase available:', typeof window.supabaseDB !== 'undefined');

// Check 2: Can fetch bookings
window.supabaseDB.from('bookings').select('count').then(r => {
  console.log('✓ Database connection works, bookings count:', r.data);
});

// Check 3: Cache working
getBookings().then(b => {
  console.log('✓ Can fetch bookings:', b.length, 'records');
});
```

---

## 🎉 You're Done!

Commit your changes:
```bash
git add .
git commit -m "feat: integrate Supabase for persistent storage"
git push origin main
```

Your MICA Estate Bookings app now has:
✅ Persistent database storage  
✅ Real data (not just browser cache)  
✅ Admin controls  
✅ Conflict detection  
✅ Scalable backend  

**Next steps:** Add email notifications, real-time updates, or user authentication! 🚀
