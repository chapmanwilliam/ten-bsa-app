import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
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
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the auth token (important for server components)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === '/login';
  const isMfaPage = pathname.startsWith('/mfa/');
  const isPublicPage =
    isLoginPage ||
    pathname === '/forgot-password' ||
    pathname === '/demo' ||
    pathname.startsWith('/auth/callback');
  const isResetPasswordPage = pathname === '/reset-password';

  // --- Unauthenticated users ---
  if (!user && !isPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // --- Authenticated users ---
  if (user) {
    // Check AAL (assurance level)
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const currentLevel = aalData?.currentLevel ?? 'aal1';
    const nextLevel = aalData?.nextLevel ?? 'aal1';

    // Allow reset-password page without MFA (recovery session)
    if (isResetPasswordPage) {
      return supabaseResponse;
    }

    // User is fully authenticated (aal2) — redirect away from login/mfa pages
    if (currentLevel === 'aal2') {
      if (isLoginPage || isMfaPage) {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
      // Allow through to app
      return supabaseResponse;
    }

    // User is aal1 — needs MFA
    if (currentLevel === 'aal1') {
      if (nextLevel === 'aal2') {
        // Has TOTP enrolled but hasn't verified yet → send to verify
        if (pathname !== '/mfa/verify') {
          const url = request.nextUrl.clone();
          url.pathname = '/mfa/verify';
          return NextResponse.redirect(url);
        }
      } else {
        // No TOTP enrolled yet → send to enrol
        if (pathname !== '/mfa/enroll') {
          const url = request.nextUrl.clone();
          url.pathname = '/mfa/enroll';
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}
