import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const handleSignOut = async () => {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/snippets" className="text-xl font-bold text-gray-900">
            Snippet Manager
          </Link>
          <nav className="flex gap-4 items-center">
            <Link href="/snippets" className="text-gray-600 hover:text-gray-900">
              マイスニペット
            </Link>
            <form action={handleSignOut}>
              <button type="submit" className="text-gray-600 hover:text-gray-900">
                ログアウト
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
