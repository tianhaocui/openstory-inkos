import { createFileRoute } from '@tanstack/react-router';
import { handleInkOSSessionRequest } from '@/platform/server/auth/inkos-session';

export const Route = createFileRoute('/api/internal/inkos-session')({
  server: {
    handlers: {
      GET: async ({ request }) => handleInkOSSessionRequest(request),
    },
  },
});
