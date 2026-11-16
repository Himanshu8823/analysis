# Test Accounts & Roles

> Development ke liye. Production me ye accounts kabhi na banayein.

**App URL:** http://localhost:3000

---

## Login Credentials

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@dbatu.edu` | `Admin@123` |
| Exam Cell | `examcell@dbatu.edu` | `Test@123` |
| HOD | `hod@dbatu.edu` | `Test@123` |
| Teacher | `teacher@dbatu.edu` | `Test@123` |
| Principal | `principal@dbatu.edu` | `Test@123` |

> Ye accounts banane ka script: `apps/backend/scripts/seed-test-users.ts`
>
> ```
> cd apps/backend
> pnpm exec ts-node -r tsconfig-paths/register scripts/seed-test-users.ts
> ```

---

## Har role kya kar sakta hai

| Kaam | Super Admin | Exam Cell | HOD | Teacher | Principal |
|---|---|---|---|---|---|
| **Students dekhna** | ✅ poora college | ✅ poora college | ✅ apni branch | ✅ apne students | ✅ poora college |
| **Students banana/edit** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Marks dekhna** | ✅ | ✅ | ✅ apni branch | ✅ sirf apne subject | ✅ |
| **Marks daalna** | ❌ | ✅ kisi bhi subject | ❌ | ✅ sirf apne subject | ❌ |
| **Marks upload (file)** | ❌ | ✅ | ❌ | ✅ apne subject | ❌ |
| **Result publish** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Scheme banana** | ✅ | ❌ | ✅ apni branch | ❌ | ❌ |
| **Subject edit / offering** | ❌ | ✅ | ✅ apni branch | ❌ | ❌ |
| **Teacher allocate karna** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Class teacher assign** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Members banana/edit** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Branches / Academic Years** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Analytics / Reports** | ✅ | ✅ | ✅ apni branch | ❌ | ✅ |
| **Toppers** | ✅ | ✅ | ✅ apni branch | ❌ | ✅ |
| **Audit Log** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Apna result (My Result)** | ❌ | ❌ | ❌ | ❌ | ✅ (student role) |

---

## Role summary (ek line me)

- **Super Admin** — Sirf *set up* aur *dekhna*. Academic data ko chhu nahi sakta.
- **Exam Cell** — Poora operational kaam: students banana, marks daalna, results publish karna.
- **HOD** — Apni branch ka *manager*: teachers allocate karna, class teacher set karna, apni branch dekhna.
- **Teacher** — Sirf apne allocated subject ke marks daalna aur dekhna.
- **Principal** — Strictly read-only. Poora college ka result dekhta hai, kuch nahi badalta.
- **Student** — Sirf apna result, apne marks, apni class ke toppers.

---

## Testing tips

**Super Admin ko "no access" milega** students/marks add karne par — ye sahi behaviour hai, bug nahi. Students aur marks **Exam Cell** banata hai.

**Teacher ka "Marks Entry" screen** — subject dropdown mein sirf un subjects ka naam aayega jo HOD ne allocate kiye hain. Doosre subject ka mark daalne ki koshish karne par backend reject kar dega.

**Reports generate karne se pehle** — har student ka har subject me kam se kam ek mark hona chahiye, warna "not ready" dikhega.

**Logout** — sidebar me apne naam par click → Logout.

**Password badalna** — sidebar me apne naam par click → Change Password.
