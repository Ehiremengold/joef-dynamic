import "server-only";
import { serviceClient } from "@/lib/supabase/server";

// How hard student sign-in is to guess (see 0017_login_throttle.sql).
//  - One admission number: 5 tries in 15 minutes without the right PIN
//    locks it for 15 minutes. At most ~480 guesses a day against one student, so finding a
//    6-digit PIN would take years. A correct PIN or a staff PIN reset clears it.
//  - One network address: 200 failed tries in 15 minutes locks it for 15
//    minutes, which stops trying many students from one place. It's high on
//    purpose: a school lab shares one address, and typos on exam day must
//    never lock the whole room out.
const WINDOW_SECONDS = 15 * 60;
const LOCK_SECONDS = 15 * 60;
const PER_STUDENT = 5;
const PER_ADDRESS = 200;

export const studentKey = (admissionNumber: string) => `adm:${admissionNumber.trim().toUpperCase()}`;
export const addressKey = (ip: string) => `ip:${ip}`;

export type Lock = { scope: "student" | "address"; until: Date };

/**
 * The throttle is a second line of defence, so it fails open: if it can't be
 * read (say the deploy went out before migrations 0017 and 0019 were run), sign-in
 * carries on unthrottled and the problem is logged, rather than locking a
 * whole school out of an exam.
 */
function unavailable(what: string, error: { message: string }): null {
  console.error(`login throttle unavailable (${what}): ${error.message}`);
  return null;
}

const keysFor = (admissionNumber: string, ip: string | null) => [studentKey(admissionNumber), ...(ip ? [addressKey(ip)] : [])];

/**
 * Count this attempt before the PIN is checked (see 0019), and say whether
 * it may go ahead: a lock refuses it. Counting first is what stops a burst
 * of guesses sent at the same moment from all getting through.
 */
export async function claimAttempt(admissionNumber: string, ip: string | null): Promise<Lock | null> {
  const { data, error } = await serviceClient().rpc("claim_login_attempt", {
    p_keys: keysFor(admissionNumber, ip),
    p_limits: [PER_STUDENT, ...(ip ? [PER_ADDRESS] : [])],
    p_window_seconds: WINDOW_SECONDS,
    p_lock_seconds: LOCK_SECONDS,
  });
  if (error) return unavailable("claim", error);
  if (!data) return null;
  const lock = data as { key: string; locked_until: string };
  return { scope: lock.key.startsWith("ip:") ? "address" : "student", until: new Date(lock.locked_until) };
}

/** A correct PIN: the student's count is cleared and the address gets this attempt back. */
export async function releaseAttempt(admissionNumber: string, ip: string | null): Promise<void> {
  const { error } = await serviceClient().rpc("release_login_attempt", {
    p_student_key: studentKey(admissionNumber),
    p_address_key: ip ? addressKey(ip) : "",
  });
  if (error) unavailable("release", error);
}

/** A correct PIN, or staff resetting it: the student starts with a clean slate. */
export async function clearStudent(admissionNumber: string): Promise<void> {
  const { error } = await serviceClient().from("login_throttle").delete().eq("key", studentKey(admissionNumber));
  if (error) unavailable("clear", error);
}
