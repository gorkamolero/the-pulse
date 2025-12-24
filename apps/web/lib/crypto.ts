import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET environment variable is not set');
  }
  return scryptSync(secret, 'pulse-api-keys', KEY_LENGTH);
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * Returns format: iv:authTag:encrypted (all base64)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypts a ciphertext string encrypted with encrypt()
 */
export function decrypt(ciphertext: string): string {
  const [ivB64, authTagB64, encryptedB64] = ciphertext.split(':');

  if (!ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error('Invalid ciphertext format');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}

/**
 * Masks an API key for display (e.g., "sk-...abc123")
 */
export function maskApiKey(key: string): string {
  if (key.length <= 10) {
    return '***';
  }
  const prefix = key.slice(0, 3);
  const suffix = key.slice(-6);
  return `${prefix}...${suffix}`;
}
