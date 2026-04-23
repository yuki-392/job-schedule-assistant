import { NextResponse } from "next/server";
import { judgeRangeAvailability, type CalendarEvent } from "@/domain/judgeAvailability";

type CandidateRange = {
  id: string;
  start: string;
  end: string;
};

type RequestBody = {
  candidateRanges: CandidateRange[];
  calendarEvents?: CalendarEvent[];
  bufferMinutes?: number;
};

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Invalid JSON body" } }, { status: 400 });
  }

  const { candidateRanges, calendarEvents = [], bufferMinutes = 60 } = body;

  if (!Array.isArray(candidateRanges) || candidateRanges.length === 0) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "candidateRanges must be a non-empty array" } }, { status: 422 });
  }

  for (const range of candidateRanges) {
    if (!range.id || !range.start || !range.end) {
      return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Each candidateRange must have id, start, and end" } }, { status: 400 });
    }
    if (Number.isNaN(Date.parse(range.start)) || Number.isNaN(Date.parse(range.end)) || range.start >= range.end) {
      return NextResponse.json({ error: { code: "INVALID_INPUT", message: `Invalid range: ${range.id}` } }, { status: 400 });
    }
  }

  const results: Record<string, ReturnType<typeof judgeRangeAvailability>> = {};
  for (const range of candidateRanges) {
    results[range.id] = judgeRangeAvailability(range.start, range.end, calendarEvents, bufferMinutes);
  }

  return NextResponse.json({ results });
}
