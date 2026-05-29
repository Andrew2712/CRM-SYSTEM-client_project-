import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
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
          // ── Staff user ──────────────────────────────────────────────────
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

          // ── Patient user ────────────────────────────────────────────────
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        if (user.patientId) token.patientId = user.patientId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      if (token.patientId) session.user.patientId = token.patientId;
      return session;
    },
  },
};