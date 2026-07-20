# MICA Estate Bookings: Role System Implementation Roadmap

## 🔄 Old System vs New System

### OLD SYSTEM (Current)
```
┌──────────────┐
│   STUDENT    │ Submits booking
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Admin Reviews & Approves/Rejects    │ ← Single approval point
│  (Can modify estate/time if needed)  │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────┐
│   BOOKED     │
└──────────────┘

Issues:
❌ No separation of duties
❌ No daily compilation/summary
❌ Admin manually tracks all bookings
```

### NEW SYSTEM (Two-Tier)
```
┌──────────────┐
│   STUDENT    │ Submits booking
└──────┬───────┘
       │ (Status: pending)
       ▼
┌──────────────────────────────────┐
│     MCSA REVIEW                  │ ← Tier 1: Initial screening
│  • Approve/Reject individual     │   & estate management
│  • Add internal notes            │
└──────┬───────────────────────────┘
       │ (Status: mcsa_approved/rejected)
       │
       ├─→ [REJECTED] ❌ → Stops here
       │
       └─→ [APPROVED] ✅
              │
              ▼
         ┌──────────────────────────────┐
         │  MCSA COMPILES DAILY LIST    │
         │  • Groups by date            │
         │  • Shows all approvals       │
         │  • Sends to Admin            │
         └──────┬───────────────────────┘
                │ (Compilation: pending_admin)
                ▼
         ┌──────────────────────────────────────┐
         │  ADMIN REVIEWS COMPILED LIST         │ ← Tier 2: Final approval
         │  • Sees all estate details           │   & high-level oversight
         │  • Sees MCSA notes                   │
         │  • Can approve/reject/comment        │
         └──────┬───────────────────────────────┘
                │
                ├─→ APPROVE ✅ (Status: admin_approved)
                ├─→ REJECT ❌ (Status: admin_rejected)
                └─→ COMMENT 💬 (Status: admin_comments_pending)
                          │
                          └─→ Goes back to MCSA for revision

Benefits:
✅ Clear separation of duties
✅ MCSA handles logistics (conflict checking, timing)
✅ Admin handles policy/final decisions
✅ Daily compilations for easy review
✅ Audit trail of all decisions
✅ Communication channels built in
```

---

## 👥 Role Responsibilities

### 👨‍🎓 STUDENT
**What they can do:**
- Submit estate booking requests
- View their own booking status
- See comments/feedback from MCSA/Admin
- Cancel own bookings (if pending)

**What they see:**
- Personal dashboard with their bookings
- Current status (pending → approved → finalized)
- History of past bookings
- Comments/notes from review teams

**Not allowed:**
- See other students' bookings
- Approve/reject bookings
- View compilations
- Modify already-submitted bookings

---

### 📋 MCSA (Management/Council)
**What they can do:**
- View all pending bookings waiting for review
- Approve individual bookings (check for conflicts)
- Reject bookings with reason
- Add internal notes for each booking
- **Compile daily list** of all approved bookings
- View status of their compilations (pending/approved by admin)

**What they see:**
- "Pending Bookings" tab with all unreviewed requests
- Booking details: student info, estate, time, purpose, num people
- "My Compilations" tab with history of compiled lists
- Status of each compilation (pending admin, reviewed, approved)

**Responsibilities:**
- Quick turnaround on reviewing pending bookings
- Check for conflicts with existing approved bookings
- Ensure booking details are valid
- Compile once per day (or as needed)
- Add notes to help admin understand context

**Not allowed:**
- See approved/rejected bookings (after status is set)
- Make final approvals (that's admin's job)
- Modify student info
- Delete bookings

---

### 👨‍💼 ADMIN (Registrar)
**What they can do:**
- View MCSA's compiled daily lists
- See full details of approved bookings for the day
- See MCSA notes for each booking
- **Final approval** of bookings
- **Reject** bookings with reason
- **Add comments** for communication back to MCSA
- View historical decisions

**What they see:**
- "Daily Compilations" inbox with lists awaiting review
- Clicking a compilation shows:
  - Date of compilation
  - MCSA team member who compiled it
  - Full breakdown: # approved, # rejected
  - All bookings in detail format
  - MCSA notes for context
- Can filter by date, status, estate

**Responsibilities:**
- Review compilations at end of day (or next morning)
- Make final decisions on approvals
- Ensure bookings align with institutional policies
- Provide feedback/comments when needed
- Maintain audit trail

**Not allowed:**
- Modify student info
- See pending bookings (only MCSA-approved ones)
- View individual students' history
- Cancel approved bookings

---

## 📊 Status Workflow States

```javascript
pending
  ↓ (MCSA reviews)
  ├─→ mcsa_approved ──→ [in compilation] ──→ admin_approved ✅ (FINAL)
  │                                      └→ admin_rejected ❌ (FINAL)
  │                                      └→ admin_comments_pending 💬
  │                                           ↓ (back to MCSA)
  │                                           └─→ [re-reviewed by MCSA]
  │
  └─→ mcsa_rejected ❌ (FINAL - stops here)
```

---

## 🗄️ Database Design at a Glance

### `users` table
```
id (UUID)
email (unique)
name
role (student | mcsa | admin)
created_at
```

### `bookings` table (enhanced)
```
id (text primary key)
student_name, student_roll, student_email
requested_estate, allocated_estate
booking_date, end_date, start_time, end_time
purpose, num_people, description

status (pending | mcsa_approved | mcsa_rejected | 
        admin_approved | admin_rejected | admin_comments_pending)

mcsa_note (internal note from MCSA)
mcsa_approved_by (MCSA email)
mcsa_approved_at (timestamp)

admin_note (internal note from Admin)
admin_comment (communication to MCSA)
admin_approved_by (Admin email)
admin_approved_at (timestamp)

created_at, updated_at
```

### `daily_compilations` table (NEW)
```
id (UUID)
compilation_date (the date being compiled)
compiled_by (MCSA email)
compiled_at (timestamp)

total_bookings (count)
approved_count (count)
rejected_count (count)

status (pending_admin | admin_reviewed | admin_approved)
admin_reviewed_by (Admin email)
admin_reviewed_at (timestamp)
notes (optional)

created_at, updated_at
```

---

## 🚀 Implementation Timeline

### Phase 1: Database Setup (30 mins)
- [ ] Create `users` table
- [ ] Update `bookings` table with MCSA fields
- [ ] Create `daily_compilations` table
- [ ] Run all indexes
- [ ] Set up RLS policies
- [ ] Add test users (student, mcsa, admin)

### Phase 2: Authentication & Roles (45 mins)
- [ ] Create `roles.js` with role helper functions
- [ ] Implement Supabase Auth integration
- [ ] Add role-based UI visibility (hide/show based on role)
- [ ] Test login for each role type

### Phase 3: MCSA Portal (60 mins)
- [ ] Create `mcsa.html` with two tabs:
  - Pending bookings (to review)
  - My compilations (history)
- [ ] Implement `loadMcsaPendingBookings()`
- [ ] Implement `mcsaApproveBooking()` / `mcsaRejectBooking()`
- [ ] Implement `compileDailyBookings()`
- [ ] Add modal for MCSA decisions

### Phase 4: Updated Admin Portal (60 mins)
- [ ] Update `admin.html` with new tabs:
  - Daily compilations inbox
  - Review specific date
- [ ] Implement `loadAdminCompiledLists()`
- [ ] Implement `loadAdminBookingsForDate()`
- [ ] Implement `adminApproveFinal()` / `adminRejectFinal()`
- [ ] Implement `adminAddComments()`
- [ ] Add modal for admin decisions

### Phase 5: Student Portal Updates (15 mins)
- [ ] Update `student.html` to show new status values
- [ ] Display MCSA notes when available
- [ ] Display Admin comments when available
- [ ] Show color-coded status badges

### Phase 6: Testing & Refinement (60 mins)
- [ ] Test full workflow end-to-end
- [ ] Verify RLS policies work correctly
- [ ] Test error handling
- [ ] Check audit trail
- [ ] Performance testing

---

## 💻 Code File Structure

```
/repo/
├── index.html                    (Portal selection/landing)
├── student.html                  (Student booking portal - UPDATED)
├── mcsa.html                     (NEW - MCSA compilation portal)
├── admin.html                    (Admin review portal - UPDATED)
├── style.css                     (Shared styles)
│
├── supabase-client.js            (Supabase setup)
├── roles.js                      (NEW - Role helpers & auth)
├── mcsa-functions.js             (NEW - MCSA-specific functions)
├── admin-functions.js            (UPDATED - Admin workflow)
├── app.js                        (UPDATED - Core functions)
│
└── docs/
    ├── TWO_TIER_APPROVAL_SYSTEM.md
    ├── ROLES_IMPLEMENTATION_ROADMAP.md
    ├── SUPABASE_INTEGRATION_GUIDE.md
    └── MIGRATION_CHECKLIST.md
```

---

## 🧪 Test Scenarios

### Scenario 1: Happy Path
1. Student submits booking
2. MCSA approves it (status: mcsa_approved)
3. MCSA compiles day
4. Admin approves it (status: admin_approved)
5. ✅ Booking is finalized

### Scenario 2: Rejection at MCSA Level
1. Student submits booking
2. MCSA rejects it with reason (status: mcsa_rejected)
3. ✅ Booking stops here, student notified

### Scenario 3: Admin Rejects After MCSA Approval
1. Student submits booking
2. MCSA approves it
3. MCSA compiles day
4. Admin rejects it (status: admin_rejected)
5. ✅ Booking rejected, MCSA notified

### Scenario 4: Admin Comments For Revision
1. Student submits booking
2. MCSA approves it
3. MCSA compiles day
4. Admin adds comment (status: admin_comments_pending)
5. Comment sent back to MCSA
6. MCSA reviews comment and re-approves/rejects
7. ✅ Workflow continues

---

## 🔒 Security Model

**Who can see what:**

| Data | Student | MCSA | Admin |
|------|---------|------|-------|
| Own bookings | ✅ | ❌ | ❌ |
| All pending bookings | ❌ | ✅ | ❌ |
| MCSA-approved bookings | ❌ | ✅ | ✅ |
| Compilations | ❌ | Own only | All |
| Edit own booking | ✅* | ❌ | ❌ |
| Approve bookings | ❌ | ✅ (MCSA level) | ✅ (Final) |
| Make final decision | ❌ | ❌ | ✅ |

*Students can edit only if status is "pending"

---

## 📞 Communication Flow

```
STUDENT
   ↑
   │ (1) Submits booking
   │
   ↓
MCSA [Reviews]
   ├─ (2a) Approves + adds note
   │    OR
   └─ (2b) Rejects + adds reason
          ↓ [If rejected, stops]
   
   ┌─ (3) Compiles daily list
   │
   ↓
ADMIN [Reviews Compilation]
   ├─ (4a) Approves → Booking finalized ✅
   │    OR
   ├─ (4b) Rejects → Booking rejected ❌
   │    OR
   └─ (4c) Adds comment → Sends back to MCSA
          ↓
        MCSA [Re-reviews with comment]
           ├─ Re-approves
           └─ Re-rejects
```

**Communication Methods:**
- MCSA notes: Internal, visible only to admin
- Admin comments: Sent to MCSA for revision
- Student notifications: Status changes + final decision

---

## 📈 Benefits of Two-Tier System

✅ **Separation of Duties**
- MCSA handles operational/tactical (individual bookings)
- Admin handles strategic/policy (final approvals)

✅ **Efficiency**
- MCSA reviews quickly (no need to see big picture)
- Admin reviews in batches (daily compilation)

✅ **Better Communication**
- MCSA notes provide context to admin
- Admin comments help MCSA improve decisions

✅ **Audit Trail**
- Full history of who approved/rejected when
- Timestamps for every decision
- Comments saved for reference

✅ **Scalability**
- System works whether 10 or 1000 bookings
- MCSA can be multiple people
- Admin can delegate if needed

✅ **Flexibility**
- Easy to modify rules without changing DB
- Can add more approval tiers if needed
- Supports comments/revisions

---

## ❓ FAQ

**Q: Can MCSA modify a booking's estate/time?**
A: No, MCSA just approves/rejects. If there's a conflict, MCSA rejects and notes why. If Admin wants to change it, they can reach out to MCSA.

**Q: What happens if Admin wants to change something after approving?**
A: Once admin_approved, it's final. For changes, the booking would need to go through rejection and resubmission.

**Q: Can a student see MCSA/Admin notes?**
A: Yes, for transparency. But internal notes visible only between MCSA and Admin.

**Q: What if there are conflicting approvals?**
A: The database checks conflict only against "mcsa_approved" and "admin_approved" statuses. Rejected bookings don't block slots.

**Q: Can MCSA see admin decisions?**
A: Yes, to learn and improve. They see the final status and admin comments.

---

## 🎯 Next Actions

1. **Immediately:** Backup current database
2. **Then:** Create new tables (Phase 1)
3. **Then:** Implement auth & roles (Phase 2)
4. **Then:** Build portals (Phases 3-5)
5. **Finally:** Test thoroughly (Phase 6)

**Estimated total time: 4-5 hours**

Need help with any specific phase?
