import { NextResponse } from "next/server";
import { formatPublicId } from "@/lib/options";
import { apiHandler, requireApiUser } from "@/server/http/api";
import { getOwnProfile } from "@/server/modules/profiles/service";

/** The signed-in member's own profile, including private sections. */
export const GET = apiHandler(async (req) => {
  const user = await requireApiUser(req);
  const p = await getOwnProfile(user.id);
  if (!p) return NextResponse.json({ profile: null });
  const { userId: _userId, documents, photos, ...rest } = p;
  return NextResponse.json({
    profile: {
      ...rest,
      publicId: formatPublicId(p.profileNumber),
      annualIncomeInr: p.annualIncomeInr?.toString() ?? null,
      photos: photos.map((ph) => ({ id: ph.id, isPrimary: ph.isPrimary, moderationStatus: ph.moderationStatus })),
      documents: documents.map((d) => ({ id: d.id, type: d.type, createdAt: d.createdAt })),
    },
  });
});
