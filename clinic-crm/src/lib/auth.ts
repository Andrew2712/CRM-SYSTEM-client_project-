/**
 * src/lib/auth.ts
 *
 * Session strategy: JWT (required for CredentialsProvider in NextAuth v4).
 *
 * WHY NOT strategy: "database"?
 * NextAuth v4 does NOT support CredentialsProvider with strategy: "database".
 * The credentials authorize() callback runs before a session row can be
 * written, so the library throws:
 *   UnsupportedStrategyError: Signin in with credentials only supported if JWT strategy is enabled
 *
 * REVOCATION — Redis denylist approach:
 * Instead of deleting session rows from Postgres, we write a short-lived
 * Redis key when a user is force-logged-out. Every JWT callback checks
 * this denylist; if the key exists the callback returns null, which kills
 * the session immediately on the next request.
 *
 * To force-logout a user:
 *   import { revokeUserSessions } from "@/lib/auth";
 *   await revokeUserSessions(userId);
 *
 * To restore (e.g. after reactivating a staff member):
 *   import { restoreUserSessions } from "@/lib/auth";
 *   await restoreUserSessions(userId);
 *
 * The denylist key expires automatically after REVOKE_TTL seconds
 * (matches session maxAge), so Redis never accumulates stale keys.
 */

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

// ── Extended user type returned by authorize() ────────────────────────────────
// NextAuth's built-in User only has id/name/email/image.
// We attach role and patientId here and read them back in the jwt callback.

interface AuthorizedUser {
  id:         string;
  name:       string;
  email:      string;
  role:       string;
  patientId?: string;
}

// ── Redis denylist helpers ────────────────────────────────────────────────────

const REVOKE_TTL = 8 * 60 * 60; // 8 hours — matches session maxAge

async function getRedis() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

/**
 * Returns true if the user's sessions have been revoked.
 * Falls back to false on Redis errors so auth is never broken by Redis downtime.
 */
async function isRevoked(userId: string): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return false; // dev without Redis
  try {
    const redis = await getRedis();
    const val = await redis.get(`revoked:${userId}`);
    return val !== null;
  } catch (err) {
    console.error("[Auth] Redis denylist check failed, allowing through:", err);
    return false;
  }
}

/**
 * Force-logout all sessions for a user by writing a Redis denylist key.
 * Takes effect on the user's next request (within seconds).
 *
 * Usage:
 *   await revokeUserSessions(staffId);
 */
export async function revokeUserSessions(userId: string): Promise<void> {
  const redis = await getRedis();
  await redis.set(`revoked:${userId}`, "1", { ex: REVOKE_TTL });
}

/**
 * Clear the denylist entry for a user (e.g. when reactivating their account).
 * After calling this the user can log in again immediately.
 */
export async function restoreUserSessions(userId: string): Promise<void> {
  const redis = await getRedis();
  await redis.del(`revoked:${userId}`);
}

// ── Auth options ──────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  // JWT strategy is required for CredentialsProvider in NextAuth v4.
  // Revocation is handled via the Redis denylist above.
  session: {
    strategy:  "jwt",
    maxAge:    8 * 60 * 60,  // 8 hours — session lifetime
    updateAge: 60 * 60,      // refresh JWT every 1 hour of activity
  },

  pages: { signIn: "/auth/login" },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<AuthorizedUser | null> {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          // ── Staff user ────────────────────────────────────────────────────
          const staffUser = await prisma.user.findUnique({
            where:  { email: credentials.email },
            select: {
              id:           true,
              name:         true,
              email:        true,
              role:         true,
              passwordHash: true,
              isActive:     true,
            },
          });

          if (staffUser) {
            if (!staffUser.isActive) return null;
            const valid = await bcrypt.compare(credentials.password, staffUser.passwordHash);
            if (!valid) return null;
            return {
              id:    staffUser.id,
              name:  staffUser.name,
              email: staffUser.email,
              role:  staffUser.role as string,
            };
          }

          // ── Patient user ──────────────────────────────────────────────────
          const patient = await prisma.patient.findFirst({
            where:  { email: credentials.email },
            select: {
              id:           true,
              name:         true,
              email:        true,
              passwordHash: true,
              isActive:     true,
            },
          });

          if (!patient || !patient.passwordHash || !patient.isActive) return null;

          const valid = await bcrypt.compare(credentials.password, patient.passwordHash);
          if (!valid) return null;

          return {
            id:        patient.id,
            name:      patient.name,
            email:     patient.email ?? "",
            role:      "PATIENT",
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
    async jwt({ token, user }) {
      // First sign-in: `user` is the AuthorizedUser returned by authorize().
      // Persist role and patientId into the JWT so they survive across requests.
      if (user) {
        const u       = user as AuthorizedUser;
        token.id      = u.id;
        token.role    = u.role;           // string — no undefined possible
        if (u.patientId) {
          token.patientId = u.patientId;
        }
      }

      // Every token refresh: check the Redis denylist.
      // token.id is typed as string (see src/types/next-auth.d.ts JWT augmentation).
      if (await isRevoked(token.id)) {
        // Returning null kills the session — NextAuth redirects to sign-in page.
        return null as unknown as typeof token;
      }

      return token;
    },

    async session({ session, token }) {
      // token fields are all typed via the JWT augmentation in next-auth.d.ts,
      // so no `as string` casts are needed here.
      session.user.id   = token.id;
      session.user.role = token.role;
      if (token.patientId) {
        session.user.patientId = token.patientId;
      }
      return session;
    },
  },
};