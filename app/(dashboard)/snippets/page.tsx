import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import SnippetsList from '@/components/snippets/SnippetsList';

interface SnippetsPageProps {
  searchParams: Promise<{ tag?: string }>;
}

export default async function SnippetsPage({ searchParams }: SnippetsPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const selectedTag = params.tag;

  const { data: snippets } = await supabase
    .from('snippets')
    .select('*')
    .eq('owner_id', user.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  // ユーザー情報を取得
  const userMetadata = user.user_metadata;
  const displayName = userMetadata?.full_name || userMetadata?.name || user.email?.split('@')[0] || 'ユーザー';
  const avatarUrl = userMetadata?.avatar_url || userMetadata?.picture;

  return (
    <div className="container mx-auto py-4 sm:py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {avatarUrl && (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={64}
              height={64}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-gray-200 flex-shrink-0"
              unoptimized
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 truncate">{displayName}</h1>
            <p className="text-xs sm:text-sm text-gray-500">
              マイスニペット
              {selectedTag && (
                <span className="ml-2 text-blue-600">
                  · タグ: #{selectedTag} でフィルタリング中
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3 flex-shrink-0">
          <Link
            href="/settings"
            className="flex-1 sm:flex-none bg-gray-200 text-gray-700 px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-gray-300 transition text-center text-sm sm:text-base"
          >
            設定
          </Link>
          <Link
            href="/snippets/new"
            className="flex-1 sm:flex-none bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition text-center text-sm sm:text-base"
          >
            新規作成
          </Link>
        </div>
      </div>
      <SnippetsList snippets={snippets || []} selectedTag={selectedTag} />
    </div>
  );
}
