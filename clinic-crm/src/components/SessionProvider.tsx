"use client";

/**
 * src/components/SessionProvider.tsx
 *
 * BUG: The `nonce` prop was accepted but silently dropped — it was never
 * forwarded to <NextSessionProvider>. NextAuth injects an inline <script>
 * to hydrate the session on the client. Without a matching nonce on that
 * script element, the browser blocks it under the CSP rule
 * `script-src 'self' 'nonce-...' 'strict-dynamic'`.
 *
 * FIX: Pass `basePath` and forward the nonce so NextAuth stamps its injected
 * script with the correct nonce attribute.
 */

import { SessionProvider as NextSessionProvider } from "next-auth/react";

export function SessionProvider({
  children,
  nonce,
}: {
  children: React.ReactNode;
  nonce?: string;
}) {
  return (
    <NextSessionProvider basePath="/api/auth" {...(nonce ? { nonce } : {})}>
      {children}
    </NextSessionProvider>
  );
}
