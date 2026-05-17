// ─────────────────────────────────────────────────────────────────
// Auth Service — PBKDF2 password hashing + session utilities
// ─────────────────────────────────────────────────────────────────

const ALGORITHM  = 'PBKDF2';
const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

// ── Encoding helpers ──────────────────────────────────────────────

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

// ── Public API ────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `$${ALGORITHM}$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    if (!password || !stored) return false;

    // Legacy plain-text passwords (migration path)
    if (!stored.startsWith('$')) return password === stored;

    const parts = stored.split('$');
    if (parts.length < 5 || parts[1] !== ALGORITHM) return false;

    const iterations = parseInt(parts[2], 10);
    const salt       = fromBase64(parts[3]);
    const expected   = parts[4];
    const derived    = await pbkdf2(password, salt, iterations);

    return toBase64(derived) === expected;
  } catch {
    return false;
  }
}

export function generateSessionId(): string {
  const ts  = Date.now().toString(36);
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map(b => b.toString(36))
    .join('')
    .slice(0, 12);
  return `sid_${ts}_${rnd}`;
}

export function calculateSessionExpiration(hours = 24): number {
  return Date.now() + hours * 60 * 60 * 1000;
}

export function isSessionExpired(expiresAt?: number): boolean {
  return expiresAt ? Date.now() > expiresAt : false;
}

// ── Validation helpers (used by forms) ───────────────────────────

export function validateEmail(email: string): { valid: boolean; error: string } {
  const trimmed = email.trim();
  if (!trimmed) return { valid: false, error: 'Email is required.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
    return { valid: false, error: 'Enter a valid email address.' };
  return { valid: true, error: '' };
}

export function validatePasswordField(password: string, minLength = 6): { valid: boolean; error: string } {
  if (!password) return { valid: false, error: 'Password is required.' };
  if (password.length < minLength)
    return { valid: false, error: `Password must be at least ${minLength} characters.` };
  return { valid: true, error: '' };
}

/** Quick strength score 0–100 for the signup form indicator only. */
export function passwordStrengthScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 6)  score += 20;
  if (password.length >= 10) score += 20;
  if (/[A-Z]/.test(password)) score += 20;
  if (/[0-9]/.test(password)) score += 20;
  if (/[^A-Za-z0-9]/.test(password)) score += 20;
  return score;
}
