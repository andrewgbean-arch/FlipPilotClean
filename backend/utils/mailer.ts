import axios from "axios";

/**
 * Sends the sign-in code by email.
 *
 * Production: through Resend (https://resend.com), which needs RESEND_API_KEY and
 * EMAIL_FROM (an address on a domain you have verified with them).
 * Development: with neither set, the code is printed to the server's own log so
 * the app can be tried on your own machine. That is never done in production:
 * without the settings, production refuses to send (sign-in is unavailable)
 * rather than writing anyone's code to a log.
 */
export async function sendLoginCode(email: string, code: string): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (key && from) {
    await axios.post(
      "https://api.resend.com/emails",
      {
        from,
        to: [email],
        subject: `${code} is your FlipPilot sign-in code`,
        text:
          `Your FlipPilot sign-in code is ${code}\n\n` +
          `It works for 10 minutes. If you didn't ask for it, you can ignore this email: nobody can sign in without the code.`,
        html:
          `<p>Your FlipPilot sign-in code is</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>` +
          `<p>It works for 10 minutes. If you didn't ask for it, you can ignore this email: nobody can sign in without the code.</p>`,
      },
      { timeout: 10_000, headers: { Authorization: `Bearer ${key}` } }
    );
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[dev] sign-in code for ${email}: ${code}`);
    return;
  }

  throw new Error("email-not-configured");
}
