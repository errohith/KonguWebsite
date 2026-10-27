import { NextResponse } from "next/server";
import { apiHandler, requireApiUser } from "@/server/http/api";
import { enforceRateLimit } from "@/server/lib/rate-limit";
import { exportUserData } from "@/server/modules/privacy/service";

export const GET = apiHandler(async (req) => {
  const user = await requireApiUser(req);
  await enforceRateLimit(`export:${user.id}`, 5, 3600);
  const data = await exportUserData(user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="kongu-matrimony-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
