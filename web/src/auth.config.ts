import type { NextAuthConfig } from "next-auth";

export type Papel = "desenvolvedor" | "admin" | "interno" | "cliente";

// Desenvolvedor tem tudo do admin e ainda vê as ferramentas internas (Qualidade & Sync).
export function podeAdministrar(papel?: string | null): boolean {
  return papel === "admin" || papel === "desenvolvedor";
}

if (!process.env.AUTH_SECRET && process.env.NODE_ENV !== "production") {
  process.env.AUTH_SECRET = "costa-novaes-bi-dev-secret-change-me";
}

declare module "next-auth" {
  interface User {
    papel: Papel;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      papel: Papel;
    };
  }
}

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.papel = user.papel;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id || "");
        session.user.papel = (token.papel as Papel) || "cliente";
      }
      return session;
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const next = new URL(url);
        const base = new URL(baseUrl);
        if (next.origin === base.origin) return url;
      } catch {
        /* ignore */
      }
      return baseUrl;
    },
  },
} satisfies NextAuthConfig;
