import { NoteAction } from "@/components/admin/forms";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { reviewVerificationAction } from "@/server/actions/admin";
import { requirePermission } from "@/server/modules/auth/current";
import { listPendingVerifications } from "@/server/modules/moderation/service";

export default async function VerificationsPage() {
  await requirePermission("moderation.manage");
  const requests = await listPendingVerifications();
  return (
    <>
      <PageHeader
        title="Verification requests"
        subtitle="Compare the document with the profile's name and date of birth. Documents are never shown to members."
      />
      {requests.length === 0 ? (
        <EmptyState>No pending requests.</EmptyState>
      ) : (
        requests.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap justify-between gap-4 text-sm">
              <div>
                <p className="font-semibold">
                  {r.publicId} · {r.profile.displayName}
                </p>
                <p className="text-muted">
                  DOB {r.profile.dateOfBirth.toISOString().slice(0, 10)} · submitted{" "}
                  {r.createdAt.toISOString().slice(0, 10)}
                </p>
                {r.note && <p className="mt-1">Member note: {r.note}</p>}
                {r.document && (
                  <a
                    href={`/api/media/documents/${r.document.id}`}
                    className="text-maroon-700 mt-2 inline-block underline"
                  >
                    Download {r.document.type} ({r.document.mimeType})
                  </a>
                )}
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-64">
                <NoteAction action={reviewVerificationAction.bind(null, r.id, true)} label="Approve" withNote={false} />
                <NoteAction
                  action={reviewVerificationAction.bind(null, r.id, false)}
                  label="Reject"
                  variant="danger"
                  notePlaceholder="Reason (shown to member)"
                />
              </div>
            </div>
          </Card>
        ))
      )}
    </>
  );
}
