import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Rutas accesibles sin sesión.
const PUBLIC_PATHS = ["/login", "/registro", "/recuperar", "/auth", "/offline", "/suspendida", "/api/keepalive"];
// Si ya hay sesión, estas no tienen sentido.
const GUEST_ONLY = ["/login", "/registro"];

function matches(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Para que las páginas sepan a dónde volver después del login u onboarding.
  request.headers.set("x-pathname", pathname + search);

  const { response, userId } = await updateSession(request);

  const redirectTo = (url: URL) => {
    const res = NextResponse.redirect(url);
    // Conservar las cookies de sesión refrescadas y los headers anti-cache.
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    response.headers.forEach((value, key) => {
      if (["cache-control", "expires", "pragma"].includes(key)) res.headers.set(key, value);
    });
    return res;
  };

  if (!userId && !matches(pathname, PUBLIC_PATHS)) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return redirectTo(url);
  }

  if (userId && matches(pathname, GUEST_ONLY)) {
    const next = request.nextUrl.searchParams.get("next");
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    return redirectTo(new URL(target, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Todo menos estáticos, íconos, manifest y service worker.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|pwa-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
