import Link from "next/link";

export function Logo({ name }: { name: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={name}>
      <svg viewBox="0 0 40 40" className="size-9" aria-hidden>
        <circle cx="20" cy="20" r="19" fill="#7a1f2b" />
        <path d="M20 8c3.5 4 6 7.4 6 11a6 6 0 0 1-12 0c0-3.6 2.5-7 6-11z" fill="#d9a843" />
        <circle cx="20" cy="29" r="2.2" fill="#d9a843" />
      </svg>
      <span className="font-display text-maroon-800 hidden text-lg leading-tight font-semibold sm:inline">{name}</span>
    </Link>
  );
}
