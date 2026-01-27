import type { NextAuthConfig } from 'next-auth';
import { NextResponse } from 'next/server';

export const authConfig = {
  pages: {
    signIn: '/login',
    newUser: '/pulse',
  },
  providers: [
    // added later in auth.ts since it requires bcrypt which is only compatible with Node.js
    // while this file is also used in non-Node.js environments
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnPulse = nextUrl.pathname.startsWith('/pulse');
      const isOnSettings = nextUrl.pathname === '/settings';
      const isOnRegister = nextUrl.pathname.startsWith('/register');
      const isOnLogin = nextUrl.pathname.startsWith('/login');

      const isOnWelcome = nextUrl.pathname === '/welcome';

      // Redirect logged-in users from auth/welcome pages to home
      if (isLoggedIn && (isOnLogin || isOnRegister || isOnWelcome)) {
        return NextResponse.redirect(new URL('/', nextUrl));
      }

      // Always allow access to register and login pages
      if (isOnRegister || isOnLogin) {
        return true;
      }

      // Protected routes: / (home), /settings
      if (isOnSettings) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      }

      // Root path: allow both guests and authenticated users
      // All other routes (including /welcome) are public
      return true;
    },
  },
} satisfies NextAuthConfig;
