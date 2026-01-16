'use client';

/**
 * Test page for integrated Email Composer
 * No authentication required
 */

import { useEffect } from 'react';
import { useEmailComposerStore } from '@/store/emailComposerStore';
import VisualPreviewEditor from '@/components/email-composer/VisualPreviewEditor';
import EmailCodeEditor from '@/components/email-composer/EmailCodeEditor';

// テスト用のサンプルテンプレート（マーカー付き）
const SAMPLE_TEMPLATE = {
  id: 'test-template-001',
  title: 'Newsletter Template',
  category: 'marketing',
  tags: ['#template', 'newsletter'],
  html: `
<!-- ヘッダー部分（固定） -->
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center; color: white;">
  <h1 style="margin: 0 0 8px 0; font-size: 28px;">Welcome to Our Newsletter</h1>
  <p style="margin: 0; opacity: 0.9;">Stay updated with the latest news</p>
</div>

<!--ここにコンポーネントを入れる-->
<div style="padding: 24px;">
  <h2 data-editable="heading" style="color: #1a202c; margin: 0 0 16px 0;">Featured Article</h2>
  <p data-editable="body" style="color: #4a5568; line-height: 1.6; margin: 0;">
    This is a sample paragraph that demonstrates the inline editing feature.
    Double-click on this text to edit it directly in the preview.
    Changes will sync to the Monaco editor in real-time.
  </p>
</div>

<div style="padding: 24px; text-align: center; background: #edf2f7;">
  <p data-editable="middle-cta" style="color: #4a5568; margin: 0 0 16px 0;">Check out our features</p>
</div>
<!--/ここにコンポーネントを入れる-->

<!-- フッター部分（固定） -->
<div style="padding: 24px; text-align: center; background: #f7fafc;">
  <p style="color: #4a5568; margin: 0 0 16px 0;">Ready to get started?</p>
  <a href="#" style="display: inline-block; background: #4299e1; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">
    Get Started
  </a>
</div>
`.trim(),
};

// テスト用のサンプルスニペット
const SAMPLE_SNIPPETS = [
  {
    id: 'snippet-001',
    title: 'Hero Section',
    description: 'A bold hero section with gradient background',
    category: 'marketing',
    tags: ['hero', 'header'],
    html: `
<div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 48px; text-align: center; color: white;">
  <h1 data-editable="hero-title" style="margin: 0 0 16px 0; font-size: 36px;">Amazing Offer!</h1>
  <p data-editable="hero-subtitle" style="margin: 0; font-size: 18px; opacity: 0.9;">Don't miss out on this incredible opportunity</p>
</div>
`.trim(),
  },
  {
    id: 'snippet-002',
    title: 'Feature List',
    description: 'A 3-column feature list',
    category: 'marketing',
    tags: ['features', 'list'],
    html: `
<div style="padding: 32px; background: #ffffff;">
  <h2 data-editable="features-title" style="text-align: center; color: #1a202c; margin: 0 0 24px 0;">Our Features</h2>
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="width: 33%; padding: 16px; text-align: center; vertical-align: top;">
        <div style="font-size: 32px; margin-bottom: 8px;">🚀</div>
        <h3 data-editable="feature1-title" style="margin: 0 0 8px 0; color: #2d3748;">Fast</h3>
        <p data-editable="feature1-desc" style="margin: 0; color: #718096; font-size: 14px;">Lightning quick performance</p>
      </td>
      <td style="width: 33%; padding: 16px; text-align: center; vertical-align: top;">
        <div style="font-size: 32px; margin-bottom: 8px;">🔒</div>
        <h3 data-editable="feature2-title" style="margin: 0 0 8px 0; color: #2d3748;">Secure</h3>
        <p data-editable="feature2-desc" style="margin: 0; color: #718096; font-size: 14px;">Enterprise-grade security</p>
      </td>
      <td style="width: 33%; padding: 16px; text-align: center; vertical-align: top;">
        <div style="font-size: 32px; margin-bottom: 8px;">💡</div>
        <h3 data-editable="feature3-title" style="margin: 0 0 8px 0; color: #2d3748;">Smart</h3>
        <p data-editable="feature3-desc" style="margin: 0; color: #718096; font-size: 14px;">AI-powered insights</p>
      </td>
    </tr>
  </table>
</div>
`.trim(),
  },
  {
    id: 'snippet-003',
    title: 'CTA Button',
    description: 'Call-to-action button section',
    category: 'marketing',
    tags: ['cta', 'button'],
    html: `
<div style="padding: 32px; text-align: center; background: #edf2f7;">
  <p data-editable="cta-message" style="color: #4a5568; margin: 0 0 16px 0; font-size: 18px;">Join thousands of happy customers today!</p>
  <a href="#" style="display: inline-block; background: #48bb78; color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
    Sign Up Now
  </a>
</div>
`.trim(),
  },
];

// ドラッグ可能なスニペットカード
function DraggableSnippet({ snippet }: { snippet: typeof SAMPLE_SNIPPETS[0] }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', snippet.html);
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: snippet.id,
      html: snippet.html,
      title: snippet.title,
    }));
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="p-3 bg-white rounded-lg border border-gray-200 cursor-grab active:cursor-grabbing hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <h4 className="font-medium text-gray-900 text-sm">{snippet.title}</h4>
      <p className="text-xs text-gray-500 mt-1">{snippet.description}</p>
      <div className="flex gap-1 mt-2">
        {snippet.tags.map((tag) => (
          <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TestComposerPage() {
  const loadTemplate = useEmailComposerStore((state) => state.loadTemplate);
  const componentOrder = useEmailComposerStore((state) => state.componentOrder);

  // 初期化
  useEffect(() => {
    loadTemplate(SAMPLE_TEMPLATE);
  }, [loadTemplate]);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-xl font-bold text-gray-900">
          Email Composer - Integration Test
        </h1>
        <p className="text-sm text-gray-500">
          Visual Editor + Monaco Editor with real-time sync
        </p>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex overflow-hidden">
        {/* スニペットサイドバー */}
        <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          <h2 className="font-semibold text-gray-900 mb-3">Snippets</h2>
          <p className="text-xs text-gray-500 mb-4">
            Drag snippets to either editor to add them
          </p>
          <div className="space-y-3">
            {SAMPLE_SNIPPETS.map((snippet) => (
              <DraggableSnippet key={snippet.id} snippet={snippet} />
            ))}
          </div>
        </div>

        {/* エディターエリア */}
        <div className="flex-1 flex">
          {/* ビジュアルエディター */}
          <div className="flex-1 border-r border-gray-200">
            <VisualPreviewEditor />
          </div>

          {/* コードエディター */}
          <div className="flex-1">
            <EmailCodeEditor />
          </div>
        </div>
      </div>

      {/* ステータスバー */}
      <div className="bg-gray-800 text-white px-4 py-2 text-xs flex justify-between">
        <span>Components: {componentOrder.length}</span>
        <span>Drag snippets from sidebar | Double-click text to edit | Drag handles to reorder</span>
      </div>
    </div>
  );
}
