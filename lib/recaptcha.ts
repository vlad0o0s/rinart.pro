const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

type RecaptchaVerifyResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  score?: number;
  action?: string;
  "error-codes"?: string[];
};

export async function verifyRecaptchaToken(token?: string | null, remoteIp?: string | null) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.warn("reCAPTCHA secret key is not configured");
    return false;
  }

  if (!token) {
    return false;
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
    });

    if (remoteIp) {
      body.append("remoteip", remoteIp);
    }

    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      console.warn("reCAPTCHA verify request failed", response.status, response.statusText);
      return false;
    }

    const payload = (await response.json()) as RecaptchaVerifyResponse;
    if (!payload.success) {
      console.warn("reCAPTCHA verification failed", payload["error-codes"]);
      return false;
    }

    return true;
  } catch (error) {
    console.error("reCAPTCHA verification error", error);
    return false;
  }
}

