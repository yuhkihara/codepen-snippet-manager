/**
 * 日付フォーマットユーティリティ
 *
 * サーバー・クライアント双方で同じ結果を保証するため、
 * タイムゾーンを Asia/Tokyo に固定してフォーマットします。
 * これにより Hydration mismatch を根本的に防止します。
 */

/**
 * 日付を 'YYYY/MM/DD' 形式でフォーマット
 * タイムゾーン: Asia/Tokyo (JST) 固定
 *
 * @param date - Date オブジェクトまたは ISO 8601 文字列
 * @returns フォーマットされた日付文字列 (例: "2025/11/17")
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateObj);
}

/**
 * 日付を 'YYYY年MM月DD日' 形式でフォーマット
 * タイムゾーン: Asia/Tokyo (JST) 固定
 *
 * @param date - Date オブジェクトまたは ISO 8601 文字列
 * @returns フォーマットされた日付文字列 (例: "2025年11月17日")
 */
export function formatDateLong(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dateObj);
}

/**
 * 日付と時刻を 'YYYY/MM/DD HH:MM' 形式でフォーマット
 * タイムゾーン: Asia/Tokyo (JST) 固定
 *
 * @param date - Date オブジェクトまたは ISO 8601 文字列
 * @returns フォーマットされた日時文字列 (例: "2025/11/17 14:30")
 */
export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
}
