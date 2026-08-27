import type { APIRoute } from "astro";
import { clearSessionCookie } from "../../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async () =>
  new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": clearSessionCookie(),
    },
  });
