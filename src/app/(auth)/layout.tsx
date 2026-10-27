import { Container } from "@/components/ui/card";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="hero-bg">
      <Container className="flex justify-center py-12 sm:py-16">
        <div className="border-line w-full max-w-md rounded-3xl border bg-white p-6 shadow-sm sm:p-8">{children}</div>
      </Container>
    </div>
  );
}
