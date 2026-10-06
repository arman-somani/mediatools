/**
 * Centralised environment loading.
 *
 * Secrets are resolved once, at import time, and the process refuses to start
 * if a required one is missing. The previous code scattered
 * `process.env.JWT_SECRET || 'secret'` across four call sites, which meant an
 * unset variable on Render produced a booting, apparently-healthy service that
 * signed tokens with a publicly known key — anyone could mint themselves
 * `role: "admin"`. Failing loudly at boot is the only safe default for a secret.
 */

function required(name: string): string {
  const value = (process.env[name] || '').trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
      `Set it in the Render dashboard (Environment tab) or your local .env file.`
    );
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return (process.env[name] || fallback).trim();
}

/** Minimum entropy for a signing key. 32 bytes hex = 64 chars is the target. */
const MIN_SECRET_LENGTH = 32;

function requiredSecret(name: string): string {
  const value = required(name);
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} is too short (${value.length} chars, need >= ${MIN_SECRET_LENGTH}). ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
  }
  // Guards against the old hardcoded values surviving as literal env values.
  if (['secret', 'refresh_secret', 'changeme'].includes(value.toLowerCase())) {
    throw new Error(`${name} is set to a placeholder value. Use a real random secret.`);
  }
  return value;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  isProduction: optional('NODE_ENV') === 'production',
  port: Number(optional('PORT', '5000')),

  mongoUri: required('MONGODB_URI'),

  jwtSecret: requiredSecret('JWT_SECRET'),
  /**
   * Falls back to a *derived* key rather than a constant, so a deployment that
   * only sets JWT_SECRET still gets two distinct, unguessable keys. Deriving
   * beats reusing the same secret for both token types.
   */
  jwtRefreshSecret: (() => {
    const explicit = optional('JWT_REFRESH_SECRET');
    if (explicit) return explicit;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto') as typeof import('crypto');
    return crypto
      .createHmac('sha256', requiredSecret('JWT_SECRET'))
      .update('refresh-token-derivation-v1')
      .digest('hex');
  })(),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '15m'),
  jwtRefreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),

  /**
   * Comma-separated list of allowed browser origins.
   * Kept as an array here so nothing downstream has to re-parse it — the bug
   * that produced reset links like "https://a.com,https://b.com/auth/..."
   * came from `utils/email.ts` reading the raw comma-joined string.
   */
  frontendOrigins: optional('FRONTEND_URL', 'http://localhost:3000')
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean),

  /** The canonical public site URL, used to build links inside emails. */
  get primaryFrontendUrl(): string {
    return this.frontendOrigins[0] || 'http://localhost:3000';
  },

  /**
   * Email address that is granted the admin role when it registers.
   * Replaces the hardcoded email+password override that used to live in
   * routes/auth.ts. The account still has to authenticate normally with its
   * own bcrypt-hashed password; this only controls role assignment.
   */
  adminEmail: optional('ADMIN_EMAIL').toLowerCase(),

  /**
   * SMTP delivery. Deliberately optional: the app is useful without mail, and
   * `mail.configured` lets the auth routes tell a user "we could not send the
   * code" instead of silently creating an account whose inbox will stay empty.
   */
  mail: {
    host: optional('SMTP_HOST', 'smtp.gmail.com'),
    port: Number(optional('SMTP_PORT', '587')),
    user: optional('SMTP_USER'),
    pass: optional('SMTP_PASS'),
    fromName: optional('FROM_NAME', 'MediaTools'),
    fromEmail: optional('FROM_EMAIL') || optional('SMTP_USER'),
    get configured(): boolean {
      return Boolean(this.user && this.pass && this.fromEmail);
    },
  },

  youtube: {
    cookieFile: optional('YOUTUBE_COOKIES_FILE'),
    cookiesB64: optional('YOUTUBE_COOKIES_B64'),
    proxyUrl: optional('PROXY_URL'),
    /**
     * PO token generation.
     *
     * Two modes, and on a 512MB instance the choice matters more than it looks.
     *
     * `potServerHome` is script mode: yt-dlp spawns the generator only when a
     * token is actually needed and it exits immediately after, so it costs
     * memory for a few seconds per extraction rather than permanently. Tokens
     * are cached on disk between runs.
     *
     * `potProviderUrl` is HTTP mode, which keeps a second Node process resident
     * for the life of the container. That is roughly 130MB that cannot be
     * reclaimed, competing directly with ffmpeg during a merge. Use it only
     * when the provider runs on a different host.
     *
     * Script mode is the default for exactly that reason.
     */
    potServerHome: optional('POT_SERVER_HOME', '/app/bgutil-ytdlp-pot-provider/server'),
    potProviderUrl: optional('POT_PROVIDER_URL'),
    jsRuntime: optional('YT_JS_RUNTIME', 'deno,node'),
  },

  /**
   * Hard ceilings, sized for a 512MB container.
   *
   * At peak the box holds the API (~190MB), yt-dlp (~70MB) and either the
   * token generator or ffmpeg (~80-120MB). The queue runs one job at a time;
   * raising that is the fastest way to get OOM-killed here.
   */
  maxDurationSeconds: Number(optional('MAX_DURATION_SECONDS', '5400')),
  maxFileSizeMb: Number(optional('MAX_FILE_SIZE_MB', '250')),
  /** Jobs allowed to wait behind the running one before new ones are refused. */
  maxQueueDepth: Number(optional('MAX_QUEUE_DEPTH', '12')),
};

export type Env = typeof env;
