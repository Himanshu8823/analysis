/**
 * Creates local test accounts for manual browser testing.
 *
 * These accounts exist only in a development database. They are given the
 * same roles the seed gives a real member of that kind, so the browser
 * walkthrough exercises the real permission set — including the ways the
 * exam cell and a teacher are allowed, and are not allowed, to write marks.
 *
 * Run with:
 *   pnpm exec ts-node -r tsconfig-paths/register scripts/seed-test-users.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PASSWORD = 'Test@123';

const ACCOUNTS = [
  { email: 'examcell@dbatu.edu', name: 'Exam Cell Operator', role: 'ADMIN' },
  { email: 'hod@dbatu.edu', name: 'Head of Department', role: 'HOD' },
  { email: 'teacher@dbatu.edu', name: 'Subject Teacher', role: 'TEACHER' },
  { email: 'principal@dbatu.edu', name: 'The Principal', role: 'PRINCIPAL' },
];

/**
 * The roles that are scoped to a branch. A role outside this list carries
 * no branch — the exam cell and the Super Admin see the whole college.
 */
const BRANCH_SCOPED_ROLES = ['HOD', 'PRINCIPAL', 'TEACHER'];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  for (const account of ACCOUNTS) {
    const role = await prisma.role.findUnique({ where: { name: account.role } });
    if (!role) {
      throw new Error(`Role ${account.role} is missing — run the seed first.`);
    }

    // The branch-scoped roles need a branch to be scoped to. The first
    // branch in the database is the one the seed created.
    const branch = await prisma.branch.findFirst({ orderBy: { createdAt: 'asc' } });

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: account.email },
        create: {
          email: account.email,
          name: account.name,
          passwordHash,
          isActive: true,
        },
        update: { name: account.name, passwordHash, isActive: true },
      });

      const existing = await tx.userRole.findFirst({
        where: { userId: user.id, roleId: role.id },
      });
      if (!existing) {
        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
            branchId: BRANCH_SCOPED_ROLES.includes(account.role) ? (branch?.id ?? null) : null,
          },
        });
      }
    });

    console.log(`→ ${account.email} / ${PASSWORD}  (${account.role})`);
  }

  console.log('\nTest accounts ready.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
