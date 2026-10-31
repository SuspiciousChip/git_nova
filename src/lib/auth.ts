import crypto from "node:crypto";
import { ApiError } from "./api";

export const SESSION_COOKIE = "gitnova_session";
export const STATE_COOKIE = "gitnova_oauth_state";

function required(name: string) { const value = process.env[name]?.trim(); if (!value) throw new ApiError(503, "AUTH_NOT_CONFIGURED", "GitHub sign-in is not configured on this server."); return value; }
export function authConfig() { return { clientId: required("GITHUB_CLIENT_ID"), clientSecret: required("GITHUB_CLIENT_SECRET"), secret: required("AUTH_SECRET") }; }
function b64(value: Buffer | string) { return Buffer.from(value).toString("base64url"); }
function unb64(value: string) { return Buffer.from(value, "base64url"); }
export function createState(secret = authConfig().secret) { const nonce = b64(crypto.randomBytes(18)); const stamp = Date.now().toString(); const payload = `${nonce}.${stamp}`; const signature = b64(crypto.createHmac("sha256", secret).update(payload).digest()); return `${payload}.${signature}`; }
export function validState(value: string | undefined, secret = authConfig().secret) { if (!value) return false; const parts = value.split("."); if (parts.length !== 3 || Date.now() - Number(parts[1]) > 10 * 60_000) return false; const expected = crypto.createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest(); return crypto.timingSafeEqual(unb64(parts[2]), expected); }
export function encryptSession(value: object, secret = authConfig().secret) { const key = crypto.createHash("sha256").update(secret).digest(); const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", key, iv); const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]); return `v1.${b64(iv)}.${b64(cipher.getAuthTag())}.${b64(encrypted)}`; }
export function decryptSession<T>(value: string | undefined, secret = authConfig().secret): T | null { try { if (!value?.startsWith("v1.")) return null; const [, iv, tag, data] = value.split("."); const key = crypto.createHash("sha256").update(secret).digest(); const decipher = crypto.createDecipheriv("aes-256-gcm", key, unb64(iv)); decipher.setAuthTag(unb64(tag)); return JSON.parse(Buffer.concat([decipher.update(unb64(data)), decipher.final()]).toString("utf8")) as T; } catch { return null; } }
export interface SessionUser { login: string; name: string | null; avatarUrl: string | null; token: string }
export async function githubJson<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, { ...init, headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(init?.headers ?? {}) } }); if (!response.ok) throw new ApiError(response.status === 401 ? 401 : 502, response.status === 401 ? "GITHUB_AUTH_ERROR" : "GITHUB_ERROR", "GitHub could not complete that request."); return response.json() as Promise<T>; }
