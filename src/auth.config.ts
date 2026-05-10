import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/sign-in" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { id: string; role: string; focusArea?: string | null; clientId?: string | null };
        token.id = u.id;
        token.role = u.role;
        token.focusArea = u.focusArea ?? null;
        token.clientId = u.clientId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as
          | "CEO"
          | "OFFICE"
          | "FIELD"
          | "SUB"
          | "CLIENT";
        session.user.focusArea = (token.focusArea as string | null) ?? null;
        session.user.clientId = (token.clientId as string | null) ?? null;
      }
      return session;
    },
  },
};
