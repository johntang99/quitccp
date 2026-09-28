import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const ITERATIONS = 210_000;
const KEY_LENGTH = 64;
const DIGEST = "sha512";

export interface PasswordHash {
  hash: string;
  salt: string;
}

export function hashPassword(password: string, salt = randomBytes(16).toString("base64url")): PasswordHash {
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("base64url");
  return { hash, salt };
}

export function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const calculated = pbkdf2Sync(password, storedSalt, ITERATIONS, KEY_LENGTH, DIGEST).toString("base64url");
  const expected = Buffer.from(storedHash);
  const candidate = Buffer.from(calculated);
  if (expected.length !== candidate.length) return false;
  return timingSafeEqual(expected, candidate);
}
