import "server-only";
import bcrypt from "bcryptjs";

/** Hash a student PIN (or any short secret) for storage. */
export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

/** Generate a random numeric PIN of the given length (default 6). */
export function generatePin(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 10);
  return out;
}
