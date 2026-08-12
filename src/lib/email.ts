import { Resend } from "resend";
import { env } from "./env.js";

let _resend: Resend | null = null;

function getResendClient(): Resend {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  if (!_resend) {
    _resend = new Resend(env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendOtpEmail(
  email: string,
  otp: string
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    // In development without a key, log the OTP for testing
    console.log(`[DEV] OTP for ${email}: ${otp}`);
    return;
  }

  const client = getResendClient();

  await client.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Your Centra Path verification code",
    html: buildOtpEmailHtml(otp),
    text: buildOtpEmailText(otp),
  });
}

function buildOtpEmailHtml(otp: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Verification Code</title></head>
<body style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #111;">
  <h2 style="margin-bottom: 8px;">Your Centra Path code</h2>
  <p style="color: #444; margin-bottom: 24px;">
    Use the code below to verify your email address. It expires in 10 minutes.
  </p>
  <div style="
    font-size: 36px;
    font-weight: 700;
    letter-spacing: 8px;
    text-align: center;
    padding: 20px;
    background: #f5f5f5;
    border-radius: 8px;
    margin-bottom: 24px;
  ">${otp}</div>
  <p style="color: #888; font-size: 13px;">
    If you did not request this code, you can safely ignore this email.
  </p>
</body>
</html>`;
}

function buildOtpEmailText(otp: string): string {
  return `Your Centra Path verification code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request it, please ignore this email.`;
}
