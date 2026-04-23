import { NextResponse } from "next/server";
import { formatRangeDate } from "@/lib/format";

type SelectedRange = {
  start: string;
  end: string;
};

type RequestBody = {
  companyName: string;
  selectedRanges: SelectedRange[];
};

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Invalid JSON body" } }, { status: 400 });
  }

  const { companyName, selectedRanges } = body;

  if (!companyName || typeof companyName !== "string" || companyName.trim().length === 0) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "companyName is required" } }, { status: 400 });
  }
  if (!Array.isArray(selectedRanges) || selectedRanges.length === 0) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "selectedRanges must be a non-empty array" } }, { status: 400 });
  }

  const rangeText = selectedRanges.map((r) => `- ${formatRangeDate(r.start, r.end)}`).join("\n");
  const subject = `${companyName} 面接日程のご返信`;
  const body_ = `${companyName} 採用ご担当者様\n\nお世話になっております。面接日程のご連絡ありがとうございます。\n以下の時間帯で参加可能です。\n\n${rangeText}\n\n何卒よろしくお願いいたします。`;

  return NextResponse.json({ subject, body: body_ });
}
