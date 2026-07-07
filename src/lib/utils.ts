// アプリ全体で使う共通ユーティリティ関数

/** Date を "YYYY-MM-DD" 形式の文字列に変換する（フォーム表示・APIやり取り用） */
export function toDateInputValue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 今日の日付を "YYYY-MM-DD" 形式で返す */
export function todayInputValue(): string {
  return toDateInputValue(new Date());
}

/** Date を "YYYY-MM-DD HH:mm" 形式に変換する（登録日時の表示用） */
export function toDateTimeDisplay(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

/** 日付表示用（月報一覧向け、曜日付き） */
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
export function toDateDisplayWithWeekday(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${toDateInputValue(d)}（${WEEKDAYS[d.getDay()]}）`;
}

/** 今月の "YYYY-MM" を返す（月報一覧のデフォルト絞り込み用） */
export function currentYearMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** "YYYY-MM" から月初・月末の Date を返す（DBの範囲検索用） */
export function yearMonthToRange(yearMonth: string): { start: Date; end: Date } {
  const [yStr, mStr] = yearMonth.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999); // 月末日の最後
  return { start, end };
}

/** 訪問先の複数行文字列を配列に分解する（空行は除去） */
export function splitDestinations(destination: string): string[] {
  return destination
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 訪問先の配列を保存用の改行区切り文字列に結合する */
export function joinDestinations(list: string[]): string {
  return list
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join("\n");
}

/** CSV の1セル分を安全にエスケープする（カンマ・改行・ダブルクォート対応） */
export function csvEscape(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** メーター数値を "12,345 km" のようにカンマ区切りで表示する */
export function formatMeter(value: number): string {
  return `${value.toLocaleString("ja-JP")} km`;
}
