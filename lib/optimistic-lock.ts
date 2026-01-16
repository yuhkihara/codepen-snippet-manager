import { createClient } from '@/lib/supabase/client';

export async function updateSnippetWithLock(
  id: string,
  expectedUpdatedAt: string,
  updates: { title?: string; html?: string; description?: string; category?: string; is_public?: boolean; tags?: string[] }
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('snippets')
    .update(updates)
    .eq('id', id)
    .eq('updated_at', expectedUpdatedAt)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new Error('CONFLICT');
    throw error;
  }
  if (!data) throw new Error('CONFLICT');
  return data;
}
