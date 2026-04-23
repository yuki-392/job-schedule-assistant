import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type GoogleEventsResponse = {
  items?: Array<{
    id?: string;
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  }>;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  const providerToken = (session as { provider_token?: string }).provider_token;
  if (!providerToken) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Google token not found. Please re-authenticate." } }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "from and to must be valid ISO datetime" } }, { status: 400 });
  }

  const calendarId = searchParams.get("calendarId") ?? "primary";
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", from);
  url.searchParams.set("timeMax", to);
  url.searchParams.set("maxResults", "100");

  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${providerToken}` },
    });

    if (response.status === 401) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Google token expired. Please re-authenticate." } }, { status: 401 });
    }
    if (response.status === 429) {
      return NextResponse.json({ error: { code: "CALENDAR_RATE_LIMITED", message: "Google API rate limit exceeded." } }, { status: 429 });
    }
    if (!response.ok) {
      return NextResponse.json({ error: { code: "UPSTREAM_ERROR", message: "Failed to fetch Google Calendar events." } }, { status: 502 });
    }

    const json = (await response.json()) as GoogleEventsResponse;
    const events = (json.items ?? [])
      .map((item, index) => {
        const start = item.start?.dateTime ?? item.start?.date;
        const end = item.end?.dateTime ?? item.end?.date;
        if (!start || !end) return null;
        return { id: item.id ?? `google-${index}`, title: item.summary ?? "予定", start, end };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }, { status: 500 });
  }
}
