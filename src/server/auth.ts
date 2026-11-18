import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, accounts, sessions, verificationTokens } from "./db/schema";
import { sendEmail, magicLinkEmail } from "./email";

const providers: NextAuthConfig["providers"] = [];

// Email magic link. Uses Resend when AUTH_RESEND_KEY is set; otherwise logs the link to the server console (dev).
providers.push(
  Resend({
    apiKey: process.env.AUTH_RESEND_KEY || "dev",
    from: process.env.EMAIL_FROM || "crowdpick <onboarding@resend.dev>",
    async sendVerificationRequest({ identifier, url }) {
      await sendEmail({ to: identifier, ...magicLinkEmail(url) }, { devLog: `Magic sign-in link for ${identifier}: ${url}` });
    },
  }),
);

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google({ allowDangerousEmailAccountLinking: true }));
}

// Dev / demo login: sign in with just an email. NEVER enable in a real production deployment.
if (process.env.DEV_LOGIN === "true") {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(creds) {
        const email = String(creds?.email || "").trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email)) return null;
        let [u] = await db.select().from(users).where(eq(users.email, email));
        if (!u) [u] = await db.insert(users).values({ email, emailVerified: new Date() }).returning();
        return { id: u.id, email: u.email, name: u.name, image: u.image };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  trustHost: true,
  providers,
  pages: { signIn: "/signin", verifyRequest: "/signin?sent=1" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
});

export const enabledProviders = {
  google: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  dev: process.env.DEV_LOGIN === "true",
  emailConfigured: !!process.env.AUTH_RESEND_KEY,
};
