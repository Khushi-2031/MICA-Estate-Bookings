/**
 * Supabase Client Configuration
 * Replace SUPABASE_URL and SUPABASE_ANON_KEY with your actual credentials
 *
 * Get these from:
 * 1. Go to supabase.com and create a project
 * 2. Settings → API
 * 3. Copy Project URL and Anon Key
 */

// ─── Configuration ───────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';

// Initialize Supabase client
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Make it globally accessible
window.supabaseDB = db;

// ─── Caching Strategy ─────────────────────────────────────────────────────────

let bookingsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds - adjust based on your needs

// ─── Core CRUD Operations ────────────────────────────────────────────────────

/**
 * Fetch all bookings from Supabase
 * Uses caching to reduce API calls
 */
async function getBookings() {
  const now = Date.now();

  // Return cache if still valid
  if (bookingsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return bookingsCache;
  }

  try {
    const { data, error } = await db
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bookings:', error.message);
      flash('dashAlert', 'Failed to load bookings: ' + error.message, 'error');
      return [];
    }

    // Transform database snake_case to app's camelCase
    bookingsCache = (data || []).map(b => ({
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
    console.error('Unexpected error fetching bookings:', err);
    flash('dashAlert', 'Unexpected error: ' + err.message, 'error');
    return [];
  }
}

/**
 * Add a new booking to Supabase
 */
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
        description: booking.description || '',
        status: booking.status || 'pending',
        admin_note: booking.adminNote || ''
      }])
      .select();

    if (error) {
      console.error('Error adding booking:', error.message);
      flash('formAlert', 'Failed to submit booking: ' + error.message, 'error');
      return null;
    }

    // Clear cache to force refresh
    bookingsCache = null;

    // Return transformed data
    const b = data[0];
    return {
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
    };
  } catch (err) {
    console.error('Unexpected error adding booking:', err);
    flash('formAlert', 'Unexpected error: ' + err.message, 'error');
    return null;
  }
}

/**
 * Update an existing booking
 */
async function updateBooking(id, changes) {
  try {
    // Convert camelCase to snake_case for database
    const dbChanges = {};

    if ('status' in changes) dbChanges.status = changes.status;
    if ('adminNote' in changes) dbChanges.admin_note = changes.adminNote;
    if ('allocatedEstate' in changes) dbChanges.allocated_estate = changes.allocatedEstate;
    if ('startTime' in changes) dbChanges.start_time = changes.startTime;
    if ('endTime' in changes) dbChanges.end_time = changes.endTime;
    if ('endDate' in changes) dbChanges.end_date = changes.endDate;

    dbChanges.updated_at = new Date().toISOString();

    const { data, error } = await db
      .from('bookings')
      .update(dbChanges)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating booking:', error.message);
      flash('dashAlert', 'Failed to update booking: ' + error.message, 'error');
      return null;
    }

    // Clear cache
    bookingsCache = null;

    // Return transformed data
    const b = data[0];
    return {
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
    };
  } catch (err) {
    console.error('Unexpected error updating booking:', err);
    flash('dashAlert', 'Unexpected error: ' + err.message, 'error');
    return null;
  }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Clear the bookings cache
 * Use this when you want to force a refresh from database
 */
function clearBookingsCache() {
  bookingsCache = null;
  cacheTimestamp = 0;
}

/**
 * Check if cache is stale
 */
function isCacheStale() {
  return !bookingsCache || (Date.now() - cacheTimestamp) > CACHE_DURATION;
}

/**
 * Refresh cache manually
 */
async function refreshCache() {
  clearBookingsCache();
  return await getBookings();
}

// ─── Real-time Updates (Optional) ────────────────────────────────────────────

/**
 * Subscribe to real-time changes in bookings
 * This allows the UI to update immediately when admin makes changes
 *
 * Usage:
 * subscribeToBookings(() => {
 *   loadMyBookings(); // Refresh UI when changes occur
 * });
 */
function subscribeToBookings(callback) {
  const subscription = db
    .from('bookings')
    .on('*', payload => {
      console.log('Real-time update received:', payload);
      clearBookingsCache();
      if (callback) callback();
    })
    .subscribe();

  return subscription;
}

// ─── Authentication Helpers (Optional) ────────────────────────────────────────

/**
 * Sign up a new user with Supabase Auth (optional passwordless login)
 */
async function signUpStudent(email, password = null) {
  try {
    const { data, error } = await db.auth.signUp({
      email: email,
      password: password || email // Use email as temp password if none provided
    });

    if (error) {
      console.error('Sign up error:', error.message);
      return null;
    }

    console.log('User signed up:', data.user.email);
    return data.user;
  } catch (err) {
    console.error('Unexpected error during sign up:', err);
    return null;
  }
}

/**
 * Login with email and password
 */
async function loginStudent(email, password) {
  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      console.error('Login error:', error.message);
      return null;
    }

    console.log('User logged in:', data.user.email);
    return data.user;
  } catch (err) {
    console.error('Unexpected error during login:', err);
    return null;
  }
}

/**
 * Send a magic link for passwordless login
 */
async function sendMagicLink(email) {
  try {
    const { error } = await db.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) {
      console.error('Magic link error:', error.message);
      return false;
    }

    console.log('Magic link sent to', email);
    return true;
  } catch (err) {
    console.error('Unexpected error sending magic link:', err);
    return false;
  }
}

/**
 * Logout current user
 */
async function logoutStudent() {
  try {
    const { error } = await db.auth.signOut();
    if (error) {
      console.error('Logout error:', error.message);
      return false;
    }
    console.log('User logged out');
    return true;
  } catch (err) {
    console.error('Unexpected error during logout:', err);
    return false;
  }
}

/**
 * Get current authenticated user
 */
async function getCurrentUser() {
  try {
    const { data } = await db.auth.getUser();
    return data.user;
  } catch (err) {
    console.error('Error getting current user:', err);
    return null;
  }
}

/**
 * Check if user session exists
 */
async function checkSession() {
  try {
    const { data } = await db.auth.getSession();
    return data.session;
  } catch (err) {
    console.error('Error checking session:', err);
    return null;
  }
}

// ─── Initialization ──────────────────────────────────────────────────────────

console.log('✅ Supabase client initialized');
console.log('Project URL:', SUPABASE_URL);
console.log('Supabase DB available as: window.supabaseDB');
