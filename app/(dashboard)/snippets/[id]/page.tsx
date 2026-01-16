import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import SnippetDetail from '@/components/snippets/SnippetDetail';

export default async function SnippetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: snippet, error } = await supabase
    .from('snippets')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .is('deleted_at', null)
    .single();

  if (error || !snippet) notFound();

  return <SnippetDetail snippet={snippet} />;
}
