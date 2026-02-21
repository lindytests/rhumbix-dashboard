import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_EMAILS = ["lindytests@gmail.com", "kha@lindy.ai"];
const ALLOWED_DOMAINS = ["rhumbix.com"];

function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (ALLOWED_EMAILS.includes(lower)) return true;
  const domain = lower.split("@")[1];
  return ALLOWED_DOMAINS.includes(domain);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    signIn({ user }) {
      return isAllowed(user.email);
    },
    authorized({ auth: session, request }) {
      const isLoggedIn = !!session?.user;
      const isOnDashboard = request.nextUrl.pathname.startsWith("/dashboard");
      if (isOnDashboard) return isLoggedIn;
      return true;
    },
  },
});
