/**
 * Cloudflare Pages Function — POST /api/contact
 *
 * Receives the pharlux.com contact form, runs form-layer abuse controls
 * (honeypot + Turnstile + optional per-IP rate limit), then relays the message
 * through Vectis Mail's HTTPS send API, which performs the actual SMTP + DKIM
 * signing as noreply@pharlux.com. No SMTP from the Worker, no third-party
 * sender (SPF is `-all`; only mx1 is authorised to send as @pharlux.com).
 *
 * Inbound spam/virus filtering (Rspamd + ClamAV) and a 120 req/min server-side
 * cap on the send token are handled by Vectis Mail; this layer covers form abuse.
 *
 * Secrets (Pages env — never in source):
 *   PHARLUX_SEND_TOKEN    bearer token for the send API
 *   TURNSTILE_SECRET_KEY  Cloudflare Turnstile secret
 * Optional binding:
 *   RATE_LIMIT            KV namespace for per-IP rate limiting (skipped if absent)
 */

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  PHARLUX_SEND_TOKEN: string;
  TURNSTILE_SECRET_KEY: string;
  RATE_LIMIT?: KVNamespace;
}

const SEND_ENDPOINT = "https://mx1.mailsystems.io/api/v1/send";
const TURNSTILE_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const ALLOWED_ORIGIN = "https://pharlux.com";

// intent dropdown -> destination mailbox (all live on pharlux.com)
const ROUTES: Record<string, string> = {
  general: "hello@pharlux.com",
  sales: "sales@pharlux.com",
  support: "support@pharlux.com",
  licensing: "licensing@pharlux.com",
};

const CAP = { name: 200, email: 320, message: 5000, subject: 200 };

// per-IP rate limit (only enforced when the RATE_LIMIT KV binding is present)
const RL_MAX = 5;
const RL_WINDOW_S = 600; // 10 minutes

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function isEmail(s: string): boolean {
  return s.length <= CAP.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export const onRequestOptions = (): Response =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;

  // 1. parse body
  let data: Record<string, unknown>;
  try {
    data = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: "Invalid request." });
  }

  // 2. honeypot — bots fill the hidden "website" field; accept silently, drop
  if (typeof data.website === "string" && data.website.trim() !== "") {
    return json(200, { ok: true });
  }

  // 3. validate + length-cap
  const name = String(data.name ?? "").trim();
  const email = String(data.email ?? "").trim();
  const message = String(data.message ?? "").trim();
  const intent = String(data.intent ?? "general").trim();
  const token = String(data.token ?? data["cf-turnstile-response"] ?? "");

  if (!name || name.length > CAP.name) {
    return json(400, { ok: false, error: "Please enter your name." });
  }
  if (!isEmail(email)) {
    return json(400, { ok: false, error: "Please enter a valid email address." });
  }
  if (!message || message.length > CAP.message) {
    return json(400, { ok: false, error: "Please enter a message (under 5,000 characters)." });
  }
  const dest = ROUTES[intent] ?? ROUTES.general;
  const ip = request.headers.get("CF-Connecting-IP") ?? "";

  // 4. Turnstile verification
  if (!token) {
    return json(400, { ok: false, error: "Please complete the verification challenge." });
  }
  const verifyBody = new FormData();
  verifyBody.append("secret", env.TURNSTILE_SECRET_KEY);
  verifyBody.append("response", token);
  if (ip) verifyBody.append("remoteip", ip);
  let verifyOk = false;
  try {
    const vr = await fetch(TURNSTILE_VERIFY, { method: "POST", body: verifyBody });
    const v = (await vr.json()) as { success?: boolean };
    verifyOk = v.success === true;
  } catch {
    verifyOk = false;
  }
  if (!verifyOk) {
    return json(400, { ok: false, error: "Verification failed. Please try again." });
  }

  // 5. per-IP rate limit (best-effort; only when KV is bound)
  if (env.RATE_LIMIT && ip) {
    const key = `rl:${ip}`;
    const current = parseInt((await env.RATE_LIMIT.get(key)) ?? "0", 10) || 0;
    if (current >= RL_MAX) {
      return json(429, {
        ok: false,
        error: "Too many messages from your network. Please try again in a little while.",
      });
    }
    await env.RATE_LIMIT.put(key, String(current + 1), { expirationTtl: RL_WINDOW_S });
  }

  // 6. compose + relay via the Vectis Mail HTTPS send API
  const subject = `Pharlux contact (${intent}) — ${name}`.slice(0, CAP.subject);
  const textBody =
    "New pharlux.com contact form submission\n" +
    "---------------------------------------\n" +
    `Name:  ${name}\n` +
    `Email: ${email}\n` +
    `Topic: ${intent}\n\n` +
    `${message}\n`;

  const payload = {
    from: { email: "noreply@pharlux.com", name: "Pharlux" },
    to: [{ email: dest }],
    reply_to: { email, name },
    subject,
    text_body: textBody,
  };

  let sendResp: Response;
  try {
    sendResp = await fetch(SEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PHARLUX_SEND_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return json(502, {
      ok: false,
      error: "We couldn't send your message right now. Please try again shortly.",
    });
  }

  // 7. surface the send-API rate-limit backstop (120/min -> 429) + other failures
  if (sendResp.status === 429) {
    return json(429, {
      ok: false,
      error: "We're receiving a lot of messages right now. Please try again shortly.",
    });
  }
  if (!sendResp.ok) {
    return json(502, {
      ok: false,
      error: "We couldn't send your message right now. Please try again shortly.",
    });
  }

  return json(200, { ok: true });
};
