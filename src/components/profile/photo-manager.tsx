"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/card";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { deletePhotoAction, setPrimaryPhotoAction, uploadPhotoAction } from "@/server/actions/profile";

type Photo = {
  id: string;
  isPrimary: boolean;
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED";
  moderationNote: string | null;
};

export function PhotoManager({ photos, max, maxMb }: { photos: Photo[]; max: number; maxMb: number }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      <p className="text-muted text-sm">{t("profile.photosIntro", { max, size: maxMb })}</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {photos.map((p) => (
          <figure key={p.id} className="border-line overflow-hidden rounded-2xl border bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/photos/${p.id}`} alt="" className="aspect-square w-full object-cover" />
            <figcaption className="space-y-2 p-3">
              <div className="flex flex-wrap gap-1">
                {p.isPrimary && <Badge tone="maroon">{t("profile.primary")}</Badge>}
                {p.moderationStatus === "PENDING" && <Badge tone="gold">{t("profile.pendingReview")}</Badge>}
                {p.moderationStatus === "REJECTED" && <Badge tone="red">{t("profile.rejected")}</Badge>}
              </div>
              {p.moderationNote && <p className="text-danger-600 text-xs">{p.moderationNote}</p>}
              <div className="flex flex-wrap gap-2 text-xs">
                {!p.isPrimary && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => start(() => setPrimaryPhotoAction(p.id))}
                    className="text-maroon-700 underline"
                  >
                    {t("profile.makePrimary")}
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => start(() => deletePhotoAction(p.id))}
                  className="text-danger-600 underline"
                >
                  {t("profile.delete")}
                </button>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
      {photos.length < max && (
        <ActionForm
          action={uploadPhotoAction}
          resetOnSuccess
          className="border-line rounded-2xl border border-dashed bg-white p-4"
        >
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            required
            className="file:bg-maroon-50 file:text-maroon-700 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:px-4 file:py-2"
          />
          <SubmitButton>{t("profile.upload")}</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
