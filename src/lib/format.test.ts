import { describe, expect, it } from "vitest";
import { formatCandidateDate, toReadable } from "./format";

describe("toReadable", () => {
  it("日時を日本語形式でフォーマットする", () => {
    expect(toReadable("2026-04-23T10:00")).toBe("2026/04/23 10:00");
  });

  it("分が00のときもゼロ埋めされる", () => {
    expect(toReadable("2026-04-01T09:05")).toBe("2026/04/01 09:05");
  });
});

describe("formatCandidateDate", () => {
  it("月/日（曜日）HH:MM〜 形式でフォーマットする", () => {
    // 2026-04-23 は木曜日
    expect(formatCandidateDate("2026-04-23T10:00")).toBe("4/23（木）10:00〜");
  });

  it("月の先頭ゼロなし・時刻はゼロ埋め", () => {
    // 2026-04-01 は水曜日
    expect(formatCandidateDate("2026-04-01T09:05")).toBe("4/1（水）09:05〜");
  });
});
