import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Extracts username from user metadata.
 * GitHub uses `user_name`, Google uses `name` or `full_name`.
 */
function extractUsername(metadata: Record<string, any> | undefined): string | null {
  if (!metadata) return null;
  // GitHubの場合: user_name
  // Googleの場合: name または full_name
  return metadata.user_name || metadata.name || metadata.full_name || null;
}

/**
 * Extracts avatar URL from user metadata.
 * Both GitHub and Google use `avatar_url`, but Google may also use `picture`.
 */
function extractAvatarUrl(metadata: Record<string, any> | undefined): string | null {
  if (!metadata) return null;
  return metadata.avatar_url || metadata.picture || null;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/snippets';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const username = extractUsername(data.user.user_metadata);
      const avatarUrl = extractAvatarUrl(data.user.user_metadata);

      await supabase.from('profiles').upsert({
        id: data.user.id,
        username,
        avatar_url: avatarUrl
      }, { onConflict: 'id' });
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login`);
}
