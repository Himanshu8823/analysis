/**
 * DBATU Result Analysis System - seed script.
 *
 * Usage: `pnpm --filter @result-analysis/backend prisma:seed`
 *
 * Idempotent: every upsert call uses the natural key. Running it multiple
 * times won't duplicate rows.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ROLES = [
  { name: 'SUPER_ADMIN', description: 'Full system access' },
  { name: 'ADMIN', description: 'Exam cell operations' },
  { name: 'HOD', description: 'Department head' },
  { name: 'TEACHER', description: 'Subject teacher' },
  { name: 'PRINCIPAL', description: 'Read-only analytics' },
  { name: 'STUDENT', description: 'Own result only' },
] as const;

const PERMISSIONS = [
  { name: 'students:read', resource: 'students', action: 'read' },
  { name: 'students:write', resource: 'students', action: 'write' },
  { name: 'marks:read', resource: 'marks', action: 'read' },
  { name: 'marks:write', resource: 'marks', action: 'write' },
  { name: 'marks:edit_own_subject', resource: 'marks', action: 'edit_own_subject' },
  { name: 'reports:read', resource: 'reports', action: 'read' },
  { name: 'reports:generate', resource: 'reports', action: 'generate' },
  { name: 'reports:download', resource: 'reports', action: 'download' },
  { name: 'upload:create', resource: 'upload', action: 'create' },
  { name: 'upload:read', resource: 'upload', action: 'read' },
  { name: 'upload:process', resource: 'upload', action: 'process' },
  { name: 'analytics:read', resource: 'analytics', action: 'read' },
  { name: 'analytics:read_own_department', resource: 'analytics', action: 'read_own_department' },
  { name: 'users:read', resource: 'users', action: 'read' },
  { name: 'users:write', resource: 'users', action: 'write' },
  { name: 'rbac:read', resource: 'rbac', action: 'read' },
  { name: 'rbac:write', resource: 'rbac', action: 'write' },
  { name: 'invites:read', resource: 'invites', action: 'read' },
  { name: 'invites:write', resource: 'invites', action: 'write' },
  { name: 'dashboard:read', resource: 'dashboard', action: 'read' },
  { name: 'branches:read', resource: 'branches', action: 'read' },
  { name: 'branches:write', resource: 'branches', action: 'write' },
  { name: 'branches:delete', resource: 'branches', action: 'delete' },
  { name: 'schemes:read', resource: 'schemes', action: 'read' },
  { name: 'schemes:write', resource: 'schemes', action: 'write' },
  { name: 'subjects:read', resource: 'subjects', action: 'read' },
  { name: 'subjects:write', resource: 'subjects', action: 'write' },
  { name: 'subjects:delete', resource: 'subjects', action: 'delete' },
  { name: 'toppers:read', resource: 'toppers', action: 'read' },
] as const;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.name),
  ADMIN: [
    'students:read',
    'students:write',
    'marks:read',
    'marks:write',
    'reports:read',
    'reports:generate',
    'reports:download',
    'upload:create',
    'upload:read',
    'upload:process',
    'analytics:read',
    'users:read',
    'dashboard:read',
    'branches:read',
    'branches:write',
    'branches:delete',
    'schemes:read',
    'schemes:write',
    'subjects:read',
    'subjects:write',
    'subjects:delete',
    'toppers:read',
  ],
  HOD: [
    'students:read',
    'marks:read',
    'reports:read',
    'reports:generate',
    'reports:download',
    'upload:create',
    'upload:read',
    'upload:process',
    'analytics:read',
    'analytics:read_own_department',
    'dashboard:read',
    'branches:read',
    'schemes:read',
    'subjects:read',
    'subjects:write',
    'toppers:read',
  ],
  TEACHER: [
    'students:read',
    'marks:read',
    'marks:edit_own_subject',
    'reports:read',
    'upload:read',
    'dashboard:read',
    'branches:read',
    'schemes:read',
    'subjects:read',
    'toppers:read',
  ],
  PRINCIPAL: [
    'students:read',
    'marks:read',
    'reports:read',
    'reports:download',
    'analytics:read',
    'dashboard:read',
    'branches:read',
    'schemes:read',
    'subjects:read',
    'toppers:read',
  ],
  STUDENT: ['dashboard:read'],
};

const BRANCHES = [
  { code: 'CS', name: 'Computer Science & Engineering' },
  { code: 'ME', name: 'Mechanical Engineering' },
  { code: 'CE', name: 'Civil Engineering' },
  { code: 'EE', name: 'Electrical Engineering' },
  { code: 'ENT', name: 'Electronics & Telecommunication' },
] as const;

const SCHEME_RULES_2019 = {
  required: ['CA1', 'CA2', 'MID_SEM', 'WRITTEN'],
  passRules: {
    CA1: 6,
    CA2: 6,
    MID_SEM: 8,
    PRACTICAL: 10,
    internalTotal: 30,
    externalWritten: 45,
    aggregate: 50,
  },
};

const SCHEME_RULES_2022 = {
  hasTheory: true,
  hasPractical: false,
  passRules: {
    internalTotal: 20,
    internalMax: 40,
    externalMin: 30,
    externalMax: 60,
    practicalMin: 13,
    practicalMax: 25,
    aggregate: 50,
  },
};

const SCHEME_RULES_2024 = {
  hasTheory: true,
  hasPractical: false,
  passRules: {
    internalTotal: 20,
    internalMax: 40,
    externalMin: 30,
    externalMax: 60,
    practicalMin: 13,
    practicalMax: 25,
    aggregate: 50,
  },
};

async function main(): Promise<void> {
  console.log('→ Seeding roles & permissions…');
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      create: { name: role.name, description: role.description, isActive: true },
      update: { description: role.description, isActive: true },
    });
  }
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      create: { name: perm.name, resource: perm.resource, action: perm.action },
      update: { resource: perm.resource, action: perm.action },
    });
  }

  console.log('→ Seeding role-permission mapping…');
  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;
    for (const permName of perms) {
      const perm = await prisma.permission.findUnique({ where: { name: permName } });
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        create: { roleId: role.id, permissionId: perm.id },
        update: {},
      });
    }
  }

  console.log('→ Seeding branches…');
  for (const branch of BRANCHES) {
    await prisma.branch.upsert({
      where: { code: branch.code },
      create: { code: branch.code, name: branch.name, isActive: true },
      update: { name: branch.name, isActive: true },
    });
  }

  console.log('→ Seeding schemes…');
  await prisma.scheme.upsert({
    where: { name: 'SCHEME_2019' },
    create: {
      name: 'SCHEME_2019',
      description:
        'DBATU 2019 scheme: CA1 (20) + CA2 (20) + Mid-Sem (20) + Theory (100). Practical 25 where applicable.',
      rules: SCHEME_RULES_2019,
      effectiveFrom: new Date('2019-06-01'),
      isActive: true,
    },
    update: { rules: SCHEME_RULES_2019, isActive: true },
  });
  await prisma.scheme.upsert({
    where: { name: 'SCHEME_2022' },
    create: {
      name: 'SCHEME_2022',
      description:
        'DBATU 2022 scheme: Theory 100 (Internal 40 + External 60) + Practical 25 where applicable.',
      rules: SCHEME_RULES_2022,
      effectiveFrom: new Date('2022-06-01'),
      isActive: true,
    },
    update: { rules: SCHEME_RULES_2022, isActive: true },
  });
  await prisma.scheme.upsert({
    where: { name: 'SCHEME_2024' },
    create: {
      name: 'SCHEME_2024',
      description:
        'DBATU 2024 scheme: Theory 100 (CT1 15 + Mid 15 + Quiz 10 = 40 Internal + 60 External) + Practical 25 where applicable.',
      rules: SCHEME_RULES_2024,
      effectiveFrom: new Date('2024-06-01'),
      isActive: true,
    },
    update: { rules: SCHEME_RULES_2024, isActive: true },
  });

  console.log('→ Seeding academic year + batch…');
  const ay = await prisma.academicYear.upsert({
    where: { year: '2024-25' },
    create: {
      year: '2024-25',
      startDate: new Date('2024-07-01'),
      endDate: new Date('2025-06-30'),
      isActive: true,
    },
    update: { isActive: true },
  });

  await prisma.batch.upsert({
    where: { id: `batch-${ay.id}` },
    create: {
      id: `batch-${ay.id}`,
      name: `${ay.year} cohort`,
      admissionYearId: ay.id,
      isActive: true,
    },
    update: { isActive: true },
  });

  console.log('→ Seeding admin user…');
  const adminEmail = 'admin@dbatu.edu';
  const adminPass = 'Admin@123';
  const passwordHash = await bcrypt.hash(adminPass, 12);
  const adminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  if (!adminRole) {
    throw new Error('SUPER_ADMIN role is missing — the role seed did not run.');
  }

  // The user and the role assignment are written together so a failure
  // cannot leave an account without its SUPER_ADMIN role.
  await prisma.$transaction(async (tx) => {
    const admin = await tx.user.upsert({
      where: { email: adminEmail },
      create: {
        email: adminEmail,
        name: 'System Administrator',
        passwordHash,
        isActive: true,
      },
      update: { name: 'System Administrator', isActive: true },
    });

    // Prisma 5.8 cannot address a NULL column in a compound unique selector
    // (`branchId: Prisma.DbNull` is a type error), so the lookup is done
    // explicitly and the row is created only when it is missing.
    const existingAdminRole = await tx.userRole.findFirst({
      where: { userId: admin.id, roleId: adminRole.id, branchId: null },
    });
    if (!existingAdminRole) {
      await tx.userRole.create({
        data: { userId: admin.id, roleId: adminRole.id },
      });
    }
  });

  console.log(
    `Seed complete. Admin user: ${adminEmail} / ${adminPass} (change after first login).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
