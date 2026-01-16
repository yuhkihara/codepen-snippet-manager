'use client';

/**
 * Visual Editor Proof of Concept
 *
 * Tests:
 * 1. Shadow DOM style isolation
 * 2. Component selection (single click)
 * 3. Inline text editing (double click)
 * 4. Real-time Monaco sync
 * 5. Newline to <br> conversion
 */

import { useState, useCallback, useMemo } from 'react';
import { ShadowDomPreview } from './ShadowDomPreview';

interface ComponentData {
  id: string;
  type: string;
  html: string;
  editableFields: Record<string, string>;
}

// テスト用のサンプルコンポーネント
const SAMPLE_COMPONENTS: ComponentData[] = [
  {
    id: 'comp-1',
    type: 'header',
    html: `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center; color: white;">
        <h1 data-editable="title" style="margin: 0 0 8px 0; font-size: 28px;">Welcome to Our Newsletter</h1>
        <p data-editable="subtitle" style="margin: 0; opacity: 0.9;">Stay updated with the latest news</p>
      </div>
    `,
    editableFields: {
      title: 'Welcome to Our Newsletter',
      subtitle: 'Stay updated with the latest news',
    },
  },
  {
    id: 'comp-2',
    type: 'content',
    html: `
      <div style="padding: 24px;">
        <h2 data-editable="heading" style="color: #1a202c; margin: 0 0 16px 0;">Featured Article</h2>
        <p data-editable="body" style="color: #4a5568; line-height: 1.6; margin: 0;">
          This is a sample paragraph that demonstrates the inline editing feature.
          Double-click on this text to edit it directly in the preview.
        </p>
      </div>
    `,
    editableFields: {
      heading: 'Featured Article',
      body: 'This is a sample paragraph that demonstrates the inline editing feature.\nDouble-click on this text to edit it directly in the preview.',
    },
  },
  {
    id: 'comp-3',
    type: 'cta',
    html: `
      <div style="padding: 24px; text-align: center; background: #f7fafc;">
        <p data-editable="cta-text" style="color: #4a5568; margin: 0 0 16px 0;">Ready to get started?</p>
        <a href="#" style="display: inline-block; background: #4299e1; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Get Started
        </a>
      </div>
    `,
    editableFields: {
      'cta-text': 'Ready to get started?',
    },
  },
];

export function VisualEditorPoC() {
  const [components, setComponents] = useState<ComponentData[]>(SAMPLE_COMPONENTS);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{
    componentId: string;
    fieldName: string;
  } | null>(null);

  // コンポーネント選択
  const handleComponentSelect = useCallback((id: string) => {
    setSelectedComponentId(id);
    // 別のコンポーネントをクリックしたら編集モードを解除
    if (editingField && editingField.componentId !== id) {
      setEditingField(null);
    }
  }, [editingField]);

  // ダブルクリックで編集開始
  const handleComponentDoubleClick = useCallback(
    (componentId: string, fieldName: string) => {
      setEditingField({ componentId, fieldName });
    },
    []
  );

  // テキスト変更（リアルタイム）
  const handleTextChange = useCallback(
    (componentId: string, fieldName: string, text: string) => {
      setComponents((prev) =>
        prev.map((comp) => {
          if (comp.id !== componentId) return comp;

          // editableFieldsを更新
          const newFields = { ...comp.editableFields, [fieldName]: text };

          // HTMLも更新（data-editable要素のテキストを置換）
          // 改行を<br>に変換
          const htmlWithBr = text.replace(/\n/g, '<br>');
          const parser = new DOMParser();
          const doc = parser.parseFromString(comp.html, 'text/html');
          const editableEl = doc.querySelector(`[data-editable="${fieldName}"]`);
          if (editableEl) {
            editableEl.innerHTML = htmlWithBr;
          }
          const newHtml = doc.body.innerHTML;

          return { ...comp, editableFields: newFields, html: newHtml };
        })
      );
    },
    []
  );

  // 編集完了
  const handleEditComplete = useCallback(() => {
    setEditingField(null);
  }, []);

  // Monaco表示用のHTML生成
  const generatedHtml = useMemo(() => {
    return components
      .map((comp) => {
        return `<!-- component:${comp.id} -->\n<div data-component-id="${comp.id}" data-component-type="${comp.type}">\n${comp.html}\n</div>\n<!-- /component:${comp.id} -->`;
      })
      .join('\n\n');
  }, [components]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Visual Editor PoC - Shadow DOM
        </h1>
        <p className="text-gray-600 mb-6">
          Click to select components. Double-click on editable text to edit inline.
        </p>

        <div className="grid grid-cols-2 gap-6">
          {/* Visual Preview */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium">
              Visual Preview (Shadow DOM)
            </div>
            <div className="p-4">
              <ShadowDomPreview
                components={components}
                selectedComponentId={selectedComponentId}
                editingField={editingField}
                onComponentSelect={handleComponentSelect}
                onComponentDoubleClick={handleComponentDoubleClick}
                onTextChange={handleTextChange}
                onEditComplete={handleEditComplete}
              />
            </div>
          </div>

          {/* Generated HTML */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium">
              Generated HTML (Real-time Sync)
            </div>
            <pre className="p-4 text-xs overflow-auto max-h-[600px] bg-gray-900 text-green-400">
              <code>{generatedHtml}</code>
            </pre>
          </div>
        </div>

        {/* Status Panel */}
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-900 mb-2">Debug Status</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Selected Component:</span>{' '}
              <span className="font-mono text-blue-600">
                {selectedComponentId || 'none'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Editing Field:</span>{' '}
              <span className="font-mono text-green-600">
                {editingField
                  ? `${editingField.componentId}.${editingField.fieldName}`
                  : 'none'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Components:</span>{' '}
              <span className="font-mono">{components.length}</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
          <h3 className="font-semibold mb-2">Test Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Click on any component to select it (blue outline)</li>
            <li>Double-click on text with [data-editable] to enter edit mode (green outline)</li>
            <li>Type to edit - changes reflect in the HTML panel in real-time</li>
            <li>Press Escape or click outside to exit edit mode</li>
            <li>Newlines are converted to &lt;br&gt; tags</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
