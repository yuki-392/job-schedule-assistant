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

      return {
        id: event.id,
        startMs,
        endMs,
      };
    })
    .filter((event): event is NormalizedEvent => event !== null)
    .sort((a, b) => a.startMs - b.startMs);

  for (const candidate of candidateDates) {
    const candidateStartMs = new Date(candidate).getTime();
    if (Number.isNaN(candidateStartMs)) {
      unavailableDates.push({
        date: candidate,
        reason: "invalid_datetime",
      });
      continue;
    }

    const candidateEndMs = candidateStartMs + interviewDurationMinutes * 60_000;
    let conflictEventId: string | undefined;

    for (const event of normalizedEvents) {
      // Sorted by start time, so no later event can overlap.
      if (event.startMs >= candidateEndMs) break;
      // Candidate starts after this event already ended.
      if (event.endMs <= candidateStartMs) continue;

      conflictEventId = event.id;
      break;
    }

    if (conflictEventId) {
      unavailableDates.push({
        date: candidate,
        reason: "calendar_conflict",
        conflictEventId,
      });
      continue;
    }

    availableDates.push(candidate);
  }

  return {
    availableDates,
    unavailableDates,
  };
}
