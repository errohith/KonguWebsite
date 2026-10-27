import { NextResponse } from "next/server";
import { apiHandler, requireApiUser } from "@/server/http/api";
import { getProfileForViewer } from "@/server/modules/profiles/service";

type Ctx = { params: Promise<{ publicId: string }> };

/** Another member's profile, filtered to what the viewer may see. */
export const GET = apiHandler<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(req, { active: true });
  const { publicId } = await ctx.params;
  // targetProfileId is internal and intentionally omitted.
  const { targetProfileId: _internal, ...view } = await getProfileForViewer(user, publicId.toUpperCase());
  return NextResponse.json(view);
});
