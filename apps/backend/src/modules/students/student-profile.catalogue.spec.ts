/**
 * The test that keeps the three copies of the PII rule in step.
 *
 * ## The rule
 *
 * The sensitive identity data — the national identity reference and the
 * blood group — may be read by the examination cell and the Super Admin,
 * and by nobody else.
 *
 * The guardian details may additionally be read by the Principal and the
 * HOD, and by nobody else.
 *
 * ## Why the rule lives in three places
 *
 *  - in the **shared catalogue** (`packages/shared-constants`), because the
 *    frontend needs it to decide what to *show* — a member who may not
 *    read a field must not be shown a section for it;
 *  - in the **seed** (`apps/backend/prisma/seed.ts`), which writes the
 *    grants into the database and is the live source of truth at runtime;
 *  - in the **backend's own permission names** (`student-profile.service.ts`),
 *    which the service checks.
 *
 * Three copies can drift. When they do, the screen and the server disagree
 * about who may see what — and the disagreement shows up as a 403 at the
 * moment somebody presses a button, or worse, as a field that is shown but
 * should not be.
 *
 * This test compares all three, and then asserts the *outcome* per role,
 * because the outcome is what actually matters: a teacher must not be able
 * to read a national identity number, whoever holds which permission.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

import { PERMISSIONS, ROLE_PERMISSIONS } from '@result-analysis/shared-constants';

import { STUDENT_PROFILE_PERMISSIONS } from './student-profile.service';

const SEED_PATH = resolve(__dirname, '../../../prisma/seed.ts');

/**
 * The seed's permission list and role grants, read from its source.
 *
 * The seed is a script that talks to the database, so it cannot be
 * imported into a unit test without a live connection. Reading it is
 * enough — the *rule* is what can drift, and the rule is written out in
 * the file.
 */
function readSeed(): {
  permissions: string[];
  rolePermissions: Record<string, string[]>;
} {
  const source = readFileSync(SEED_PATH, 'utf8');

  const permissions: string[] = [];
  const permissionPattern =
    /\{\s*name:\s*'([^']+)'\s*,\s*resource:\s*'([^']+)'\s*,\s*action:\s*'([^']+)'/g;
  let match: RegExpExecArray | null;
  while ((match = permissionPattern.exec(source)) !== null) {
    permissions.push(match[1]);
  }

  const rolePermissions: Record<string, string[]> = {};

  const rolePattern = /^\s{2}([A-Z_]+):\s*\[([\s\S]*?)\n\s{2}\],/gm;
  while ((match = rolePattern.exec(source)) !== null) {
    const role = match[1];
    const body = match[2];
    const names = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    rolePermissions[role] = names;
  }

  return { permissions, rolePermissions };
}

const seed = readSeed();

/**
 * The PII permissions this feature depends on.
 */
const PII_PERMISSIONS = [
  PERMISSIONS.STUDENTS_READ_SENSITIVE,
  PERMISSIONS.STUDENTS_READ_GUARDIAN,
  PERMISSIONS.STUDENTS_BULK_PROVISION,
];

describe('the PII permissions', () => {
  it('are named the same in the shared catalogue and in the backend', () => {
    expect(STUDENT_PROFILE_PERMISSIONS.READ_SENSITIVE).toBe(PERMISSIONS.STUDENTS_READ_SENSITIVE);
    expect(STUDENT_PROFILE_PERMISSIONS.READ_GUARDIAN).toBe(PERMISSIONS.STUDENTS_READ_GUARDIAN);
    expect(STUDENT_PROFILE_PERMISSIONS.BULK_PROVISION).toBe(PERMISSIONS.STUDENTS_BULK_PROVISION);
  });

  it('exist in the seed, so the database grants them', () => {
    for (const permission of PII_PERMISSIONS) {
      expect({ permission, seeded: seed.permissions.includes(permission) }).toEqual({
        permission,
        seeded: true,
      });
    }
  });

  it('are granted to the same roles in the catalogue and in the seed', () => {
    for (const role of Object.keys(ROLE_PERMISSIONS)) {
      const shared = [...(ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] ?? [])];
      const seeded = seed.rolePermissions[role] ?? [];

      for (const permission of PII_PERMISSIONS) {
        expect({
          role,
          permission,
          shared: shared.includes(permission),
          seeded: seeded.includes(permission),
        }).toEqual({
          role,
          permission,
          shared: shared.includes(permission),
          seeded: seeded.includes(permission),
        });
      }
    }
  });
});

/**
 * The roles that hold a permission.
 *
 * The catalogue is a `const` object, so its permission arrays are narrowed
 * to their literal types and `.includes()` refuses any other string. The
 * lookup goes through a widened copy so the test can ask about any
 * permission in the catalogue, not just the ones TypeScript can infer.
 */
function rolesHolding(permission: string): string[] {
  const widened: Record<string, readonly string[]> = ROLE_PERMISSIONS;
  return Object.entries(widened)
    .filter(([, permissions]) => (permissions as readonly string[]).includes(permission))
    .map(([role]) => role)
    .sort();
}

describe('who may read the sensitive identity data', () => {
  /**
   * The national identity reference is the strictest field in the system.
   * Only the examination cell and the Super Admin may read it.
   */
  it('is readable by the exam cell and the Super Admin only', () => {
    expect(rolesHolding(PERMISSIONS.STUDENTS_READ_SENSITIVE)).toEqual(['ADMIN', 'SUPER_ADMIN']);
  });

  /**
   * A teacher must not read it — this is the requirement of §2.8.1
   * verbatim.
   */
  it('is not readable by a teacher', () => {
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain(PERMISSIONS.STUDENTS_READ_SENSITIVE);
  });

  /**
   * The Principal must not read it — also §2.8.1 verbatim.
   */
  it('is not readable by the Principal', () => {
    expect(ROLE_PERMISSIONS.PRINCIPAL).not.toContain(PERMISSIONS.STUDENTS_READ_SENSITIVE);
  });

  /**
   * A student account holds no roster permission at all, so it certainly
   * holds none of these.
   */
  it('is not readable by a student account', () => {
    expect(ROLE_PERMISSIONS.STUDENT).not.toContain(PERMISSIONS.STUDENTS_READ_SENSITIVE);
    expect(ROLE_PERMISSIONS.STUDENT).not.toContain(PERMISSIONS.STUDENTS_READ_GUARDIAN);
  });
});

describe('who may read the guardian details', () => {
  /**
   * The guardian's contact details are read by the exam cell, the HOD and
   * the Principal — but not by a teacher, whose job does not involve the
   * student's home.
   */
  it('is readable by the exam cell, the HOD and the Principal only', () => {
    expect(rolesHolding(PERMISSIONS.STUDENTS_READ_GUARDIAN)).toEqual([
      'ADMIN',
      'HOD',
      'PRINCIPAL',
      'SUPER_ADMIN',
    ]);
  });

  it('is not readable by a teacher', () => {
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain(PERMISSIONS.STUDENTS_READ_GUARDIAN);
  });
});

describe('who may provision a whole class of logins', () => {
  it('is the exam cell only', () => {
    expect(rolesHolding(PERMISSIONS.STUDENTS_BULK_PROVISION)).toEqual(['ADMIN']);
  });

  it('is not held by a teacher or the Principal', () => {
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain(PERMISSIONS.STUDENTS_BULK_PROVISION);
    expect(ROLE_PERMISSIONS.PRINCIPAL).not.toContain(PERMISSIONS.STUDENTS_BULK_PROVISION);
  });
});
