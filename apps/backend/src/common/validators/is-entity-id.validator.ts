import { IsString, IsNotEmpty } from 'class-validator';

/**
 * A validator for a foreign key that points at another row.
 *
 * The Prisma models declare their primary keys as `String @default(uuid())`,
 * but the column type does not force the value to be a UUID — the seed script
 * sets an explicit id on some rows (a batch, for example, is seeded as
 * `batch-<uuid>` so its row is recognisable). A `@IsUUID('4')` check on the
 * DTO therefore rejects ids the database itself accepts.
 *
 * Whether the id points at a row that exists is enforced by the foreign-key
 * constraint, not by a regex on the request body — and a constraint gives a
 * better error than a validation message that guesses at the id format.
 *
 * This validator keeps the DTO honest about the one thing it can check: that
 * a non-empty string was supplied.
 */
export function IsEntityId(validationOptions?: {
  each?: boolean;
  message?: string;
}): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    IsString(validationOptions)(target, propertyKey);
    IsNotEmpty({
      message: validationOptions?.message ?? `${String(propertyKey)} must be a non-empty id`,
    })(target, propertyKey);
  };
}
