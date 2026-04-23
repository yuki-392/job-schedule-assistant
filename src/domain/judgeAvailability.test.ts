import { describe, expect, it } from "vitest";
import { judgeAvailability, judgeRangeAvailability, type CalendarEvent } from "./judgeAvailability";

const event = (id: string, start: string, end: string): CalendarEvent => ({ id, title: "予定", start, end });

describe("judgeAvailability", () => {
  describe("候補日が空の場合", () => {
    it("空配列を返す", () => {
      const result = judgeAvailability([], []);
      expect(result.availableDates).toEqual([]);
      expect(result.unavailableDates).toEqual([]);
    });
  });

  describe("カレンダー予定がない場合", () => {
    it("全候補が空き判定になる", () => {
      const candidates = ["2026-04-24T10:00", "2026-04-25T14:00"];
      const result = judgeAvailability(candidates, []);
      expect(result.availableDates).toEqual(candidates);
      expect(result.unavailableDates).toHaveLength(0);
    });
  });

  describe("予定と重複する場合", () => {
    it("候補が予定の時間帯と完全に重なる場合はNG", () => {
      const candidates = ["2026-04-24T10:00"];
      const events = [event("1", "2026-04-24T09:00", "2026-04-24T12:00")];
      const result = judgeAvailability(candidates, events);
      expect(result.availableDates).toHaveLength(0);
      expect(result.unavailableDates).toHaveLength(1);
      expect(result.unavailableDates[0].reason).toBe("calendar_conflict");
      expect(result.unavailableDates[0].conflictEventId).toBe("1");
    });

    it("候補開始が予定終了と同時刻の場合は重複しない（隣接はOK）", () => {
      const candidates = ["2026-04-24T12:00"];
      const events = [event("1", "2026-04-24T10:00", "2026-04-24T12:00")];
      const result = judgeAvailability(candidates, events);
      expect(result.availableDates).toEqual(candidates);
      expect(result.unavailableDates).toHaveLength(0);
    });

    it("候補終了が予定開始と同時刻の場合は重複しない（隣接はOK）", () => {
      // 候補 10:00〜11:00、予定 11:00〜12:00 → 隣接のみ
      const candidates = ["2026-04-24T10:00"];
      const events = [event("1", "2026-04-24T11:00", "2026-04-24T12:00")];
      const result = judgeAvailability(candidates, events, 60);
      expect(result.availableDates).toEqual(candidates);
      expect(result.unavailableDates).toHaveLength(0);
    });

    it("面接時間が予定にかかる場合はNG", () => {
      // 候補 10:30〜11:30（60分）、予定 11:00〜12:00 → 重複
      const candidates = ["2026-04-24T10:30"];
      const events = [event("1", "2026-04-24T11:00", "2026-04-24T12:00")];
      const result = judgeAvailability(candidates, events, 60);
      expect(result.availableDates).toHaveLength(0);
      expect(result.unavailableDates).toHaveLength(1);
    });
  });

  describe("複数候補が混在する場合", () => {
    it("空きとNGが正しく分類される", () => {
      const candidates = [
        "2026-04-23T10:00", // NG: ゼミと重複
        "2026-04-24T19:00", // OK: 予定なし
        "2026-04-25T13:00", // NG: 別予定と重複
      ];
      const events = [
        event("ev1", "2026-04-23T10:00", "2026-04-23T11:30"),
        event("ev2", "2026-04-25T12:00", "2026-04-25T14:00"),
      ];
      const result = judgeAvailability(candidates, events);
      expect(result.availableDates).toEqual(["2026-04-24T19:00"]);
      expect(result.unavailableDates).toHaveLength(2);
    });

    it("同一候補日が複数ある場合でも正しく処理される", () => {
      const candidates = ["2026-04-24T10:00", "2026-04-24T10:00"];
      const result = judgeAvailability(candidates, []);
      // 重複排除はしない（入力の責務）ので2件とも available
      expect(result.availableDates).toHaveLength(2);
    });
  });

  describe("不正な日時が含まれる場合", () => {
    it("不正な日時はinvalid_datetimeとしてNG扱いになる", () => {
      const candidates = ["不正な日時", "2026-04-24T10:00"];
      const result = judgeAvailability(candidates, []);
      expect(result.availableDates).toEqual(["2026-04-24T10:00"]);
      expect(result.unavailableDates).toHaveLength(1);
      expect(result.unavailableDates[0].reason).toBe("invalid_datetime");
    });
  });

  describe("面接時間（interviewDurationMinutes）のデフォルト値", () => {
    it("デフォルト60分で判定される", () => {
      // 候補 10:00〜11:00、予定 10:30〜12:00 → 重複
      const candidates = ["2026-04-24T10:00"];
      const events = [event("1", "2026-04-24T10:30", "2026-04-24T12:00")];
      const result = judgeAvailability(candidates, events);
      expect(result.availableDates).toHaveLength(0);
    });

    it("面接時間を30分に変更すると判定が変わる", () => {
      // 候補 10:00〜10:30、予定 10:30〜12:00 → 隣接のみでOK
      const candidates = ["2026-04-24T10:00"];
      const events = [event("1", "2026-04-24T10:30", "2026-04-24T12:00")];
      const result = judgeAvailability(candidates, events, 30);
      expect(result.availableDates).toEqual(candidates);
    });
  });
});

describe("judgeRangeAvailability", () => {
  describe("カレンダー予定がない場合", () => {
    it("範囲全体が空きになる", () => {
      const result = judgeRangeAvailability("2026-04-24T10:00", "2026-04-24T18:00", []);
      expect(result.availableRanges).toHaveLength(1);
      expect(result.blockedRanges).toHaveLength(0);
    });
  });

  describe("範囲の中央に予定がある場合", () => {
    it("予定の前後1時間が除外され、2つの空き時間帯に分割される", () => {
      // 範囲: 10:00~18:00、予定: 13:00~14:00 → 除外: 12:00~15:00 → 空き: 10:00~12:00, 15:00~18:00
      const events = [event("1", "2026-04-24T13:00", "2026-04-24T14:00")];
      const result = judgeRangeAvailability("2026-04-24T10:00", "2026-04-24T18:00", events);
      expect(result.availableRanges).toHaveLength(2);
      expect(result.blockedRanges).toHaveLength(1);
    });

    it("除外区間の開始は予定開始 - 1時間", () => {
      const events = [event("1", "2026-04-24T13:00", "2026-04-24T14:00")];
      const result = judgeRangeAvailability("2026-04-24T10:00", "2026-04-24T18:00", events);
      const blocked = result.blockedRanges[0];
      expect(new Date(blocked.start).getHours()).toBe(12);
      expect(new Date(blocked.end).getHours()).toBe(15);
    });
  });

  describe("予定が範囲の端に接している場合", () => {
    it("予定が範囲開始付近にある場合、バッファが範囲内に収まる", () => {
      // 範囲: 10:00~18:00、予定: 10:30~11:30 → 除外: 10:00~12:30（下限クランプ）→ 空き: 12:30~18:00
      const events = [event("1", "2026-04-24T10:30", "2026-04-24T11:30")];
      const result = judgeRangeAvailability("2026-04-24T10:00", "2026-04-24T18:00", events);
      expect(result.availableRanges).toHaveLength(1);
      const start = new Date(result.availableRanges[0].start);
      expect(start.getHours()).toBe(12);
      expect(start.getMinutes()).toBe(30);
    });

    it("予定が範囲外にある場合は除外されない", () => {
      const events = [event("1", "2026-04-24T20:00", "2026-04-24T21:00")];
      const result = judgeRangeAvailability("2026-04-24T10:00", "2026-04-24T18:00", events);
      expect(result.availableRanges).toHaveLength(1);
      expect(result.blockedRanges).toHaveLength(0);
    });
  });

  describe("複数の予定がある場合", () => {
    it("隣接する除外区間はマージされる", () => {
      // 予定A: 12:00~13:00（除外: 11:00~14:00）、予定B: 14:00~15:00（除外: 13:00~16:00）
      // マージ後除外: 11:00~16:00 → 空き: 10:00~11:00, 16:00~18:00
      const events = [
        event("A", "2026-04-24T12:00", "2026-04-24T13:00"),
        event("B", "2026-04-24T14:00", "2026-04-24T15:00"),
      ];
      const result = judgeRangeAvailability("2026-04-24T10:00", "2026-04-24T18:00", events);
      expect(result.blockedRanges).toHaveLength(1);
      expect(result.availableRanges).toHaveLength(2);
    });
  });

  describe("予定が範囲全体をカバーする場合", () => {
    it("空き時間帯が0件になる", () => {
      const events = [event("1", "2026-04-24T10:00", "2026-04-24T18:00")];
      const result = judgeRangeAvailability("2026-04-24T10:00", "2026-04-24T18:00", events);
      expect(result.availableRanges).toHaveLength(0);
    });
  });

  describe("不正な入力", () => {
    it("開始 >= 終了の場合は空を返す", () => {
      const result = judgeRangeAvailability("2026-04-24T18:00", "2026-04-24T10:00", []);
      expect(result.availableRanges).toHaveLength(0);
      expect(result.blockedRanges).toHaveLength(0);
    });

    it("bufferMinutesを変更できる", () => {
      // バッファ30分、予定: 13:00~14:00 → 除外: 12:30~14:30
      const events = [event("1", "2026-04-24T13:00", "2026-04-24T14:00")];
      const result = judgeRangeAvailability("2026-04-24T10:00", "2026-04-24T18:00", events, 30);
      const blocked = result.blockedRanges[0];
      expect(new Date(blocked.start).getMinutes()).toBe(30);
      expect(new Date(blocked.end).getMinutes()).toBe(30);
    });
  });
});
