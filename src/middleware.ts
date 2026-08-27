import { defineMiddleware } from "astro:middleware";
import { getDb } from "./lib/db";
import { isAuthenticated } from "./lib/auth";

/**
 * Guards the admin area on the server.
 *
 * The old client-side gate only hid the UI — anyone could read the page source
 * and the data was writable with a token in the browser. Here an unauthenticated
 * request never reaches an admin page or write endpoint at all.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;

  const isAdminPage = path === "/admin" || path.startsWith("/admin/");
  const isAdminApi = path.startsWith("/api/admin/");
  if (!isAdminPage && !isAdminApi) return next();

  // The login page and the auth endpoints have to stay reachable to log in.
  if (path === "/admin/login" || path === "/admin/login/" || path.startsWith("/api/auth/")) {
    return next();
  }

  const db = getDb();
  if (await isAuthenticated(context.request, db)) return next();

  if (isAdminApi) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const next_ = encodeURIComponent(path + context.url.search);
  return context.redirect(`/admin/login/?next=${next_}`, 302);
});
