"use client";
import { SessionProvider as NextSessionProvider } from "next-auth/react";

export function SessionProvider({
  children,
  nonce,
}: {
  children: React.ReactNode;
  nonce?: string;
}) {
  return <NextSessionProvider>{children}</NextSessionProvider>;
}
