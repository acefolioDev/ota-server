import type { ApiError, AppRecord, PendingPublish } from "./types";

const JSON_HEADERS = { "content-type": "application/json" };

export async function fetchApps(token: string): Promise<AppRecord[]> {
  const payload = await getJson<AppRecord[] | ApiError>("/api/admin/apps", token);
  if (!Array.isArray(payload)) throw new Error("The server returned an invalid apps response.");
  return payload;
}

export async function fetchPendingPublishes(token: string): Promise<PendingPublish[]> {
  const payload = await getJson<PendingPublish[] | ApiError>("/api/admin/pending-updates", token);
  if (!Array.isArray(payload)) {
    throw new Error("The server returned an invalid pending updates response.");
  }
  return payload;
}

export function saveRollout(token: string, releaseId: string, rollout: number) {
  return sendJson(`/api/admin/updates/${releaseId}/rollout`, token, {
    method: "PATCH",
    body: JSON.stringify({ rollout }),
  });
}

export function rollbackRelease(token: string, releaseId: string) {
  return sendJson(`/api/admin/updates/${releaseId}/rollback`, token, { method: "POST" });
}

export function retryPendingPublish(token: string, pendingId: string) {
  return sendJson(`/api/admin/pending-updates/${pendingId}/retry`, token, { method: "POST" });
}

async function getJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: authHeaders(token) });
  const payload = (await response.json()) as T & ApiError;
  if (!response.ok) throw new Error(errorMessage(payload, response.status));
  return payload;
}

async function sendJson(url: string, token: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { ...authHeaders(token), ...JSON_HEADERS, ...init.headers },
  });
  const payload = (await response.json()) as ApiError;
  if (!response.ok) throw new Error(errorMessage(payload, response.status));
}

function authHeaders(token: string): HeadersInit {
  return { authorization: `Bearer ${token.trim()}` };
}

function errorMessage(payload: ApiError, status: number): string {
  const error = payload.error;
  if (typeof error === "string" && error) return error;
  if (typeof error === "object" && error !== null && typeof error.message === "string" && error.message) {
    return error.message;
  }
  return `Request failed (${status})`;
}
