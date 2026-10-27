import Link from "next/link";
import { NoteAction } from "@/components/admin/forms";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { reviewPhotoAction, reviewProfileAction } from "@/server/actions/admin";
import { requirePermission } from "@/server/modules/auth/current";
import { listPendingPhotos, listPendingProfiles } from "@/server/modules/moderation/service";

export default async function ModerationPage() {
  await requirePermission("moderation.manage");
  const [profiles, photos] = await Promise.all([listPendingProfiles(), listPendingPhotos()]);
  return (
    <>
      <PageHeader title="Moderation" subtitle="Review profiles and photos before they are shown to members." />
      <h2 className="text-maroon-800 text-lg font-semibold">Profiles ({profiles.length})</h2>
      {profiles.length === 0 ? (
        <EmptyState>No profiles waiting.</EmptyState>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap justify-between gap-4">
                <div className="max-w-xl min-w-0 text-sm">
                  <p className="font-semibold">
                    {p.publicId} · {p.displayName} <span className="text-muted">({p.user.email})</span>
                  </p>
                  <p className="text-muted">
                    {p.occupation} · {p.currentCity}, {p.currentCountry} · {p.kootam ?? "no kootam"} · {p.photos.length}{" "}
                    photos
                  </p>
                  {p.aboutMe && <p className="mt-2 whitespace-pre-line">{p.aboutMe}</p>}
                  {p.familyDetails && <p className="text-muted mt-2 whitespace-pre-line">{p.familyDetails}</p>}
                  <Link href={`/admin/members/${p.userId}`} className="text-maroon-700 mt-2 inline-block underline">
                    Member record
                  </Link>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-64">
                  <NoteAction
                    action={reviewProfileAction.bind(null, p.id, true)}
                    label="Approve & publish"
                    withNote={false}
                  />
                  <NoteAction
                    action={reviewProfileAction.bind(null, p.id, false)}
                    label="Request changes"
                    variant="danger"
                    notePlaceholder="What must change (required)"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <h2 className="text-maroon-800 text-lg font-semibold">Photos ({photos.length})</h2>
      {photos.length === 0 ? (
        <EmptyState>No photos waiting.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {photos.map((ph) => (
            <Card key={ph.id} className="p-3 sm:p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/media/photos/${ph.id}`} alt="" className="aspect-square w-full rounded-xl object-cover" />
              <p className="my-2 text-sm">
                {ph.publicId} · {ph.profile.displayName}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <NoteAction action={reviewPhotoAction.bind(null, ph.id, true)} label="Approve" withNote={false} />
                <NoteAction
                  action={reviewPhotoAction.bind(null, ph.id, false)}
                  label="Reject"
                  variant="danger"
                  notePlaceholder="Reason"
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
