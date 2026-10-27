import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, getApiUser } from "@/server/http/api";
import { AppError } from "@/server/lib/errors";
import { readPhotoForViewer } from "@/server/modules/media/service";

/** Authorised photo delivery. Responses are private to the viewer's browser. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) throw new AppError("NOT_FOUND");
    const { data, mimeType } = await readPhotoForViewer(await getApiUser(req), id);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
