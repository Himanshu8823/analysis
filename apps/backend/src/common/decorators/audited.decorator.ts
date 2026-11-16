import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key under which the audit descriptor is stored on a route handler.
 */
export const AUDITED_KEY = 'audited';

/**
 * The canonical mutation verbs used as the `action` column of an audit row.
 *
 * They are deliberately coarse — "what kind of change was this" — while the
 * `resource` column carries the entity ("student", "mark", …). Together the
 * two give a screen a stable, filterable taxonomy without having to know
 * every concrete operation name.
 */
export const AuditAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  BULK_IMPORT: 'BULK_IMPORT',
  CONFIRM: 'CONFIRM',
  /**
   * The exam cell's correction of a mark a teacher holds.
   *
   * A correction is not an ordinary entry: it overwrites work another
   * person is responsible for, so it is recorded under its own action and
   * always carries the reason it was given.
   */
  CORRECTION: 'CORRECTION',
  /**
   * A role was granted to a member. Privilege changes are the most
   * consequential thing this system records, so they have their own action
   * rather than being filed under a generic update.
   */
  GRANT: 'GRANT',
  /**
   * A role was taken back from a member.
   */
  REVOKE: 'REVOKE',
  /**
   * A member's access was revoked — their account deactivated, their
   * allocations released, their tokens invalidated.
   */
  DEACTIVATE: 'DEACTIVATE',
  /**
   * A member's record was archived.
   */
  ARCHIVE: 'ARCHIVE',
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];

/**
 * The canonical `resource` column values. A screen can offer these as a
 * filter dropdown; anything else is still accepted so a new module can add a
 * resource without a schema change.
 */
export const AuditResource = {
  STUDENT: 'student',
  SUBJECT: 'subject',
  SUBJECT_OFFERING: 'subject_offering',
  MARK: 'mark',
  BRANCH: 'branch',
  SCHEME: 'scheme',
  TEACHER_ALLOCATION: 'teacher_allocation',
  CLASS_TEACHER_ASSIGNMENT: 'class_teacher_assignment',
  UPLOAD_JOB: 'upload_job',
  /** A member's own account — the profile screen's changes. */
  USER: 'user',
  /**
   * A generated report.
   *
   * A report is a statement about a class's results. Generating one and
   * deleting one are both consequential, so both are recorded — a report
   * that exists but leaves no trace cannot be accounted for.
   */
  REPORT: 'report',
  /**
   * An academic year.
   *
   * Changing the running year changes what every screen defaults to, so it
   * is recorded like any other academic change.
   */
  ACADEMIC_YEAR: 'academic_year',
  /**
   * An examination — the result lifecycle of one class context.
   */
  EXAMINATION: 'examination',
} as const;

export type AuditResourceValue = (typeof AuditResource)[keyof typeof AuditResource];

export interface AuditedOptions {
  /**
   * Where the audited entity's id comes from in the request.
   *
   * - `body`   — read from the request body (`body.id`, or a custom field).
   * - `param`  — read from the route parameter (`id` by default).
   * - `response` — read from the resolved response value (the created row).
   * - `none`   — no resource id is recorded (bulk operations, for example).
   */
  resourceIdSource?: 'body' | 'param' | 'response' | 'none';
  /**
   * Name of the field the resource id is read from. Defaults to `id`.
   * Only meaningful for the `body`, `param` and `response` sources.
   */
  resourceIdField?: string;
  /**
   * Extra detail merged into the audit row's `details` JSON. Use it for
   * fields a screen will want to show but that are not worth a column —
   * for example the roll number of a student, or the number of rows a bulk
   * import wrote.
   */
  details?: Record<string, unknown>;
  /**
   * Fields to copy out of the request body into the audit row's `details`
   * JSON, keyed by the name they should take in the audit row.
   *
   * ```ts
   * { detailsFromBody: { rollNo: 'rollNo', semester: 'semester' } }
   * ```
   *
   * A missing field is simply omitted — it never fails the request. An array
   * field is recorded as its **length**, never as the array itself, so a
   * bulk import of thousands of rows cannot land in the JSON column.
   */
  detailsFromBody?: Record<string, string>;
  /**
   * The name of the request body field that carries the **reason** for the
   * change.
   *
   * A destructive or state-changing operation that someone else will have to
   * explain later must record why. The reason is copied into the audit row's
   * `details` under the key `reason`, so the audit screen can show it
   * beside the change.
   *
   * Defaults to `reason` when the route does not name one — the field is
   * called `reason` everywhere in this system.
   */
  reasonField?: string;
  /**
   * When true the route is not audited even if a class-level `@Audited`
   * decorator covers it.
   */
  skip?: boolean;
}

/**
 * Marks a route handler as an auditable mutation.
 *
 * The {@link AuditInterceptor} reads this metadata after the handler resolves
 * successfully and writes one row to `audit_logs` describing the change.
 *
 * ```ts
 * @Post()
 * @Permissions('students:write')
 * @Audited('student', AuditAction.CREATE, { resourceIdSource: 'response' })
 * async create(@Body() dto: CreateStudentDto) { … }
 * ```
 *
 * A failed audit write never fails the request — the mutation has already
 * succeeded by then, and refusing to answer would be worse than a missing
 * audit row.
 */
export interface AuditDescriptor {
  resource: string;
  action: string;
  options: AuditedOptions;
  /**
   * When true, the route is explicitly not auditable — it cancels any
   * `@Audited` decorator applied to the enclosing controller.
   */
  skip?: boolean;
}

/**
 * Decorates a route handler (or an entire controller) as an auditable
 * mutation.
 *
 * @param resource The `resource` column value, e.g. `'student'`.
 * @param action   The `action` column value, e.g. `'CREATE'`.
 * @param options  Optional refinements — where the resource id comes from,
 *                 and what extra detail to record.
 */
export const Audited = (
  resource: string,
  action: string,
  options: AuditedOptions = {}
): MethodDecorator & ClassDecorator =>
  SetMetadata(AUDITED_KEY, {
    resource,
    action,
    options,
  } satisfies AuditDescriptor);

/**
 * Marks a route handler as explicitly *not* auditable, cancelling any
 * `@Audited` decorator applied to the enclosing controller.
 */
export const NotAudited = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AUDITED_KEY, {
    skip: true,
  } satisfies Partial<AuditDescriptor>);
