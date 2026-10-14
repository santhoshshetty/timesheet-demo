/** Shared accept/reject examples so the domain and the API validator are tested against the same values. */
export const ACCEPTED_EMAILS = [
  'priya.shah@example.com',
  'a@b',
  'first.last+tag@sub.example.co.uk',
  'Priya@Example.COM',
];

export const REJECTED_EMAILS = [
  'no-at-sign',
  'a@',
  '@example.com',
  'a b@example.com',
  `${'a'.repeat(243)}@example.com`,
];
