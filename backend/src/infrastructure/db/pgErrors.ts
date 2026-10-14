export type UniqueViolation = 'NAME_TAKEN' | 'CHARGE_CODE_COLLISION' | 'DUPLICATE_CREATE_REQUEST';

const UNIQUE_VIOLATION = '23505';

const BY_CONSTRAINT: Record<string, UniqueViolation> = {
  project_name_active_uq: 'NAME_TAKEN',
  project_charge_code_uq: 'CHARGE_CODE_COLLISION',
  project_create_request_id_uq: 'DUPLICATE_CREATE_REQUEST',
};

export function mapUniqueViolation(error: unknown): UniqueViolation | null {
  if (typeof error !== 'object' || error === null) return null;
  const { code, constraint } = error as { code?: unknown; constraint?: unknown };
  if (code !== UNIQUE_VIOLATION || typeof constraint !== 'string') return null;
  return BY_CONSTRAINT[constraint] ?? null;
}
