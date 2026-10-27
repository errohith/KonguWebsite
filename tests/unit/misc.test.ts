import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en";
import ta from "@/i18n/messages/ta";
import { createTranslator, translateError } from "@/i18n/translate";
import { formatPublicId, parsePublicId } from "@/lib/options";
import { redact } from "@/server/lib/logger";
import { sniffFileType } from "@/server/modules/media/service";

function keys(o: object, prefix = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("i18n", () => {
  it("Tamil has exactly the English keys", () => {
    expect(keys(ta).sort()).toEqual(keys(en).sort());
  });
  it("interpolates and falls back", () => {
    const t = createTranslator("ta");
    expect(t("view.age", { age: 30 })).toBe("30 வயது");
    expect(t("does.not.exist")).toBe("does.not.exist");
    expect(translateError(t, "errors.unknownCode")).toBe(t("errors.generic"));
    expect(translateError(createTranslator("en"), "UNDERAGE", { minimumAge: 21 })).toContain("21");
  });
});

describe("helpers", () => {
  it("round-trips public profile ids", () => {
    expect(parsePublicId(formatPublicId(100123))).toBe(100123);
    expect(parsePublicId("km100123")).toBe(100123);
    expect(parsePublicId("100123")).toBeNull();
    expect(parsePublicId("KM1; DROP TABLE")).toBeNull();
  });
  it("redacts secrets in log context", () => {
    const out = redact({ email: "a@b.c", password: "p", nested: { apiKey: "k", authorization: "Bearer x" } }) as Record<
      string,
      unknown
    >;
    expect(JSON.stringify(out)).not.toMatch(/"p"|"k"|Bearer/);
    expect(out.email).toBe("a@b.c");
  });
  it("detects file types from content, not the declared type", () => {
    expect(sniffFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniffFileType(Buffer.from("%PDF-1.7"))?.ext).toBe("pdf");
    expect(sniffFileType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
  });
});
