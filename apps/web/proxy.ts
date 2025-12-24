import { auth } from '@/app/(auth)/auth';

export default auth;

export const config = {
  matcher: [
    '/',
    '/pulse/:path*',
    '/settings',
    '/api/pulse/:path*',
    '/api/files/:path*',
    '/api/history/:path*',
    '/api/suggestions/:path*',
    '/api/vote/:path*',
    '/login',
    '/register',
  ],
};
