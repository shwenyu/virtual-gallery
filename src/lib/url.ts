export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL; // always ends with "/"
  return base + path.replace(/^\//, "");
}
