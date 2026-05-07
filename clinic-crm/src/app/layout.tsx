import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "Vyayama-physio",
  description: "Clinic Resource Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}