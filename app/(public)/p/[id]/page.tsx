import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { sanitizeHTML } from '@/lib/sanitize';
import { formatDate } from '@/lib/formatDate';

export default async function PublicSnippetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: snippet, error } = await supabase
    .from('snippets')
    .select('*')
    .eq('id', id)
    .eq('is_public', true)
    .is('deleted_at', null)
    .single();

  if (error || !snippet) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b p-6">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold text-gray-900">{snippet.title}</h1>
          {snippet.description && (
            <p className="text-gray-600 mt-2">{snippet.description}</p>
          )}
          <div className="flex gap-4 mt-4 text-sm text-gray-500">
            <span>作成: {formatDate(snippet.created_at)}</span>
            <span>更新: {formatDate(snippet.updated_at)}</span>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-6">
        <iframe
          srcDoc={sanitizeHTML(snippet.html)}
          className="w-full h-[calc(100vh-250px)] border rounded-lg shadow-lg bg-white"
          sandbox="allow-scripts"
          title={snippet.title}
        />
      </main>
    </div>
  );
}
