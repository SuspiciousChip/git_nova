import { NextResponse } from "next/server";
import { authConfig, decryptSession, SESSION_COOKIE, type SessionUser } from "@/lib/auth";
export const runtime = "nodejs";
export async function GET(request: Request) { try { const value = request.headers.get("cookie")?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1]; const session = decryptSession<SessionUser>(value, authConfig().secret); return NextResponse.json({ success: true, user: session ? { login: session.login, name: session.name, avatarUrl: session.avatarUrl } : null }); } catch { return NextResponse.json({ success: true, user: null }); } }
