# MICA Estate Bookings - Two-Tier Approval System

## 📦 Files to Upload to GitHub

### HTML Files (Portals)
- `index.html` - Landing page with 3 portal options
- `student.html` - Student booking portal (existing, no changes needed)
- `mcsa.html` - MCSA review & compilation portal (**NEW**)
- `administration.html` - Administration final approval portal (**NEW**, renamed from `admin.html`)

### JavaScript Files
- `roles.js` - Password protection & session management (**NEW**)
- `mcsa-functions.js` - MCSA portal logic (**NEW**)
- `admin-functions.js` - Administration portal logic (**NEW**)
- `supabase-client.js` - Database client (update with your credentials)
- `app.js` - Student portal logic (existing, can update)

### Database
- `DATABASE_SCHEMA.sql` - Copy-paste into Supabase SQL Editor

### Styling
- `style-additions.css` - New styles for login, modals, cards
  - Either merge into your existing `style.css` or include as separate file

---

## 🚀 Setup Instructions

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project named `mica-estate-bookings`
3. Note your **Project URL** and **Anon Key**

### Step 2: Create Database Schema
1. In Supabase → SQL Editor
2. Create new query
3. Copy & paste entire contents of `DATABASE_SCHEMA.sql`
4. Click "Run"
5. Verify 3 tables created: `users`, `bookings`, `daily_compilations`

### Step 3: Update Credentials
1. Open `supabase-client.js`
2. Replace:
   ```javascript
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key-here';
   ```
3. With your actual values from Supabase

### Step 4: Optional - Update Passwords
Edit passwords in `roles.js`:
```javascript
const ROLE_PASSWORDS = {
  'mcsa': 'mcsa@2024',           // Change this
  'administration': 'admin@2024'  // Change this
};
```

### Step 5: Update CSS (One of two options)

**Option A: Merge into existing CSS**
- Copy all content from `style-additions.css`
- Paste into your existing `style.css`

**Option B: Keep separate**
- Add to your HTML files:
  ```html
  <link rel="stylesheet" href="style-additions.css">
  ```

### Step 6: Upload to GitHub
```bash
git add .
git commit -m "feat: implement two-tier approval system with MCSA & Administration portals"
git push origin main
```

---

## 🔐 Passwords

| Portal | Password | Change in |
|--------|----------|-----------|
| MCSA | `mcsa@2024` | `roles.js` line 11 |
| Administration | `admin@2024` | `roles.js` line 12 |
| Student | None (no password) | - |

---

## 📊 System Workflow

```
STUDENT submits booking
        ↓
    [PENDING]
        ↓
MCSA logs in (password required)
   - Reviews booking
   - Approves or rejects
   - Adds notes
        ↓
MCSA compiles daily list
   - All approved bookings for the day
   - Sends to Administration
        ↓
ADMINISTRATION logs in (password required)
   - Views compilation
   - Makes final decision
   - Can approve, reject, or send back with comments
        ↓
[FINALIZED] ✅ or ❌
```

---

## 📁 File Breakdown

### `index.html`
- Landing page
- 3 portal cards
- Shows which portals have password protection

### `mcsa.html`
- Password login screen
- Three tabs:
  1. Pending Bookings (to review)
  2. My Compilations (history of compiled lists)
  3. Statistics
- Modal for approve/reject decisions
- Compile daily list button

### `administration.html`
- Password login screen
- Three tabs:
  1. Pending Compilations (inbox)
  2. Review by Date (manual date selection)
  3. History & Archives
- Modal for final decisions
- Can approve, reject, or add comments

### `roles.js`
- Password configuration
- Session management (check if logged in)
- Login/logout functions
- Password validation
- UI initialization on page load

### `mcsa-functions.js`
- Load pending bookings
- Modal open/close
- Approve booking
- Reject booking
- Compile daily bookings
- Load compilation history
- Statistics

### `admin-functions.js`
- Load compilation inbox
- Load bookings for compilation
- Load bookings by date
- Load history/archives
- Modal functions (approve, reject, comment)
- Mark compilation as reviewed

### `DATABASE_SCHEMA.sql`
- Creates 3 tables: users, bookings, daily_compilations
- Sets up indexes for performance
- Configures Row-Level Security policies
- Ensures data isolation between roles

---

## 🧪 Testing Checklist

After deploying, test each role:

### Test 1: Student Portal
- [ ] Go to `index.html` → Student Portal
- [ ] Submit a booking
- [ ] Booking shows as "pending"
- [ ] Check Supabase: booking in `bookings` table with status = "pending"

### Test 2: MCSA Portal
- [ ] Go to `index.html` → MCSA Portal
- [ ] Try wrong password → shows error
- [ ] Enter correct password (default: `mcsa@2024`)
- [ ] See pending bookings from student
- [ ] Click "Review Booking"
- [ ] Approve → booking status changes to "mcsa_approved"
- [ ] Go to "My Compilations" tab
- [ ] Click "Compile Today's Bookings"
- [ ] Check Supabase: new record in `daily_compilations` table

### Test 3: Administration Portal
- [ ] Go to `index.html` → Administration Portal
- [ ] Try wrong password → shows error
- [ ] Enter correct password (default: `admin@2024`)
- [ ] See compilation in "Pending Compilations"
- [ ] Click "Review Compilation"
- [ ] See all approved bookings from MCSA
- [ ] Click "Final Decision" on a booking
- [ ] Approve → booking status changes to "admin_approved"
- [ ] Go to "Review by Date" tab
- [ ] See finalized bookings

### Test 4: Data Flow
- [ ] Student submits booking (pending)
- [ ] MCSA reviews and approves (mcsa_approved)
- [ ] MCSA compiles list (daily_compilations created)
- [ ] Admin reviews and approves (admin_approved)
- [ ] Check Supabase: booking has all approval timestamps

---

## 🔧 Troubleshooting

### "Failed to load bookings"
- Check browser console (F12 → Console tab)
- Verify `supabase-client.js` has correct URL and key
- Check that database tables exist in Supabase

### "Incorrect password" message
- Verify password in `roles.js` matches what you typed
- Check that passwords haven't been changed
- Note: passwords are case-sensitive

### "RLS policy rejected"
- This means your Supabase RLS policies aren't set up correctly
- Re-run `DATABASE_SCHEMA.sql` in Supabase SQL Editor
- Verify all policies were created

### Session not persisting
- Ensure browser's sessionStorage is enabled
- Try clearing browser cookies and cache
- Check that you're using HTTPS in production

---

## 📱 Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- IE11: ❌ Not supported (uses modern JavaScript)

---

## 🔒 Security Notes

1. **Passwords stored in code**: For development only
   - In production, use Supabase Auth or environment variables
   - Never commit real passwords to Git

2. **Row-Level Security (RLS)**: Enabled by default
   - Students can only see their own bookings
   - MCSA can only see pending bookings
   - Admin can see all bookings

3. **Session tokens**: Stored in `sessionStorage`
   - Cleared when browser tab closes
   - Not accessible across domains

---

## 📞 Support

For issues:
1. Check browser console (F12)
2. Verify all files are uploaded
3. Confirm Supabase credentials are correct
4. Check that database schema was created
5. Try clearing browser cache and reload

---

## 📝 License

MICA Estate Bookings - Internal Use Only

---

## 🎉 Deployment

Once tested locally:

1. Push to GitHub
2. Enable GitHub Pages (Settings → Pages → Deploy from main)
3. Access at: `https://yourusername.github.io/MICA-Estate-Bookings/`

---

**Ready to deploy? Let's go! 🚀**
