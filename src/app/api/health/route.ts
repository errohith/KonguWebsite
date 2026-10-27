import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/server/db/health";

/** Liveness + database connectivity. Never includes connection details. */
export async function GET() {
  const database = await checkDatabaseHealth();
  return NextResponse.json(
    { status: database.ok ? "ok" : "degraded", database, time: new Date().toISOString() },
    { status: database.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
