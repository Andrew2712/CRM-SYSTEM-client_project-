import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
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

        // ── 1. Check staff (User) table first ──────────────────────────────
        const staffUser = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (staffUser) {
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

        // ── 2. Check patient table ──────────────────────────────────────────
        const patient = await prisma.patient.findFirst({
          where: { email: credentials.email },
        });

        if (!patient) return null;
        if (!patient.passwordHash) return null;

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
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        if ((user as any).patientId) {
          token.patientId = (user as any).patientId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        if (token.patientId) {
          (session.user as any).patientId = token.patientId as string;
        }
      }
      return session;
    },
  },
};
