import { cn } from "./cn";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("border-line rounded-2xl border bg-white p-5 shadow-sm sm:p-6", className)}>
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-maroon-800 text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle && <p className="text-muted mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

const BADGE = {
  neutral: "bg-sand text-ink",
  gold: "bg-gold-100 text-gold-700",
  maroon: "bg-maroon-50 text-maroon-700",
  green: "bg-leaf-50 text-leaf-600",
  red: "bg-danger-50 text-danger-600",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof BADGE; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", BADGE[tone])}>
      {children}
    </span>
  );
}

const ALERT = {
  info: "border-gold-400/50 bg-gold-100/60 text-ink",
  success: "border-leaf-600/30 bg-leaf-50 text-leaf-600",
  error: "border-danger-600/30 bg-danger-50 text-danger-600",
} as const;

export function Alert({ tone = "info", children }: { tone?: keyof typeof ALERT; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-xl border px-4 py-3 text-sm", ALERT[tone])}
    >
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-line text-muted rounded-2xl border border-dashed bg-white/60 p-10 text-center">
      {children}
    </div>
  );
}
