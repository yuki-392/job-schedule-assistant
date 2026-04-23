"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { formatRangeDate, toReadableRange } from "@/lib/format";
import { rangeKey, type AvailableRange, type BlockedRange, type CandidateDate } from "@/domain/judgeAvailability";

type Props = {
  companyName: string;
  onCompanyNameChange: (value: string) => void;
  candidateDates: CandidateDate[];
  onAddDate: (startDateTime: string, endDateTime: string) => void;
  onRemoveDate: (id: string) => void;
  onJudge: () => void;
  hasJudgeResult: boolean;
  isCalendarSynced: boolean;
  availableRanges: AvailableRange[];
  blockedRanges: BlockedRange[];
  recommendedRangeKey: string | null;
  activeSelectedRangeKeys: string[];
  onToggleRange: (key: string) => void;
  isNgExpanded: boolean;
  onToggleNgExpanded: () => void;
  onScrollToMail: () => void;
};

export function CandidateDateSection({
  companyName,
  onCompanyNameChange,
  candidateDates,
  onAddDate,
  onRemoveDate,
  onJudge,
  hasJudgeResult,
  isCalendarSynced,
  availableRanges,
  blockedRanges,
  recommendedRangeKey,
  activeSelectedRangeKeys,
  onToggleRange,
  isNgExpanded,
  onToggleNgExpanded,
  onScrollToMail,
}: Props) {
  const [dateInput, setDateInput] = useState("");
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endTimeInput, setEndTimeInput] = useState("");

  const canAdd = Boolean(dateInput && startTimeInput && endTimeInput && startTimeInput < endTimeInput);

  const handleAdd = () => {
    if (!canAdd) return;
    onAddDate(`${dateInput}T${startTimeInput}`, `${dateInput}T${endTimeInput}`);
    setDateInput("");
    setStartTimeInput("");
    setEndTimeInput("");
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">2. 候補日を入力して空き時間を判定</h2>
      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={companyName}
          onChange={(event) => onCompanyNameChange(event.target.value)}
          placeholder="企業名（例: 株式会社サンプル）"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[1fr_1fr_1fr_140px]">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">日付</label>
            <input
              type="date"
              value={dateInput}
              onChange={(event) => setDateInput(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">開始時刻</label>
            <input
              type="time"
              value={startTimeInput}
              onChange={(event) => setStartTimeInput(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">終了時刻</label>
            <input
              type="time"
              value={endTimeInput}
              onChange={(event) => setEndTimeInput(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              候補日を追加
            </button>
          </div>
        </div>
        {dateInput && startTimeInput && endTimeInput && startTimeInput >= endTimeInput && (
          <p className="text-xs text-red-600">終了時刻は開始時刻より後に設定してください</p>
        )}
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-700">入力済み候補日</h3>
        {candidateDates.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">まだ候補日がありません。</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {candidateDates.map((candidate) => (
              <li
                key={candidate.id}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <span>{toReadableRange(candidate.candidateDate, candidate.candidateEndDate)}</span>
                <button
                  type="button"
                  onClick={() => onRemoveDate(candidate.id)}
                  className="text-red-600 hover:underline"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={onJudge}
          disabled={candidateDates.length === 0}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          判定する
        </button>
      </div>

      <div className="mt-5">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>候補日を選択</CardTitle>
            <CardDescription>
              {isCalendarSynced
                ? "カレンダー予定の前後1時間を除いた空き時間帯です（複数選択可）"
                : "カレンダー未連携のため重複チェックなし。全候補日から選択できます（複数選択可）"}
            </CardDescription>
            <p className="text-sm font-semibold text-slate-700">
              選択中: {activeSelectedRangeKeys.length}件
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasJudgeResult ? (
              <p className="text-sm text-slate-500">「判定する」を押すと結果が表示されます。</p>
            ) : availableRanges.length === 0 ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                空き時間帯がありません
              </div>
            ) : (
              <ul className="space-y-2">
                {availableRanges.map((range) => {
                  const key = rangeKey(range);
                  const isSelected = activeSelectedRangeKeys.includes(key);
                  return (
                    <li key={key}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onToggleRange(key)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onToggleRange(key);
                          }
                        }}
                        className={`flex w-full items-center justify-between rounded-md border px-3 py-3 text-left transition-colors ${
                          isSelected
                            ? "border-blue-300 bg-blue-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            aria-label={`${formatRangeDate(range.start, range.end)} を選択`}
                            onCheckedChange={() => onToggleRange(key)}
                            onClick={(event) => event.stopPropagation()}
                          />
                          <span className="text-sm font-medium text-slate-800">
                            {formatRangeDate(range.start, range.end)}
                          </span>
                          {recommendedRangeKey === key && (
                            <Badge variant="recommendation">おすすめ</Badge>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={onScrollToMail}
                disabled={activeSelectedRangeKeys.length === 0}
              >
                メール生成へ進む
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {isCalendarSynced && (
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">⛔ 除外された時間帯</h3>
            <button
              type="button"
              onClick={onToggleNgExpanded}
              className="text-xs font-semibold text-slate-600 underline"
              disabled={!hasJudgeResult}
            >
              {isNgExpanded ? "閉じる" : "表示する"}
            </button>
          </div>
          {!hasJudgeResult ? (
            <p className="mt-2 text-sm text-slate-500">まだ判定結果がありません。</p>
          ) : blockedRanges.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">除外された時間帯はありません。</p>
          ) : !isNgExpanded ? (
            <p className="mt-2 text-sm text-slate-500">
              {blockedRanges.length}件あります（「表示する」で確認）
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {blockedRanges.map((item) => (
                <li
                  key={`${item.start}__${item.end}`}
                  className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm"
                >
                  <p>{toReadableRange(item.start, item.end)}</p>
                  <p className="text-slate-700">理由: カレンダーの予定と重複（前後1時間含む）</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
