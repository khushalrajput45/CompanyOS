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

  // Check is_disabled for authenticated users on protected routes
  if (user && !isPublicRoute) {
    try {
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("is_disabled")
        .eq("id", user.id)
        .single();

      if (profileErr || profile?.is_disabled) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set(
          "error",
          profile?.is_disabled
            ? "Your account has been disabled. Contact your administrator."
            : "Unable to verify your account. Please sign in again."
        );
        return NextResponse.redirect(url);
      }
    } catch {
      // On unexpected error, sign out and require re-auth (fail closed)
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "Session verification failed. Please sign in again.");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
