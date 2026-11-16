/**
 * The names of the roles, written for a person.
 *
 * The database stores `HOD` and `PRINCIPAL` — the abbreviations the college
 * uses internally. They are fine in a table column and wrong in a sentence,
 * in a badge in the header, and in a dialog asking "are you sure?".
 *
 * This is the one place that turns a stored role name into something a
 * college administrator reads, so every screen says the same thing.
 */
export function roleDisplayName(roleName: string): string {
  switch (roleName) {
    case 'HOD':
      return 'Head of Department';
    case 'PRINCIPAL':
      return 'Principal';
    case 'TEACHER':
      return 'Teacher';
    case 'ADMIN':
      return 'Administrator';
    case 'STUDENT':
      return 'Student';
    case 'SUPER_ADMIN':
      return 'Super Admin';
    default:
      return roleName;
  }
}

/**
 * A short name for a role, for the places where the full name will not fit —
 * a table column on a phone, a badge in a narrow card.
 *
 * The abbreviation is the one the college already uses, so it is familiar
 * rather than cryptic.
 */
export function roleShortName(roleName: string): string {
  switch (roleName) {
    case 'HOD':
      return 'HOD';
    case 'PRINCIPAL':
      return 'Principal';
    case 'TEACHER':
      return 'Teacher';
    case 'ADMIN':
      return 'Admin';
    case 'STUDENT':
      return 'Student';
    case 'SUPER_ADMIN':
      return 'Super Admin';
    default:
      return roleName;
  }
}
