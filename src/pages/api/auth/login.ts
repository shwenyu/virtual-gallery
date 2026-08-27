import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";
import { createSessionCookie, getPasswordHash, needsSetup, setPassword, verifyPassword } from "../../../lib/auth";

export const prerender = false;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

/**
 * Signs in, or sets the password on first run.
 *
 * Setup is only allowed while no password exists; once one is set this endpoint
 * can never overwrite it, so it cannot be used to take over the account.
 */
export const POST: APIRoute = async ({ request }) => {
  const db = getDb();

  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return json({ error: "请求格式不正确" }, 400);
  }

  if (password.length < 8) {
    return json({ error: "口令至少 8 个字符" }, 400);
  }

  if (await needsSetup(db)) {
    await setPassword(db, password);
    return json({ ok: true, created: true }, 200, { "set-cookie": await createSessionCookie(db) });
  }

  const stored = await getPasswordHash(db);
  if (!stored || !(await verifyPassword(password, stored))) {
    return json({ error: "口令不正确" }, 401);
  }

  return json({ ok: true }, 200, { "set-cookie": await createSessionCookie(db) });
};
