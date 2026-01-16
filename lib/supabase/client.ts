import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // 型定義が実際のデータベーススキーマと一致していないため、一時的に型指定を削除
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as any;
}
