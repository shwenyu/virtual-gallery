import type { APIRoute } from "astro";
import { getBucket } from "../../lib/db";

export const prerender = false;

/**
 * Serves a photo from R2 on the site's own domain.
 *
 * Keeping images on echogallery.art rather than a separate image host means one
 * origin to reach — which matters for readers on networks where a second
 * third-party domain may not be reachable.
 */
export const GET: APIRoute = async ({ params, request }) => {
  const key = params.key;
  if (!key) return new Response("Not found", { status: 404 });

  // Only ask R2 for a range when the client actually requested one; passing the
  // headers unconditionally makes it report a range for ordinary requests too,
  // which turned every plain image fetch into a malformed 206.
  const wantsRange = request.headers.has("range");

  const bucket = getBucket();
  const object = await bucket.get(key, {
    ...(wantsRange ? { range: request.headers } : {}),
    onlyIf: request.headers,
  });

  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  // Uploads get a fresh key, so a stored object never changes under the same URL.
  headers.set("cache-control", "public, max-age=31536000, immutable");

  // `onlyIf` returns a bodyless object when the client's cached copy is current.
  if (!("body" in object) || !object.body) {
    return new Response(null, { status: 304, headers });
  }

  if (wantsRange && object.range && "offset" in object.range) {
    const offset = object.range.offset ?? 0;
    const end = offset + (object.range.length ?? object.size - offset) - 1;
    headers.set("content-range", `bytes ${offset}-${end}/${object.size}`);
    return new Response(object.body, { status: 206, headers });
  }

  return new Response(object.body, { status: 200, headers });
};
