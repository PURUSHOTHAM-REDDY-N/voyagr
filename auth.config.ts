import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe subset of the Auth.js config - no providers here, since the
 * Credentials provider's authorize() needs Prisma + bcrypt, neither of which
 * run in the Edge Runtime that middleware.ts executes in. middleware.ts
 * builds its own lightweight NextAuth instance from just this config (it
 * only needs to read/verify the session JWT, never call authorize()); the
 * full instance in auth.ts spreads this and adds the real provider.
 */
export const authConfig = {
  pages: {
    signIn: "/sign-in",
  },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
