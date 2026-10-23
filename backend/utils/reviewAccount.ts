import crypto from "crypto";
import { normaliseEmail, type CodeResult } from "./accountStore";

/**
 * A fixed sign-in for the people who review the app for Google Play.
 *
 * Sign-in is an emailed one-time code, and a reviewer cannot read an inbox we control, so without this they
 * could never get past the sign-in screen. Two settings turn it on:
 *
 *   REVIEW_ACCOUNT_EMAIL   the address the reviewers type (nothing is ever sent to it)
 *   REVIEW_ACCOUNT_CODE    the six digits they type as the code (six, because that is all the sign-in screen takes)
 *
 * For that one address the server sends no email and accepts that code instead. After sign-in everything is
 * ordinary: it is a normal account with the normal limits and no extra powers. Delete the settings and the
 * sign-in stops at once (the settings are read on every request, not at start-up).
 *
 * A fixed code can be guessed at, so wrong tries are counted for the account as a whole: five wrong within half an
 * hour shut it for half an hour, the right code included. A code that is easy to guess (111111, 123456, 121212) is
 * refused. Memory only, like the other rate limits: a restart can only give a few extra tries.
 *
 * Use an address nobody can receive mail at (example.com is kept for exactly that). If the settings are ever
 * removed, the account stays behind, and on a real address whoever reads that mailbox could then sign in to it
 * with the normal emailed code.
 */

type Env = Record<string, string | undefined>;

const WRONG_TRIES = 5;
const WINDOW_MS = 30 * 60_000;

export type ReviewAccount = { email: string; code: string };

/** Six digits that follow an obvious pattern: 111111, 123456, 654321, 890123, 121212, 123123, 112233. */
export function isEasyToGuess(code: string): boolean {
  const d = code.split("").map(Number);
  if (d.every((n) => n === d[0])) return true;
  // In a row, up (step 1) or down (step 9, which is minus one), counting on past 9 to 0.
  const step = (d[1] - d[0] + 10) % 10;
  if ((step === 1 || step === 9) && d.every((n, i) => n === (d[0] + step * i) % 10)) return true;
  if (code.slice(0, 2) === code.slice(2, 4) && code.slice(2, 4) === code.slice(4)) return true;
  if (code.slice(0, 3) === code.slice(3)) return true;
  return d[0] === d[1] && d[2] === d[3] && d[4] === d[5];
}

/** The reviewers' sign-in, or null when it is off or its settings can't be used (reviewAccountProblem says why). */
export function reviewAccount(env: Env = process.env): ReviewAccount | null {
  const email = normaliseEmail(env.REVIEW_ACCOUNT_EMAIL);
  const code = (env.REVIEW_ACCOUNT_CODE ?? "").trim();
  return email && /^\d{6}$/.test(code) && !isEasyToGuess(code) ? { email, code } : null;
}

/**
 * Why somebody who has set one of the two settings still has the sign-in switched off, in words and without
 * ever repeating a value. Null when both are fine, or when neither is set.
 */
export function reviewAccountProblem(env: Env = process.env): string | null {
  const emailSet = Boolean(env.REVIEW_ACCOUNT_EMAIL?.trim());
  const codeSet = Boolean(env.REVIEW_ACCOUNT_CODE?.trim());
  if (!emailSet && !codeSet) return null;
  if (!emailSet || !codeSet) return "Only one of the two is set, so the reviewers' sign-in is off. Set both, or neither.";
  if (!normaliseEmail(env.REVIEW_ACCOUNT_EMAIL)) return "REVIEW_ACCOUNT_EMAIL is not a valid email address, so the reviewers' sign-in is off.";
  const code = env.REVIEW_ACCOUNT_CODE!.trim();
  if (!/^\d{6}$/.test(code)) return "REVIEW_ACCOUNT_CODE must be exactly six digits (the sign-in screen takes no more), so the reviewers' sign-in is off.";
  if (isEasyToGuess(code)) return "REVIEW_ACCOUNT_CODE is too easy to guess (digits in a row, or a repeating pattern), so the reviewers' sign-in is off.";
  return null;
}

/** Whether this (already tidied) email is the reviewers' address, with the sign-in switched on. */
export function isReviewEmail(email: string, env: Env = process.env): boolean {
  return reviewAccount(env)?.email === email;
}

let recentWrong: number[] = [];
let shutUntil = 0;

/** Checks the code a reviewer typed. Wrong five times in half an hour: shut for half an hour, whatever is typed. */
export function checkReviewCode(code: unknown, now = Date.now(), env: Env = process.env): CodeResult {
  const review = reviewAccount(env);
  if (!review) return { ok: false, reason: "expired" };
  if (now < shutUntil) return { ok: false, reason: "locked" };

  const given = typeof code === "string" ? code.trim() : "";
  if (/^\d{6}$/.test(given) && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(review.code))) {
    recentWrong = [];
    return { ok: true };
  }

  recentWrong = [...recentWrong.filter((t) => t > now - WINDOW_MS), now];
  if (recentWrong.length >= WRONG_TRIES) {
    recentWrong = [];
    shutUntil = now + WINDOW_MS;
    return { ok: false, reason: "locked" };
  }
  return { ok: false, reason: "wrong", attemptsLeft: WRONG_TRIES - recentWrong.length };
}

export function clearReviewAttemptsForTests() {
  recentWrong = [];
  shutUntil = 0;
}
