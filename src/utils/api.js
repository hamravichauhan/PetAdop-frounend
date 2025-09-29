// src/utils/api.js
import axios from "axios";

/**
 * Base URL strategy:
 * - Dev (Vite proxy):            VITE_API_BASE_URL = "/api"
 * - Prod (same or cross domain): VITE_API_BASE_URL = "/api"  OR "https://your-app.azurewebsites.net/api"
 *
 * Always call like: api.get("/pets"), api.post("/auth/login"), etc.
 */

// ---------- Base URL normalize ----------
const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || "").trim() || "/api";
// remove trailing slash (but keep protocol slashes for absolute)
const BASE = RAW_BASE.endsWith("/") ? RAW_BASE.slice(0, -1) : RAW_BASE;

// ---------- Axios instance ----------
const api = axios.create({
  baseURL: BASE,          // "/api" or "https://.../api"
  withCredentials: false, // we're using Bearer tokens, NOT cookies
  timeout: 20000,
});

// ---------- Token storage helpers (backward-compatible) ----------
function getToken() {
  // read both "accessToken" and legacy "token"
  return localStorage.getItem("accessToken") || localStorage.getItem("token");
}
function setToken(t) {
  if (t) {
    localStorage.setItem("accessToken", t);
    localStorage.setItem("token", t); // keep legacy key in sync
    api.defaults.headers.common.Authorization = `Bearer ${t}`;
  } else {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("token");
    delete api.defaults.headers.common.Authorization;
  }
}
function getRefreshToken() {
  return localStorage.getItem("refreshToken");
}
function setRefreshToken(rt) {
  if (rt) localStorage.setItem("refreshToken", rt);
  else localStorage.removeItem("refreshToken");
}

// bootstrap header on load
const boot = getToken();
if (boot) setToken(boot);

// ---------- URL helpers ----------
function toAbsoluteUrlMaybe(u) {
  try {
    const isAbs = /^https?:\/\//i.test(u);
    return isAbs ? u : new URL(u, window.location.origin).toString();
  } catch {
    return u;
  }
}
function cleanRelativeUrl(u) {
  if (typeof u !== "string") return u;
  if (/^https?:\/\//i.test(u)) return u; // absolute: leave as-is
  // ensure a single leading slash for relative paths
  return u.startsWith("/") ? u : `/${u}`;
}

// ---------- Request interceptor ----------
api.interceptors.request.use((config) => {
  // attach bearer if present
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  // normalize relative url (avoid // and double prefixes)
  if (typeof config.url === "string") {
    config.url = cleanRelativeUrl(config.url);
  }
  return config;
});

// ---------- Helpers for refresh ----------
function pathnameOf(urlLike) {
  try {
    const u = new URL(urlLike, window.location.origin);
    return u.pathname.toLowerCase();
  } catch {
    return String(urlLike || "").toLowerCase();
  }
}

// Consider both styles your backend might expose
function isAuthEndpointUrl(urlLike) {
  const p = pathnameOf(urlLike);
  return (
    p.endsWith("/auth/login") ||
    p.endsWith("/auth/register") ||
    p.endsWith("/auth/refresh") ||
    p.endsWith("/auth/logout") ||
    p.endsWith("/password/forgot") ||
    p.endsWith("/password/reset")
  );
}

// Build "<BASE>/auth/refresh" without double slashes
function buildRefreshUrl() {
  const base = BASE.endsWith("/") ? BASE.slice(0, -1) : BASE;
  return toAbsoluteUrlMaybe(`${base}/auth/refresh`);
}

// ---------- Response interceptor (401 -> refresh once) ----------
let refreshInFlight = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error || {};
    if (!response || !config) return Promise.reject(error);

    // If not 401, already retried, or is an auth endpoint → don't try refresh
    if (response.status !== 401 || config.__isRetry || isAuthEndpointUrl(config.url)) {
      return Promise.reject(error);
    }

    // Single refresh flight for concurrent 401s
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        try {
          const refreshToken = getRefreshToken();
          const body = refreshToken ? { refreshToken } : {};
          const refreshRes = await axios.post(buildRefreshUrl(), body, {
            withCredentials: false, // Bearer-only flow
            timeout: 15000,
          });

          const newAccess =
            refreshRes.data?.accessToken ||
            refreshRes.data?.token ||
            refreshRes.data?.tokens?.accessToken ||
            null;

          const newRefresh =
            refreshRes.data?.refreshToken ||
            refreshRes.data?.tokens?.refreshToken ||
            null;

          if (!newAccess) throw new Error("No access token in refresh response");

          setToken(newAccess);
          if (newRefresh) setRefreshToken(newRefresh);

          return newAccess;
        } catch (e) {
          // refresh failed → clear tokens
          setToken(null);
          setRefreshToken(null);
          throw e;
        } finally {
          refreshInFlight = null;
        }
      })();
    }

    try {
      await refreshInFlight; // wait for token refresh
      // retry original once with fresh token
      const t = getToken();
      config.__isRetry = true;
      config.headers = config.headers || {};
      if (t) config.headers.Authorization = `Bearer ${t}`;
      return api(config);
    } catch {
      return Promise.reject(error);
    }
  }
);

// ---------- Public helpers for your auth store ----------
/**
 * Call after login/register:
 *   setAuthTokens({ accessToken, refreshToken })
 * or (legacy):
 *   setAuthTokens({ token })
 */
export function setAuthTokens({ accessToken, token, refreshToken } = {}) {
  setToken(accessToken || token || null);
  if (typeof refreshToken !== "undefined") setRefreshToken(refreshToken);
}

/** Call on logout */
export function clearAuthTokens() {
  setToken(null);
  setRefreshToken(null);
}

export default api;
