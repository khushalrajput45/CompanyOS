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

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isPublicRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/login") ||
    pathname === "/register" ||
    pathname.startsWith("/register") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth/callback");

  // Not logged in → redirect to login (landing page "/" is public, not login)
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Logged in on landing/login/register → redirect to dashboard
  if (user && (pathname === "/" || pathname === "/login" || pathname.startsWith("/register"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Check profile for authenticated users on protected routes
  if (user && !isPublicRoute && !pathname.startsWith("/setup") && !pathname.startsWith("/api/")) {
    try {
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("is_disabled")
        .eq("id", user.id)
        .single();

      if (profile?.is_disabled) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "Your account has been disabled. Contact your administrator.");
        return NextResponse.redirect(url);
      }

      // Profile not found — account setup may still be in progress, sign out cleanly
      if (profileErr && profileErr.code === "PGRST116") {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "Account setup is not complete. Please register again.");
        return NextResponse.redirect(url);
      }
    } catch {
      // Network or unexpected error — don't sign out, just proceed
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
