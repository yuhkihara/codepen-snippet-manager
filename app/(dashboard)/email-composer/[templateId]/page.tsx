import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import EmailComposerClient from '@/components/email-composer/EmailComposerClient';

export default async function EmailComposerPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // テンプレートスニペットを取得
  const { data: template, error: templateError } = await supabase
    .from('snippets')
    .select('*')
    .eq('id', templateId)
    .eq('owner_id', user.id)
    .is('deleted_at', null)
    .single();

  if (templateError || !template) notFound();

  // テンプレートタグがあるか確認（#テンプレート または テンプレート）
  const isTemplate = template.tags?.some(
    (tag: string) => tag === '#テンプレート' || tag === 'テンプレート' || tag === '#template' || tag === 'template'
  );
  if (!isTemplate) {
    // テンプレートタグがない場合は404
    notFound();
  }

  // テンプレートと同じカテゴリのスニペットを取得（#テンプレート除外）
  const { data: snippets, error: snippetsError } = await supabase
    .from('snippets')
    .select('*')
    .eq('owner_id', user.id)
    .eq('category', template.category)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  // #テンプレート タグを除外
  const filteredSnippets = snippets?.filter(
    (s: any) => !s.tags?.includes('#テンプレート') && !s.tags?.includes('#template')
  ) || [];

  return (
    <EmailComposerClient
      template={template}
      snippets={filteredSnippets}
    />
  );
}
