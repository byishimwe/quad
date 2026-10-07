const blockedUntil = new Map<string, number>();

export function rateLimitKey(method = "GET", url = ""): string {
  let pathname: string;
  try {
    pathname = new URL(url, "http://localhost").pathname;
  } catch {
    // Malformed caller input must not crash an interceptor before Axios can
    // surface its own request error.
    pathname = url.split(/[?#]/, 1)[0] || "/";
  }
  const path = pathname.replace(/^\/api(?=\/|$)/, "");
  const family = path.split("/").filter(Boolean)[0] || "root";
  return `${method.toUpperCase()}:${family}`;
}

export const rateLimitState = {
  get(key: string): number | null {
    const until = blockedUntil.get(key);
    if (!until) return null;
    if (until <= Date.now()) {
      blockedUntil.delete(key);
      return null;
    }
    return until;
  },
  block(key: string, milliseconds: number): void {
    blockedUntil.set(key, Date.now() + milliseconds);
  },
  clear(): void {
    blockedUntil.clear();
  },
};
