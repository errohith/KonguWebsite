import Link from "next/link";
import { Pagination } from "@/components/profile/profile-card";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { createTranslator } from "@/i18n/translate";
import { requirePermission } from "@/server/modules/auth/current";
import { searchMembers } from "@/server/modules/admin/service";

export default async function AdminMembers({ searchParams }: PageProps<"/admin/members">) {
  await requirePermission("members.view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const result = await searchMembers(q, page);
  return (
    <>
      <PageHeader title="Members" subtitle={`${result.total} accounts`} />
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Email, phone or KM ID"
          className="border-line w-full max-w-sm rounded-xl border px-3 py-2 text-sm"
        />
        <button className="bg-maroon-700 rounded-full px-4 text-sm text-white">Search</button>
      </form>
      <Card className="overflow-x-auto p-0 sm:p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-sand text-muted text-xs uppercase">
            <tr>
              <th className="p-3">Member</th>
              <th className="p-3">Profile</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {result.users.map((u) => (
              <tr key={u.id}>
                <td className="p-3">
                  <Link href={`/admin/members/${u.id}`} className="text-maroon-700 font-medium hover:underline">
                    {u.email}
                  </Link>
                </td>
                <td className="p-3">
                  {u.publicId ? `${u.publicId} · ${u.profile?.displayName}` : "—"}
                  {u.profile && (
                    <span className="ml-2">
                      <Badge>{u.profile.status}</Badge>
                    </span>
                  )}
                </td>
                <td className="p-3">{u.role}</td>
                <td className="p-3">
                  <Badge tone={u.status === "ACTIVE" ? "green" : u.status === "SUSPENDED" ? "red" : "neutral"}>
                    {u.status}
                  </Badge>
                </td>
                <td className="text-muted p-3">{u.createdAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Pagination
        page={page}
        pageCount={result.pageCount}
        hrefFor={(p) => `/admin/members?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
        t={createTranslator("en")}
      />
    </>
  );
}
