import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * What a revocation will do, before it does it.
 *
 * A college administrator who is about to revoke a member needs to know the
 * consequences *before* they confirm — not after, when a class has silently
 * lost its teacher and a teacher's marks are unowned.
 *
 * This service answers that question. It is the read side of the revocation
 * lifecycle; {@link MemberRevocationService} performs the revocation.
 */
export interface RevocationImpact {
  /** The member's name, for the confirmation text. */
  memberName: string;
  /** The member's email, for the confirmation text. */
  memberEmail: string;
  /** Whether the member is currently active. */
  isActive: boolean;
  /** How many subject allocations will be released. */
  subjectAllocations: number;
  /** The subjects whose allocations will be released, named for the user. */
  allocatedSubjects: Array<{
    subjectName: string;
    subjectCode: string;
    branchName: string;
    semester: number;
  }>;
  /** How many classes will lose their class teacher. */
  classTeacherAssignments: number;
  /**
   * The classes that will lose their class teacher, named for the user.
   *
   * These classes will be flagged "class teacher required" until somebody is
   * appointed — the college has to know which ones need attention.
   */
  classesLosingTeacher: Array<{
    branchName: string;
    semester: number;
    schemeName: string;
    academicYear: string;
  }>;
  /** How many refresh tokens will be invalidated. */
  activeSessions: number;
  /** How many pending invitations will be withdrawn. */
  pendingInvitations: number;
  /** The roles the member holds, which will all be released. */
  roles: string[];
}

/**
 * The preview of a revocation.
 *
 * Written for a college administrator, not a developer: the sentences name
 * branches, subjects and semesters rather than ids.
 */
@Injectable()
export class MemberImpactService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Works out exactly what revoking this member would affect.
   *
   * Read-only. Nothing is changed until the revocation is confirmed.
   */
  async previewRevocation(userId: string): Promise<RevocationImpact> {
    const member = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        userRoles: {
          select: {
            role: { select: { name: true } },
          },
        },
        teacherSubjects: {
          select: {
            subjectOffering: {
              select: {
                semester: true,
                branch: { select: { name: true } },
                subject: { select: { name: true, code: true } },
              },
            },
          },
        },
        classTeacherAssignments: {
          select: {
            semester: true,
            branch: { select: { name: true } },
            scheme: { select: { name: true } },
            academicYear: { select: { year: true } },
          },
        },
        refreshTokens: {
          where: { revokedAt: null },
          select: { id: true },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('That member no longer exists.');
    }

    const pendingInvitations = await this.prisma.invite.count({
      where: { email: member.email.toLowerCase(), status: 'PENDING' },
    });

    return {
      memberName: member.name,
      memberEmail: member.email,
      isActive: member.isActive,
      subjectAllocations: member.teacherSubjects.length,
      allocatedSubjects: member.teacherSubjects.map((allocation) => ({
        subjectName: allocation.subjectOffering.subject.name,
        subjectCode: allocation.subjectOffering.subject.code,
        branchName: allocation.subjectOffering.branch.name,
        semester: allocation.subjectOffering.semester,
      })),
      classTeacherAssignments: member.classTeacherAssignments.length,
      classesLosingTeacher: member.classTeacherAssignments.map((assignment) => ({
        branchName: assignment.branch.name,
        semester: assignment.semester,
        schemeName: assignment.scheme.name,
        academicYear: assignment.academicYear.year,
      })),
      activeSessions: member.refreshTokens.length,
      pendingInvitations,
      roles: member.userRoles.map((role) => role.role.name),
    };
  }

  /**
   * The consequence of a revocation, written as sentences.
   *
   * The confirmation dialog shows these. An administrator should be able to
   * read them once and know exactly what they are about to do.
   */
  async describeRevocation(userId: string): Promise<string[]> {
    const impact = await this.previewRevocation(userId);
    const sentences: string[] = [];

    sentences.push(
      `${impact.memberName} will be signed out immediately and will not be able to sign in again.`
    );

    if (impact.subjectAllocations > 0) {
      const names = impact.allocatedSubjects
        .map(
          (subject) =>
            `${subject.subjectName} (${subject.branchName}, Semester ${subject.semester})`
        )
        .join(', ');
      sentences.push(
        `${impact.subjectAllocations} subject allocation${impact.subjectAllocations === 1 ? '' : 's'} will be released: ${names}. ` +
          'The marks they entered are kept and still show their name as the author.'
      );
    }

    if (impact.classTeacherAssignments > 0) {
      const classes = impact.classesLosingTeacher
        .map((entry) => `${entry.branchName}, Semester ${entry.semester} (${entry.academicYear})`)
        .join('; ');
      sentences.push(
        `${impact.classTeacherAssignments} class${impact.classTeacherAssignments === 1 ? '' : 'es'} will have no class teacher: ${classes}. ` +
          'These classes will be marked "class teacher required" until you appoint someone.'
      );
    }

    if (impact.roles.length > 0) {
      sentences.push(`Their roles will be removed: ${impact.roles.join(', ')}.`);
    }

    if (impact.pendingInvitations > 0) {
      sentences.push(
        `${impact.pendingInvitations} pending invitation${impact.pendingInvitations === 1 ? '' : 's'} will be withdrawn.`
      );
    }

    sentences.push('Their history is kept, so anything they did before is still traceable.');

    return sentences;
  }
}
