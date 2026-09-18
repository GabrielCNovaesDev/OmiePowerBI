import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { query } from "@/lib/db";
import type { Papel } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        try {
          const rows = await query<{
            id: string;
            nome: string;
            email: string;
            senha_hash: string;
            papel: string;
            ativo: boolean;
          }>(
            `SELECT id::text, nome, email, senha_hash, papel::text AS papel, ativo
             FROM auth.usuario
             WHERE email = $1`,
            [email]
          );
          const user = rows[0];
          if (!user || !user.ativo) return null;
          const valid = await bcrypt.compare(password, user.senha_hash);
          if (!valid) return null;

          await query(`UPDATE auth.usuario SET last_login_at = NOW() WHERE id = $1`, [user.id]).catch((err) => {
            console.error("AUTH_LAST_LOGIN", err instanceof Error ? err.message : err);
          });
          return {
            id: user.id,
            name: user.nome,
            email: user.email,
            papel: user.papel as Papel,
          };
        } catch (err) {
          console.error("AUTH_ERROR", err instanceof Error ? err.message : err);
          return null;
        }
      },
    }),
  ],
});
