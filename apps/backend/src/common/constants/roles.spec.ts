/**
 * The tests for the rule that stops authority being escalated.
 *
 * The system has five kinds of member, and each one can see less than the
 * one above it. Somebody has to be able to hand out authority, and the
 * person who does it must not be able to hand out more than they have.
 *
 * Without that rule the "assign a role" screen is a way to make yourself
 * anything: a Principal becomes an Admin becomes a Super Admin, one screen
 * at a time. The rule is therefore the one that makes the role hierarchy
 * mean anything.
 *
 * The tests are about the rule, not about the screens that use it.
 */

import { canGrantRole, INVITABLE_ROLES, isUserRole, USER_ROLES } from './roles';

describe('the roles', () => {
  it('knows every role the system has', () => {
    expect(USER_ROLES).toContain('SUPER_ADMIN');
    expect(USER_ROLES).toContain('ADMIN');
    expect(USER_ROLES).toContain('HOD');
    expect(USER_ROLES).toContain('PRINCIPAL');
    expect(USER_ROLES).toContain('TEACHER');
    expect(USER_ROLES).toContain('STUDENT');
  });

  it('does not let the Super Admin role be handed out through an invitation', () => {
    expect(INVITABLE_ROLES).not.toContain('SUPER_ADMIN');
  });

  it('recognises a known role and rejects anything else', () => {
    expect(isUserRole('TEACHER')).toBe(true);
    expect(isUserRole('SUPER_ADMIN')).toBe(true);
    expect(isUserRole('DEAN')).toBe(false);
    expect(isUserRole('')).toBe(false);
  });
});

describe('who may grant what', () => {
  describe('the Super Admin role', () => {
    it('cannot be granted by anybody', () => {
      expect(canGrantRole(['SUPER_ADMIN'], 'SUPER_ADMIN')).toBe(false);
      expect(canGrantRole(['ADMIN'], 'SUPER_ADMIN')).toBe(false);
      expect(canGrantRole(['HOD'], 'SUPER_ADMIN')).toBe(false);
      expect(canGrantRole(['STUDENT'], 'SUPER_ADMIN')).toBe(false);
    });
  });

  describe('a college-wide Admin', () => {
    it('may appoint an HOD', () => {
      expect(canGrantRole(['ADMIN'], 'HOD')).toBe(true);
    });

    it('may appoint a Principal', () => {
      expect(canGrantRole(['ADMIN'], 'PRINCIPAL')).toBe(true);
    });

    it('may appoint a Teacher and a Student', () => {
      expect(canGrantRole(['ADMIN'], 'TEACHER')).toBe(true);
      expect(canGrantRole(['ADMIN'], 'STUDENT')).toBe(true);
    });

    it('may not appoint another Admin', () => {
      expect(canGrantRole(['ADMIN'], 'ADMIN')).toBe(false);
    });
  });

  describe('an HOD', () => {
    it('may appoint a Principal', () => {
      expect(canGrantRole(['HOD'], 'PRINCIPAL')).toBe(true);
    });

    it('may appoint a Teacher', () => {
      expect(canGrantRole(['HOD'], 'TEACHER')).toBe(true);
    });

    it('may not appoint an HOD or an Admin', () => {
      expect(canGrantRole(['HOD'], 'HOD')).toBe(false);
      expect(canGrantRole(['HOD'], 'ADMIN')).toBe(false);
    });
  });

  describe('a Principal', () => {
    it('may appoint a Teacher', () => {
      expect(canGrantRole(['PRINCIPAL'], 'TEACHER')).toBe(true);
    });

    it('may not appoint a Principal, an HOD or an Admin', () => {
      expect(canGrantRole(['PRINCIPAL'], 'PRINCIPAL')).toBe(false);
      expect(canGrantRole(['PRINCIPAL'], 'HOD')).toBe(false);
      expect(canGrantRole(['PRINCIPAL'], 'ADMIN')).toBe(false);
    });
  });

  describe('a Teacher', () => {
    it('may not appoint anybody above a Student', () => {
      expect(canGrantRole(['TEACHER'], 'TEACHER')).toBe(false);
      expect(canGrantRole(['TEACHER'], 'PRINCIPAL')).toBe(false);
      expect(canGrantRole(['TEACHER'], 'STUDENT')).toBe(false);
    });
  });

  describe('a member who holds several roles', () => {
    it('is judged by the strongest role they hold', () => {
      /**
       * A Principal who also teaches may appoint a Teacher, and is stopped
       * at an HOD. Judging by the weakest role would let them appoint a
       * Student, which is not what their office means.
       */
      expect(canGrantRole(['PRINCIPAL', 'TEACHER'], 'TEACHER')).toBe(true);
    });

    it('still may not appoint a peer', () => {
      /**
       * Holding a weaker role alongside a stronger one does not make a
       * member more powerful. A Principal who also teaches carries exactly
       * the authority of a Principal who does not, and is judged the same
       * way — so they may not appoint another Principal.
       *
       * An earlier version of this rule allowed it on the grounds that the
       * member "already holds the office". That reasoning cannot be
       * reconciled with a lone Principal being refused the same grant, and
       * a rule that depends on which *other* roles happen to be attached is
       * not a rule about authority. See `docs/DECISIONS.md`.
       */
      expect(canGrantRole(['PRINCIPAL', 'TEACHER'], 'PRINCIPAL')).toBe(false);
    });

    it('still may not appoint an HOD', () => {
      expect(canGrantRole(['PRINCIPAL', 'TEACHER'], 'HOD')).toBe(false);
    });
  });

  describe('a member with no roles', () => {
    it('may not appoint anybody', () => {
      expect(canGrantRole([], 'STUDENT')).toBe(false);
      expect(canGrantRole([], 'ADMIN')).toBe(false);
    });
  });

  describe('a role name the system does not know', () => {
    it('is not granted, and does not corrupt the comparison', () => {
      expect(canGrantRole(['ADMIN'], 'DEAN')).toBe(false);
      expect(canGrantRole(['ADMIN', 'NOT_A_ROLE'], 'HOD')).toBe(true);
    });
  });
});
