import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import { users, accounts, sessions, verificationTokens } from "./db/schema";
import { sendEmail, magicLinkEmail } from "./email";
import { verifySigninCode } from "./services/signin-code";

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

class CodeError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

// Email + 6-digit code (the main way to sign in / sign up). Codes come from POST /api/signin-code.
providers.push(
  Credentials({
    id: "code",
    name: "Email code",
    credentials: { email: { label: "Email", type: "email" }, code: { label: "Code", type: "text" } },
    async authorize(creds) {
      const r = await verifySigninCode(String(creds?.email || ""), String(creds?.code || ""));
      if ("error" in r) throw new CodeError(r.error);
      return { id: r.user.id, email: r.user.email, name: r.user.name, image: r.user.image };
    },
  }),
);

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google({ allowDangerousEmailAccountLinking: true }));
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
  emailConfigured: !!process.env.AUTH_RESEND_KEY,
};
