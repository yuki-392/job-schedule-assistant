import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalStorage } from "./useLocalStorage";

// happy-dom の localStorage はファイルパス設定なしだと動作しないため、インメモリモックで差し替える
let store: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = value; },
  removeItem: (key) => { delete store[key]; },
  clear: () => { store = {}; },
  get length() { return Object.keys(store).length; },
  key: (index) => Object.keys(store)[index] ?? null,
};

beforeEach(() => {
  store = {};
  vi.stubGlobal("localStorage", localStorageMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useLocalStorage", () => {
  describe("初期値", () => {
    it("localStorageに値がなければinitialValueを使う", async () => {
      const { result } = renderHook(() => useLocalStorage("key", "hello"));
      await act(async () => {});
      expect(result.current[0]).toBe("hello");
    });

    it("localStorageに保存済みの値があれば復元する", async () => {
      store["key"] = JSON.stringify("restored");
      const { result } = renderHook(() => useLocalStorage("key", "default"));
      await act(async () => {});
      expect(result.current[0]).toBe("restored");
    });

    it("配列の初期値も正しく復元できる", async () => {
      const saved = [{ id: "1", name: "test" }];
      store["arr"] = JSON.stringify(saved);
      const { result } = renderHook(() => useLocalStorage<typeof saved>("arr", []));
      await act(async () => {});
      expect(result.current[0]).toEqual(saved);
    });
  });

  describe("値の保存", () => {
    it("setValueするとlocalStorageに書き込まれる", async () => {
      const { result } = renderHook(() => useLocalStorage("key", "initial"));
      await act(async () => {
        result.current[1]("updated");
      });
      expect(store["key"]).toBe(JSON.stringify("updated"));
    });

    it("オブジェクトを保存してから復元できる", async () => {
      const { result } = renderHook(() =>
        useLocalStorage<{ name: string }>("obj", { name: "" }),
      );
      await act(async () => {
        result.current[1]({ name: "テスト企業" });
      });
      expect(store["obj"]).toBe(JSON.stringify({ name: "テスト企業" }));
    });
  });

  describe("エラー耐性", () => {
    it("localStorageの値が不正なJSONでもクラッシュせずinitialValueを使う", async () => {
      store["bad"] = "not-json{{{";
      const { result } = renderHook(() => useLocalStorage("bad", "fallback"));
      await act(async () => {});
      expect(result.current[0]).toBe("fallback");
    });
  });

  describe("ハイドレーション", () => {
    it("エフェクト実行後はisHydratedがtrue", async () => {
      const { result } = renderHook(() => useLocalStorage("key", "v"));
      await act(async () => {});
      expect(result.current[2]).toBe(true);
    });

    it("ハイドレーション前は保存済みデータをlocalStorageに上書きしない", async () => {
      store["key"] = JSON.stringify("saved");
      renderHook(() => useLocalStorage("key", "initial"));
      // エフェクトが走る前（同期タイミング）では書き込まれない
      expect(store["key"]).toBe(JSON.stringify("saved"));
    });

    it("ハイドレーション後にsetValueすると正しくlocalStorageに書き込まれる", async () => {
      store["key"] = JSON.stringify("saved");
      const { result } = renderHook(() => useLocalStorage("key", "initial"));
      await act(async () => {});
      await act(async () => { result.current[1]("new-value"); });
      expect(store["key"]).toBe(JSON.stringify("new-value"));
    });
  });
});

describe("カレンダー未連携シナリオ（isCalendarSynced の導出）", () => {
  it("カレンダーイベントが保存されていなければisCalendarSyncedはfalse", async () => {
    const { result } = renderHook(() => useLocalStorage<unknown[]>("jsa:calendarEvents", []));
    await act(async () => {});
    expect(result.current[0].length > 0).toBe(false);
  });

  it("カレンダーイベントが保存済みのときisCalendarSyncedはtrue", async () => {
    const events = [{ id: "1", title: "ゼミ", start: "2026-04-24T10:00", end: "2026-04-24T11:30" }];
    store["jsa:calendarEvents"] = JSON.stringify(events);
    const { result } = renderHook(() => useLocalStorage<unknown[]>("jsa:calendarEvents", []));
    await act(async () => {});
    expect(result.current[0].length > 0).toBe(true);
  });
});
