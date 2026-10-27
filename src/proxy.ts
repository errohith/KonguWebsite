import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every page request:
 * - generates a per-request CSP nonce (strict, nonce-based script policy);
 * - forwards the pathname so server code can build "return to" links.
 *
 * Kept self-contained (reads process.env directly) per the Proxy guidance.
 * Payment-provider origins are added only when payments are enabled.
 */
function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const paymentsOn = process.env.ENABLE_PAYMENTS === "true";
  const paymentOrigins = paymentsOn
    ? [originOf(process.env.PAYMENT_CHECKOUT_SCRIPT_URL), originOf(process.env.PAYMENT_API_BASE_URL)].filter(
        (o): o is string => !!o,
      )
    : [];
  const cdn = originOf(process.env.CDN_BASE_URL);
  const extra = (list: (string | null)[]) => list.filter(Boolean).join(" ");

  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""} ${extra(paymentOrigins)}`,
    // Next.js injects inline <style> (fonts, dev CSS) without a nonce. Scripts
    // stay nonce-locked, which is what blocks XSS; inline CSS is lower risk.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: ${extra([cdn])}`,
    `font-src 'self'`,
    `connect-src 'self' ${extra(paymentOrigins)}`,
    `frame-src ${paymentOrigins.length ? paymentOrigins.join(" ") : "'none'"}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ]
    .map((d) => d.trim())
    .join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-pathname", request.nextUrl.pathname + request.nextUrl.search);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (process.env.APP_URL?.startsWith("https://")) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
