import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFilterOptions } from "@/lib/dash";
import { resolveTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const empresa = new URL(req.url).searchParams.get("empresa");
  const tenant = await resolveTenant(session, empresa);
  const dims = await getFilterOptions({ appKeys: tenant.selectedKeys });
  return NextResponse.json(dims, {
    headers: {
      "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
    },
  });
}
