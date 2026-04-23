export type CandidateStatus = "pending" | "rejected";

export type CandidateDate = {
  id: string;
  candidateDate: string;     // 開始日時 (ISO datetime)
  candidateEndDate: string;  // 終了日時 (ISO datetime)
  status: CandidateStatus;
  sortOrder: number;
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
};

export type UnavailableDate = {
  date: string;
  reason: "calendar_conflict" | "invalid_datetime";
  conflictEventId?: string;
};

export type JudgeAvailabilityResult = {
  availableDates: string[];
  unavailableDates: UnavailableDate[];
};

export type AvailableRange = {
  start: string;  // ISO datetime
  end: string;    // ISO datetime
};

export type BlockedRange = {
  start: string;  // ISO datetime
  end: string;    // ISO datetime
  conflictEventIds: string[];
};

export type RangeJudgeResult = {
  availableRanges: AvailableRange[];
  blockedRanges: BlockedRange[];
};

export function rangeKey(range: AvailableRange): string {
  return `${range.start}__${range.end}`;
}

type NormalizedEvent = {
  id: string;
  startMs: number;
  endMs: number;
};

export function judgeAvailability(
  candidateDates: string[],
  calendarEvents: CalendarEvent[],
  interviewDurationMinutes = 60,
): JudgeAvailabilityResult {
  const availableDates: string[] = [];
  const unavailableDates: UnavailableDate[] = [];
  const normalizedEvents: NormalizedEvent[] = calendarEvents
    .map((event) => {
      const startMs = new Date(event.start).getTime();
      const endMs = new Date(event.end).getTime();
      if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs >= endMs) {
        return null;
      }
      return { id: event.id, startMs, endMs };
    })
    .filter((event): event is NormalizedEvent => event !== null)
    .sort((a, b) => a.startMs - b.startMs);

  for (const candidate of candidateDates) {
    const candidateStartMs = new Date(candidate).getTime();
    if (Number.isNaN(candidateStartMs)) {
      unavailableDates.push({ date: candidate, reason: "invalid_datetime" });
      continue;
    }

    const candidateEndMs = candidateStartMs + interviewDurationMinutes * 60_000;
    let conflictEventId: string | undefined;

    for (const event of normalizedEvents) {
      if (event.startMs >= candidateEndMs) break;
      if (event.endMs <= candidateStartMs) continue;
      conflictEventId = event.id;
      break;
    }

    if (conflictEventId) {
      unavailableDates.push({ date: candidate, reason: "calendar_conflict", conflictEventId });
      continue;
    }
    availableDates.push(candidate);
  }

  return { availableDates, unavailableDates };
}

export function judgeRangeAvailability(
  rangeStart: string,
  rangeEnd: string,
  calendarEvents: CalendarEvent[],
  bufferMinutes = 60,
): RangeJudgeResult {
  const rangeStartMs = new Date(rangeStart).getTime();
  const rangeEndMs = new Date(rangeEnd).getTime();
  const bufferMs = bufferMinutes * 60_000;

  if (Number.isNaN(rangeStartMs) || Number.isNaN(rangeEndMs) || rangeStartMs >= rangeEndMs) {
    return { availableRanges: [], blockedRanges: [] };
  }

  type BlockInterval = { startMs: number; endMs: number; eventIds: string[] };

  const rawBlocked: BlockInterval[] = [];
  for (const event of calendarEvents) {
    const eventStartMs = new Date(event.start).getTime();
    const eventEndMs = new Date(event.end).getTime();
    if (Number.isNaN(eventStartMs) || Number.isNaN(eventEndMs)) continue;

    const blockedStartMs = eventStartMs - bufferMs;
    const blockedEndMs = eventEndMs + bufferMs;

    if (blockedEndMs <= rangeStartMs || blockedStartMs >= rangeEndMs) continue;

    rawBlocked.push({
      startMs: Math.max(rangeStartMs, blockedStartMs),
      endMs: Math.min(rangeEndMs, blockedEndMs),
      eventIds: [event.id],
    });
  }

  rawBlocked.sort((a, b) => a.startMs - b.startMs);

  // 重複する除外区間をマージ
  const merged: BlockInterval[] = [];
  for (const b of rawBlocked) {
    if (merged.length === 0 || b.startMs > merged[merged.length - 1].endMs) {
      merged.push({ ...b, eventIds: [...b.eventIds] });
    } else {
      const last = merged[merged.length - 1];
      last.endMs = Math.max(last.endMs, b.endMs);
      last.eventIds = [...new Set([...last.eventIds, ...b.eventIds])];
    }
  }

  // 除外区間を差し引いて空き区間を算出
  let available: { startMs: number; endMs: number }[] = [{ startMs: rangeStartMs, endMs: rangeEndMs }];
  for (const blocked of merged) {
    const next: { startMs: number; endMs: number }[] = [];
    for (const avail of available) {
      if (blocked.startMs > avail.startMs) {
        next.push({ startMs: avail.startMs, endMs: Math.min(avail.endMs, blocked.startMs) });
      }
      if (blocked.endMs < avail.endMs) {
        next.push({ startMs: Math.max(avail.startMs, blocked.endMs), endMs: avail.endMs });
      }
    }
    available = next;
  }

  return {
    availableRanges: available.map(({ startMs, endMs }) => ({
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
    })),
    blockedRanges: merged.map(({ startMs, endMs, eventIds }) => ({
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      conflictEventIds: eventIds,
    })),
  };
}
