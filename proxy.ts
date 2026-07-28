import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — MUST happen before any code that reads the session.
  // Do not use getSession() here; getUser() validates the token server-side.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to /login (except the login page itself,
  // public routes, guest-accessible app routes, and static/api routes).
  // Admin stays gated so it still forces a real sign-in.
  const { pathname } = request.nextUrl;
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/auth");
  const isPublicRoute = pathname === "/" || pathname.startsWith("/privacy") || pathname.startsWith("/terms");
  const isGuestRoute =
    pathname.startsWith("/browse") ||
    pathname.startsWith("/wallet") ||
    pathname.startsWith("/simulate") ||
    pathname.startsWith("/optimize") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/settings");
  const isStatic =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.match(/\.(ico|png|svg|jpg|jpeg|webp|woff2?)$/);

  if (!user && !isAuthRoute && !isPublicRoute && !isGuestRoute && !isStatic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
