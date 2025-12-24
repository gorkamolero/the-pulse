import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
    newUser: '/chat',
  },
  providers: [
    // added later in auth.ts since it requires bcrypt which is only compatible with Node.js
    // while this file is also used in non-Node.js environments
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnChat = nextUrl.pathname.startsWith('/chat');
      const isOnSettings = nextUrl.pathname === '/settings';
      const isOnRegister = nextUrl.pathname.startsWith('/register');
      const isOnLogin = nextUrl.pathname.startsWith('/login');

      // Redirect logged-in users from auth pages to chat
      if (isLoggedIn && (isOnLogin || isOnRegister)) {
        return Response.redirect(new URL('/chat', nextUrl as unknown as URL));
      }

      // Always allow access to register and login pages
      if (isOnRegister || isOnLogin) {
        return true;
      }

      // Protected routes: /chat and /settings
      if (isOnChat || isOnSettings) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      }

      // All other routes (including /, /guest) are public
      return true;
    },
  },
} satisfies NextAuthConfig;
