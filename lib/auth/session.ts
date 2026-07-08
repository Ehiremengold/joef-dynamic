import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { TakerSession } from "@/lib/types";

const COOKIE = "jdc_taker";
const ALG = "HS256";

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET must be set (>= 16 chars)");
  }
  return new TextEncoder().encode(s);
}

/** Issue a taker (student/candidate) session cookie. */
export async function setTakerSession(
  session: TakerSession,
  maxAgeSecs = 60 * 60 * 4 // 4 hours — long enough for a test sitting
): Promise<void> {
  const token = await new SignJWT({ s: session })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSecs}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSecs,
  });
}

export async function getTakerSession(): Promise<TakerSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    return (payload as { s?: TakerSession }).s ?? null;
  } catch {
    return null;
  }
}

export async function clearTakerSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
