import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes anyone can open without an account (guest / demo mode).
const OPEN_PREFIXES = [
  "/login",
  "/auth",
  "/privacy",
  "/terms",
  "/point-values",
  "/offline",
  "/browse",
  "/wallet",
  "/simulate",
  "/optimize",
  "/sandbox",
  "/reports",
  "/settings",
  "/api",
  "/pwa",
];

function isOpenRoute(pathname: string) {
  return pathname === "/" || OPEN_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // If Supabase falls back to the Site URL (redirect URL not allow-listed),
  // the OAuth code lands on "/" or another page. Forward it to the callback
  // so Google sign-in still completes.
  if (searchParams.has("code") && !pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // No Supabase session cookie → nothing to refresh. Skip the auth round-trip
  // entirely for guests (the common demo path).
  const hasSessionCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

  if (!hasSessionCookie) {
    if (isOpenRoute(pathname)) return NextResponse.next({ request });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the session if expired. getClaims() verifies the JWT locally
  // when the project uses asymmetric signing keys (no network round-trip),
  // otherwise it falls back to the Auth server like getUser().
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  // Signed-in users skip the marketing page.
  if (signedIn && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/browse";
    return NextResponse.redirect(url);
  }

  if (!signedIn && !isOpenRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon|apple-icon|opengraph-image|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
