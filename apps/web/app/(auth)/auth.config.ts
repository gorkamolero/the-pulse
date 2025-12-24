import type { NextAuthConfig } from 'next-auth';

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
      const isOnGuest = nextUrl.pathname.startsWith('/guest');

      // Redirect logged-in users from auth/welcome pages to home
      if (isLoggedIn && (isOnLogin || isOnRegister || isOnWelcome || isOnGuest)) {
        return Response.redirect(new URL('/', nextUrl as unknown as URL));
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

      // Root path: redirect unauthenticated to welcome page
      if (nextUrl.pathname === '/') {
        if (isLoggedIn) return true;
        return Response.redirect(new URL('/welcome', nextUrl as unknown as URL));
      }

      // All other routes (including /welcome, /guest) are public
      return true;
    },
  },
} satisfies NextAuthConfig;
