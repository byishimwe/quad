import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

import { logError } from "../errorHandling";
import { generateCacheKey, requestCache } from "../requestCache";
import { rateLimitKey, rateLimitState } from "./rateLimitState";

type ScopedRequest = InternalAxiosRequestConfig & {
  _cacheScope?: string;
  _retryCount?: number;
};

type CachedResponseError = {
  config: ScopedRequest;
  response: AxiosResponse;
  isCache: true;
};

type RuntimeClerk = {
  load?: () => Promise<void>;
  session?: { id?: string; getToken?: () => Promise<string | null> } | null;
  user?: { id?: string } | null;
};

function clerk(): RuntimeClerk | undefined {
  return (window as unknown as { Clerk?: RuntimeClerk }).Clerk;
}

function currentScope(): string | null {
  const runtime = clerk();
  return runtime?.session?.id && runtime.user?.id
    ? `${runtime.user.id}:${runtime.session.id}`
    : null;
}

async function getRuntimeClerkToken(): Promise<string | null> {
  try {
    const runtime = clerk();
    if (!runtime) return null;
    await runtime.load?.();
    return (await runtime.session?.getToken?.()) || null;
  } catch {
    return null;
  }
}

function cacheKey(config: ScopedRequest): string | null {
  if (!config._cacheScope) return null;
  return `${generateCacheKey(config.url || "", config.params as Record<string, unknown>)}::${config._cacheScope}`;
}

function retryAfterMilliseconds(header: unknown): number {
  if (typeof header === "string") {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 60_000;
}

export function attachInterceptors(api: AxiosInstance) {
  api.interceptors.request.use(async (config: ScopedRequest) => {
    const blocked = rateLimitState.get(rateLimitKey(config.method, config.url));
    if (blocked) {
      const seconds = Math.ceil((blocked - Date.now()) / 1000);
      throw new Error(`Rate limited. Please wait ${seconds} seconds before retrying.`);
    }

    const token = await getRuntimeClerkToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    else delete config.headers.Authorization;

    // An unidentifiable session is deliberately never cached.
    config._cacheScope = token ? currentScope() || undefined : undefined;
    if (config.method?.toLowerCase() === "get" && config.headers["X-Skip-Cache"] !== "true") {
      const key = cacheKey(config);
      const cached = key && requestCache.get<AxiosResponse>(key);
      if (cached) {
        throw { config, response: cached, isCache: true } satisfies CachedResponseError;
      }
    }
    return config;
  });

  api.interceptors.response.use(
    (response) => {
      const config = response.config as ScopedRequest;
      if (config.method?.toLowerCase() === "get" && config.headers["X-Skip-Cache"] !== "true") {
        const key = cacheKey(config);
        if (key && config._cacheScope === currentScope()) {
          const ttl = /\/profile\/|\/users\//.test(config.url || "") ? 10 * 60_000 : 30_000;
          requestCache.set(key, response, ttl);
        }
      }
      return response;
    },
    async (error: AxiosError | CachedResponseError) => {
      if ("isCache" in error && error.isCache) return error.response;

      const axiosError = error as AxiosError;
      const config = axiosError.config as ScopedRequest | undefined;
      if (axiosError.response?.status === 429) {
        const delay = retryAfterMilliseconds(axiosError.response.headers["retry-after"]);
        const key = rateLimitKey(config?.method, config?.url);
        rateLimitState.block(key, delay);
        const { rateLimitManager } = await import("../rateLimitHandler");
        rateLimitManager.recordRateLimit(key, Math.ceil(delay / 1000));
        return Promise.reject(error);
      }

      const safeRead = config && ["get", "head"].includes(config.method?.toLowerCase() || "");
      const transient = !axiosError.response || axiosError.response.status >= 500;
      const cancelled = axios.isCancel(error) || axiosError.code === "ERR_CANCELED";
      if (safeRead && transient && !cancelled && (config._retryCount || 0) < 3) {
        const attempt = (config._retryCount || 0) + 1;
        config._retryCount = attempt;
        const delay = 500 * 2 ** (attempt - 1) + Math.random() * 150;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return api(config);
      }

      if (axiosError.response?.status && axiosError.response.status >= 500) {
        logError(error, { component: "API", action: "server-error" });
      }
      return Promise.reject(error);
    },
  );
}
