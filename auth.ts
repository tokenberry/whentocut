import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/db";

/**
 * Auth.js (NextAuth v5) configuration.
 * - Google OAuth (reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET from env)
 * - Email magic link via Resend (reads AUTH_RESEND_KEY from env)
 * - Database sessions backed by Postgres via the Prisma adapter.
 *
 * Env required in production: AUTH_SECRET, DATABASE_URL, AUTH_GOOGLE_ID/SECRET,
 * AUTH_RESEND_KEY, AUTH_EMAIL_FROM, and AUTH_URL (or AUTH_TRUST_HOST=true).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    // Both providers are optional — each is enabled only once its env vars are set, so
    // the app can launch with Google alone (and add email magic-link later, or vice versa).
    ...(process.env.AUTH_GOOGLE_ID ? [Google] : []),
    ...(process.env.AUTH_RESEND_KEY
      ? [Resend({ from: process.env.AUTH_EMAIL_FROM ?? "login@whentocut.com" })]
      : []),
  ],
  pages: { signIn: "/signin" },
  callbacks: {
    session({ session, user }) {
      // Expose the user id + plan to the app (database-session shape).
      session.user.id = user.id;
      session.user.plan = (user as { plan?: "FREE" | "PRO" }).plan ?? "FREE";
      return session;
    },
  },
});
