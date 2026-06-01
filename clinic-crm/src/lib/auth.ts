/**
 * src/lib/auth.ts
 *
 * CHANGE: Switched from JWT sessions to database sessions for server-side
 * revocation support. With JWT, a terminated staff member's token remained
 * valid until expiry (up to 8 hours) with no way to invalidate it short of
 * rotating NEXTAUTH_SECRET for everyone.
 *
 * Database sessions mean NextAuth stores a session row in Postgres. When you
 * need to force-logout a user (staff termination, security incident), simply
 * delete their session rows:
 *
 *   await prisma.session.deleteMany({ where: { userId: staffId } });
 *
 * PREREQUISITES — run the Prisma migration that adds the NextAuth tables:
 *   prisma/migrations/20260601000000_add_session_denylist/migration.sql
 *
 * IMPORTANT: The @auth/prisma-adapter package is already in package.json.
 * No new dependencies are needed.
 */

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  // ── Database sessions (replaces JWT strategy) ─────────────────────────────
  // Sessions are now stored in Postgres. The session token in the cookie is
  // a random opaque string that maps to a session row — not a signed JWT.
  // This means sessions can be invalidated server-side at any time.
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: {
    strategy: "database",
    maxAge: 8 * 60 * 60,       // 8 hours — session expires after this
    updateAge: 60 * 60,        // refresh the DB row every 1 hour of activity
  },
  pages: { signIn: "/auth/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          // ── Staff user ────────────────────────────────────────────────────
          const staffUser = await prisma.user.findUnique({
            where: { email: credentials.email },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              passwordHash: true,
              isActive: true,
            },
          });

          if (staffUser) {
            if (!staffUser.isActive) return null;

            const valid = await bcrypt.compare(
              credentials.password,
              staffUser.passwordHash
            );
            if (!valid) return null;

            return {
              id: staffUser.id,
              name: staffUser.name,
              email: staffUser.email,
              role: staffUser.role as string,
            };
          }

          // ── Patient user ──────────────────────────────────────────────────
          const patient = await prisma.patient.findFirst({
            where: { email: credentials.email },
            select: {
              id: true,
              name: true,
              email: true,
              passwordHash: true,
              isActive: true,
            },
          });

          if (!patient || !patient.passwordHash) return null;
          if (!patient.isActive) return null;

          const valid = await bcrypt.compare(
            credentials.password,
            patient.passwordHash
          );
          if (!valid) return null;

          return {
            id: patient.id,
            name: patient.name,
            email: patient.email ?? "",
            role: "PATIENT",
            patientId: patient.id,
          };
        } catch (err) {
          console.error("[Auth] authorize exception:", (err as Error).message);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    // With database sessions, the session object is populated from the DB.
    // We enrich it with role and patientId which are stored in the User row.
    async session({ session, user }) {
      if (user) {
        session.user.id = user.id;
  
        session.user.role = user.role;
       
        if (user.patientId) session.user.patientId = user.patientId;
      }
      return session;
    },
  },
};

/**
 * Forcibly invalidate all active sessions for a user.
 *
 * Call this when:
 *  - A staff member is deactivated / fired
 *  - A patient account is suspended
 *  - A security incident requires immediate logout
 *
 * Usage:
 *   import { revokeUserSessions } from "@/lib/auth";
 *   await revokeUserSessions(userId);
 */
export async function revokeUserSessions(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { userId } });
  return result.count;
}
