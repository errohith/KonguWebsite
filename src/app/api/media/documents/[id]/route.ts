import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, getApiUser } from "@/server/http/api";
import { AppError } from "@/server/lib/errors";
import { readDocument } from "@/server/modules/media/service";

/** Verification documents: owner and moderators only; always downloaded, never cached. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) throw new AppError("NOT_FOUND");
    const { data, mimeType } = await readDocument(await getApiUser(req), id);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `attachment; filename="document-${id.slice(0, 8)}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
