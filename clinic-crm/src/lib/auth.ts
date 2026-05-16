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
        console.log("=== AUTH DEBUG ===");
        console.log("Email:", credentials?.email);
        console.log("Password length:", credentials?.password?.length);

        if (!credentials?.email || !credentials?.password) {
          console.log("FAIL: missing credentials");
          return null;
        }

        try {
          const staffUser = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          console.log("Staff found:", !!staffUser);

          if (staffUser) {
            console.log("Hash:", staffUser.passwordHash?.slice(0, 20));
            const valid = await bcrypt.compare(
              credentials.password,
              staffUser.passwordHash
            );
            console.log("Password valid:", valid);
            if (!valid) return null;
            return {
              id: staffUser.id,
              name: staffUser.name,
              email: staffUser.email,
              role: staffUser.role as string,
            };
          }

          const patient = await prisma.patient.findFirst({
            where: { email: credentials.email },
          });

          console.log("Patient found:", !!patient);
          if (!patient || !patient.passwordHash) return null;

          const valid = await bcrypt.compare(
            credentials.password,
            patient.passwordHash
          );
          console.log("Patient password valid:", valid);
          if (!valid) return null;

          return {
            id: patient.id,
            name: patient.name,
            email: patient.email ?? "",
            role: "PATIENT",
            patientId: patient.id,
          };
        } catch (err) {
          console.error("AUTH EXCEPTION:", err);
          return null;
        }
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