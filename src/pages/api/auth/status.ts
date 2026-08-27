import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";
import { isAuthenticated, needsSetup } from "../../../lib/auth";

export const prerender = false;

/** Lets the login page tell "set a password" apart from "sign in". */
export const GET: APIRoute = async ({ request }) => {
  const db = getDb();
  return Response.json({
    needsSetup: await needsSetup(db),
    authenticated: await isAuthenticated(request, db),
  });
};
