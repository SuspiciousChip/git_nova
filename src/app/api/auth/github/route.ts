import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { authConfig, createState, STATE_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export async function GET(request: Request) { try { const config = authConfig(); const state = createState(config.secret); const redirect = new URL("https://github.com/login/oauth/authorize"); redirect.searchParams.set("client_id", config.clientId); redirect.searchParams.set("redirect_uri", new URL("/api/auth/github/callback", request.url).toString()); redirect.searchParams.set("scope", "read:user repo"); redirect.searchParams.set("state", state); const response = NextResponse.redirect(redirect); response.cookies.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" }); return response; } catch { return NextResponse.json({ success: false, error: { code: "AUTH_NOT_CONFIGURED", message: "GitHub sign-in is not configured on this server." } }, { status: 503 }); } }
