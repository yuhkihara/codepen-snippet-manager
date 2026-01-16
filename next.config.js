const nextConfig = {
  async headers() {
    return [
      { source: '/p/:path*', headers: [{ key: 'Content-Security-Policy', value: "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none';" }] },
      { source: '/snippets/:path*/edit', headers: [{ key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' data: https://unpkg.com https://cdn.jsdelivr.net; frame-ancestors 'self'; connect-src 'self' https://*.supabase.co https://unpkg.com https://cdn.jsdelivr.net; worker-src 'self' blob:;" }] },
      { source: '/email-composer/:path*', headers: [{ key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' data: https://unpkg.com https://cdn.jsdelivr.net; frame-ancestors 'self'; connect-src 'self' https://*.supabase.co https://unpkg.com https://cdn.jsdelivr.net; worker-src 'self' blob:;" }] },
      { source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' data: https://unpkg.com https://cdn.jsdelivr.net; frame-ancestors 'self'; connect-src 'self' https://*.supabase.co https://unpkg.com https://cdn.jsdelivr.net; worker-src 'self' blob:;" }, { key: 'X-Frame-Options', value: 'SAMEORIGIN' }, { key: 'X-Content-Type-Options', value: 'nosniff' }] },
    ];
  },
};
module.exports = nextConfig;
