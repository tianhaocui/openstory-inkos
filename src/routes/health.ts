import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/health')({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version ?? '0.1.0',
          mode: 'cloudflare-compatible',
        }),
    },
  },
});
