import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { dispatchGithubSync, githubSyncConfigured } from "@/lib/github-sync";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  await query(
    `INSERT INTO ops.sync_job (origem, status) VALUES ('cron', 'queued')`
  ).catch(() => null);

  if (!githubSyncConfigured()) {
    return NextResponse.json({
      ok: false,
      error: "SYNC_GITHUB_TOKEN ausente. O workflow agendado no GitHub ainda pode rodar sozinho.",
    });
  }

  const dispatched = await dispatchGithubSync("");
  if (!dispatched.ok) {
    return NextResponse.json({ ok: false, error: dispatched.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, dispatched: true });
}
