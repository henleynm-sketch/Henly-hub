import NextAuth, { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { ensureOrganization } from "@/lib/auth-org";
import { PENDING_ROLE, type Role } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      focusArea?: string | null;
      clientId?: string | null;
    } & DefaultSession["user"];
  }
}

// Self-provisioning (email registration + brand-new SSO accounts) is limited to
// the company domain; everyone else still needs an invite.
const COMPANY_DOMAIN = "henleycontracting.com";

// SSO providers are added only when their credentials are present in .env, so a
// missing key never crashes the app. The buttons still render and fail with a
// clear message — see src/lib/actions/oauth.ts.
const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Email + password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(creds) {
      const email = String(creds?.email || "").toLowerCase().trim();
      const password = String(creds?.password || "");
      if (!email || !password) return null;
      const user = await prisma.user.findUnique({ where: { email } });
      // SSO-only accounts have an empty passwordHash — never match on credentials.
      if (!user || !user.passwordHash) return null;
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return null;
      // lastLoginAt is best-effort — never blocks sign-in.
      void prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as Role,
        focusArea: user.focusArea,
        clientId: user.clientId,
      };
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}
if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
  providers.push(MicrosoftEntraID);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    // OAuth sign-in gate. Existing users (any domain) are linked by email and
    // signed in; brand-new SSO users must be on the company domain and are
    // created PENDING (zero access until the CEO assigns a role). Credentials
    // sign-in is fully handled by authorize() above.
    async signIn({ user, account }) {
      if (!account || account.provider === "credentials") return true;
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return existing.active;
      if (email.split("@")[1] !== COMPANY_DOMAIN) return false;
      const org = await ensureOrganization();
      await prisma.user.create({
        data: {
          email,
          name: user.name ?? email.split("@")[0],
          passwordHash: "",
          role: PENDING_ROLE,
          organizationId: org.id,
        },
      });
      return true;
    },
    // Carry OUR db user's id/role into the JWT. Credentials users already arrive
    // in that shape; OAuth users are looked up by email.
    async jwt({ token, user, account }) {
      if (user) {
        if (account && account.provider !== "credentials") {
          const dbUser = user.email
            ? await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } })
            : null;
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
            token.focusArea = dbUser.focusArea ?? null;
            token.clientId = dbUser.clientId ?? null;
          }
        } else {
          const u = user as { id: string; role: string; focusArea?: string | null; clientId?: string | null };
          token.id = u.id;
          token.role = u.role;
          token.focusArea = u.focusArea ?? null;
          token.clientId = u.clientId ?? null;
        }
      }
      return token;
    },
  },
});
