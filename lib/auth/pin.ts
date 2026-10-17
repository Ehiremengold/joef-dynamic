import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcrypt";

// Native bcrypt rather than the pure-JavaScript bcryptjs: it reads the same
// hashes, runs in Node's background thread pool instead of on the main
// thread, and is faster. With bcryptjs each PIN check held the server for
// ~64ms, so a class signing in together queued behind each other and other
// requests (autosaves) stalled. Scripts that run once still use bcryptjs.

/** Hash a student PIN (or any short secret) for storage. */
export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

/** Generate a random numeric PIN of the given length (default 6), from a cryptographic source. */
export function generatePin(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) out += randomInt(10);
  return out;
}
