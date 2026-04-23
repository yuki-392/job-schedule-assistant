export function toReadable(dateTime: string) {
  return new Date(dateTime).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCandidateDate(dateTime: string) {
  const date = new Date(dateTime);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"] as const;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day}（${weekday}）${hour}:${minute}〜`;
}

export function toReadableRange(start: string, end: string) {
  const endDate = new Date(end);
  const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;
  return `${toReadable(start)} ~ ${endTime}`;
}

export function formatRangeDate(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"] as const;
  const month = startDate.getMonth() + 1;
  const day = startDate.getDate();
  const weekday = weekdays[startDate.getDay()];
  const startHour = String(startDate.getHours()).padStart(2, "0");
  const startMin = String(startDate.getMinutes()).padStart(2, "0");
  const endHour = String(endDate.getHours()).padStart(2, "0");
  const endMin = String(endDate.getMinutes()).padStart(2, "0");
  return `${month}/${day}（${weekday}）${startHour}:${startMin} ~ ${endHour}:${endMin}`;
}
