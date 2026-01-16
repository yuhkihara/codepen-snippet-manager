import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import CategorySettings from '@/components/settings/CategorySettings';
import UserProfileSettings from '@/components/settings/UserProfileSettings';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">設定</h1>
        <p className="text-gray-600">プロフィールとカテゴリの管理</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-8">
          <UserProfileSettings user={user} />
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <CategorySettings />
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/snippets"
          className="text-blue-600 hover:text-blue-700"
        >
          ← スニペット一覧に戻る
        </Link>
      </div>
    </div>
  );
}
