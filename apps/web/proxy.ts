import { auth } from '@/app/(auth)/auth';

export default auth;

export const config = {
  matcher: [
    '/chat/:path*',
    '/settings',
    '/api/chat/:path*',
    '/api/files/:path*',
    '/api/history/:path*',
    '/api/suggestions/:path*',
    '/api/vote/:path*',
    '/login',
    '/register',
  ],
};
