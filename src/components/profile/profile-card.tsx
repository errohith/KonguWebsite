import Link from "next/link";
import type { Translator } from "@/i18n/translate";
import { Badge } from "@/components/ui/card";
import type { ProfileCard as Card } from "@/server/modules/discovery/service";

export function ProfileCard({ card, t, footer }: { card: Card; t: Translator; footer?: React.ReactNode }) {
  const place = [card.currentCity, card.currentState, card.currentCountry !== "IN" ? card.currentCountry : null]
    .filter(Boolean)
    .join(", ");
  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${card.highlighted ? "border-gold-400 ring-gold-400/50 ring-1" : "border-line"}`}
    >
      <Link href={`/profiles/${card.publicId}`} className="block">
        <div className="bg-sand relative aspect-[4/3]">
          {card.primaryPhotoId ? (
            // Served through an authorised route; not optimised by next/image on purpose.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/media/photos/${card.primaryPhotoId}`}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="text-muted grid size-full place-items-center text-sm">{t("view.noPhoto")}</div>
          )}
          {card.verified && (
            <span className="absolute top-3 left-3">
              <Badge tone="green">✓ {t("view.verified")}</Badge>
            </span>
          )}
        </div>
        <div className="space-y-1 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-maroon-800 truncate font-semibold">{card.displayName}</h3>
            <span className="text-muted shrink-0 text-xs">{card.publicId}</span>
          </div>
          <p className="text-sm">
            {t("view.age", { age: card.age })}
            {card.heightCm ? ` · ${t("common.cm", { value: card.heightCm })}` : ""}
            {card.kootam ? ` · ${card.kootam}` : ""}
          </p>
          <p className="text-muted truncate text-sm">
            {[card.highestEducation ? t(`enums.EducationLevel.${card.highestEducation}`) : null, card.occupation]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {place && <p className="text-muted truncate text-sm">{place}</p>}
        </div>
      </Link>
      {footer && <div className="border-line border-t px-4 py-3">{footer}</div>}
    </article>
  );
}

export function Pagination({
  page,
  pageCount,
  hrefFor,
  t,
}: {
  page: number;
  pageCount: number;
  hrefFor: (p: number) => string;
  t: Translator;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
      {page > 1 ? (
        <Link className="border-line hover:bg-sand rounded-full border bg-white px-4 py-2" href={hrefFor(page - 1)}>
          {t("search.prev")}
        </Link>
      ) : null}
      <span className="text-muted">{t("search.page", { page, count: pageCount })}</span>
      {page < pageCount ? (
        <Link className="border-line hover:bg-sand rounded-full border bg-white px-4 py-2" href={hrefFor(page + 1)}>
          {t("search.next")}
        </Link>
      ) : null}
    </nav>
  );
}
