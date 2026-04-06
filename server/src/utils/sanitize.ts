/**
 * Strip leading/trailing whitespace and remove null bytes.
 */
export function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\0/g, '').trim();
}

/**
 * Normalize and validate an email address.
 */
export function sanitizeEmail(value: unknown): string {
  return sanitizeString(value).toLowerCase().slice(0, 254);
}

/**
 * Validate a URL — returns the URL string if valid, throws if not.
 */
export function sanitizeUrl(value: unknown): string {
  const str = sanitizeString(value);
  if (!str) throw new Error('URL is required');
  // Only allow http/https
  const parsed = new URL(str); // throws if invalid
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL must use http or https');
  }
  return str;
}

/**
 * Validate and return a positive integer ID.
 */
export function sanitizeId(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error('Invalid ID');
  return n;
}

/**
 * Clamp a string to a max length.
 */
export function limitLength(value: string, max: number): string {
  return value.slice(0, max);
}
