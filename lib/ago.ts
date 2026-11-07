const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

// "today", "yesterday", "5 days ago", "3 weeks ago"
export function ago(date: Date | string) {
  const days = Math.round((new Date(date).getTime() - Date.now()) / 86_400_000);
  return Math.abs(days) < 14 ? rtf.format(days, "day") : rtf.format(Math.round(days / 7), "week");
}
