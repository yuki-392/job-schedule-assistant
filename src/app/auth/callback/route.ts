import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  try {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  } catch {
    return NextResponse.redirect(new URL("/?authError=1", requestUrl.origin));
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
