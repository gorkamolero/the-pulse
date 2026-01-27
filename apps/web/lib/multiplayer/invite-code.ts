// Invite code generation and validation
// Uses URL-safe characters that are easy to type and read

// Characters excluding confusing ones (0/O, 1/I/l)
const INVITE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generate a random invite code
 * Format: 8 characters, uppercase alphanumeric (easy to read/type)
 */
export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)];
  }
  return code;
}

/**
 * Validate invite code format
 * - Must be exactly 8 characters
 * - Must only contain valid characters
 */
export function isValidInviteCode(code: string): boolean {
  if (code.length !== 8) return false;
  const upperCode = code.toUpperCase();
  for (const char of upperCode) {
    if (!INVITE_CHARS.includes(char)) return false;
  }
  return true;
}

/**
 * Normalize invite code (uppercase, trim whitespace)
 */
export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Format invite code for display (add hyphen in middle for readability)
 * e.g., "ABCD-EFGH"
 */
export function formatInviteCode(code: string): string {
  const normalized = normalizeInviteCode(code);
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}
