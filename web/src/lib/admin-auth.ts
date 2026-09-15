import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Papel } from "@/auth.config";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.papel !== "admin") redirect("/");
  return session;
}

export async function currentPapel(): Promise<Papel | null> {
  const session = await auth();
  return session?.user?.papel ?? null;
}
