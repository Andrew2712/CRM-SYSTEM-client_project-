import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Vyayama-physio",
  description: "Clinic Resource Management System",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? "";

  return (
    <html lang="en">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content={`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`}
        />
      </head>
      <body
        style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}
        {...(nonce ? { "data-nonce": nonce } : {})}
      >
        <SessionProvider nonce={nonce}>{children}</SessionProvider>
      </body>
    </html>
  );
}
