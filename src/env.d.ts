/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

interface Env {
  DB: D1Database;
  /** Present once R2 is enabled on the account and the binding is uncommented. */
  PHOTOS?: R2Bucket;
  /** Signing key for admin session cookies. Set with `wrangler secret put SESSION_SECRET`. */
  SESSION_SECRET?: string;
}

declare namespace App {
  interface Locals extends Runtime {}
}
