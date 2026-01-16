'use client';
import { useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';

interface UserProfileSettingsProps {
  user: User;
}

export default function UserProfileSettings({ user }: UserProfileSettingsProps) {
  const userMetadata = user.user_metadata;
  const [displayName, setDisplayName] = useState(
    userMetadata?.full_name || userMetadata?.name || user.email?.split('@')[0] || ''
  );
  const [avatarUrl, setAvatarUrl] = useState(
    userMetadata?.avatar_url || userMetadata?.picture || ''
  );
  const [isEditing, setIsEditing] = useState(false);
  const supabase = createClient();

  const saveProfile = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: displayName,
          avatar_url: avatarUrl,
        },
      });

      if (error) throw error;

      toast.success('プロフィールを更新しました', { duration: 2000 });
      setIsEditing(false);
      // ページをリロードして変更を反映
      window.location.reload();
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('プロフィールの更新に失敗しました', { duration: 2000 });
    }
  };

  const resetToGitHub = () => {
    const githubName = userMetadata?.full_name || userMetadata?.name;
    const githubAvatar = userMetadata?.avatar_url || userMetadata?.picture;

    if (githubName) setDisplayName(githubName);
    if (githubAvatar) setAvatarUrl(githubAvatar);

    toast.info('GitHubの情報を復元しました', { duration: 2000 });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">プロフィール設定</h2>
        <p className="text-sm text-gray-600 mb-6">
          表示名とアバター画像を設定できます。GitHubでログインした場合は、GitHubの情報が自動的に使用されます。
        </p>
      </div>

      <div className="flex items-center gap-6">
        {avatarUrl && (
          <Image
            src={avatarUrl}
            alt={displayName}
            width={80}
            height={80}
            className="w-20 h-20 rounded-full border-2 border-gray-200"
            unoptimized
          />
        )}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            表示名
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setIsEditing(true);
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            placeholder="表示名を入力"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          アバターURL
        </label>
        <input
          type="url"
          value={avatarUrl}
          onChange={(e) => {
            setAvatarUrl(e.target.value);
            setIsEditing(true);
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          placeholder="https://example.com/avatar.jpg"
        />
        <p className="text-xs text-gray-500 mt-1">
          画像のURLを入力してください
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={saveProfile}
          disabled={!isEditing}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          保存
        </button>
        {(userMetadata?.full_name || userMetadata?.avatar_url) && (
          <button
            onClick={resetToGitHub}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            GitHubの情報を復元
          </button>
        )}
      </div>

      <div className="pt-6 border-t">
        <h3 className="text-sm font-medium text-gray-700 mb-2">アカウント情報</h3>
        <p className="text-sm text-gray-600">
          メール: {user.email}
        </p>
        {userMetadata?.provider_id && (
          <p className="text-sm text-gray-600">
            プロバイダー: GitHub
          </p>
        )}
      </div>
    </div>
  );
}
