import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: string;
    patientId?: string;
  }
  interface Session {
    user: {
      id: string;
      role: string;
      patientId?: string;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    patientId?: string;
  }
}