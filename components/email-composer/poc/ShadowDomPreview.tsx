'use client';

/**
 * Shadow DOM Preview Component - Proof of Concept
 *
 * Demonstrates:
 * - Shadow DOM for style isolation
 * - Click selection of components
 * - Double-click inline editing
 * - Direct DOM access (no postMessage needed)
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { sanitizeHTML } from '@/lib/sanitize';

interface ComponentData {
  id: string;
  type: string;
  html: string;
  editableFields: Record<string, string>;
}

interface ShadowDomPreviewProps {
  components: ComponentData[];
  selectedComponentId: string | null;
  editingField: { componentId: string; fieldName: string } | null;
  onComponentSelect: (id: string) => void;
  onComponentDoubleClick: (componentId: string, fieldName: string) => void;
  onTextChange: (componentId: string, fieldName: string, text: string) => void;
  onEditComplete: () => void;
}

export function ShadowDomPreview({
  components,
  selectedComponentId,
  editingField,
  onComponentSelect,
  onComponentDoubleClick,
  onTextChange,
  onEditComplete,
}: ShadowDomPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Shadow DOMの初期化
  useEffect(() => {
    if (containerRef.current && !shadowRootRef.current) {
      shadowRootRef.current = containerRef.current.attachShadow({ mode: 'open' });
      setIsReady(true);
    }
  }, []);

  // コンテンツの更新
  useEffect(() => {
    if (!shadowRootRef.current || !isReady) return;

    const shadow = shadowRootRef.current;

    // スタイルの注入
    const styleContent = `
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      [data-component-id] {
        position: relative;
        transition: outline 0.15s ease;
      }
      [data-component-id]:hover {
        outline: 1px dashed #94a3b8;
        outline-offset: 2px;
        cursor: pointer;
      }
      [data-component-id].selected {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }
      [data-component-id].selected:hover {
        outline: 2px solid #3b82f6;
      }
      [data-editable] {
        transition: background-color 0.15s ease;
      }
      [data-editable]:hover {
        background-color: rgba(59, 130, 246, 0.1);
      }
      [data-editable].editing {
        outline: 2px solid #10b981;
        outline-offset: 1px;
        background-color: rgba(16, 185, 129, 0.1);
        min-height: 1em;
      }
      .drag-handle {
        position: absolute;
        top: 4px;
        left: -24px;
        width: 20px;
        height: 20px;
        background: #e2e8f0;
        border-radius: 4px;
        cursor: grab;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.15s ease;
      }
      [data-component-id]:hover .drag-handle,
      [data-component-id].selected .drag-handle {
        opacity: 1;
      }
      .drag-handle:active {
        cursor: grabbing;
      }
    `;

    // HTMLの構築
    const htmlContent = components
      .map((comp) => {
        const isSelected = comp.id === selectedComponentId;
        // sanitizeHTMLでXSS対策
        // data-component-idやdata-editable属性は許可リストに追加が必要
        return `
          <div
            data-component-id="${comp.id}"
            data-component-type="${comp.type}"
            class="${isSelected ? 'selected' : ''}"
          >
            <div class="drag-handle">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
              </svg>
            </div>
            ${comp.html}
          </div>
        `;
      })
      .join('\n');

    shadow.innerHTML = `
      <style>${styleContent}</style>
      <div class="preview-container">
        ${htmlContent}
      </div>
    `;

    // 編集中のフィールドにcontenteditableを設定
    if (editingField) {
      const editableEl = shadow.querySelector(
        `[data-component-id="${editingField.componentId}"] [data-editable="${editingField.fieldName}"]`
      ) as HTMLElement | null;

      if (editableEl) {
        editableEl.setAttribute('contenteditable', 'true');
        editableEl.classList.add('editing');
        editableEl.focus();

        // カーソルを末尾に移動
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(editableEl);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }, [components, selectedComponentId, editingField, isReady]);

  // イベントハンドラの設定
  useEffect(() => {
    if (!shadowRootRef.current || !isReady) return;

    const shadow = shadowRootRef.current;

    // クリックハンドラ
    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const componentEl = target.closest('[data-component-id]') as HTMLElement | null;

      if (componentEl) {
        const componentId = componentEl.getAttribute('data-component-id');
        if (componentId) {
          onComponentSelect(componentId);
        }
      }
    };

    // ダブルクリックハンドラ
    const handleDoubleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const editableEl = target.closest('[data-editable]') as HTMLElement | null;

      if (editableEl) {
        const componentEl = editableEl.closest('[data-component-id]') as HTMLElement | null;
        if (componentEl) {
          const componentId = componentEl.getAttribute('data-component-id');
          const fieldName = editableEl.getAttribute('data-editable');
          if (componentId && fieldName) {
            onComponentDoubleClick(componentId, fieldName);
          }
        }
      }
    };

    // 入力ハンドラ（編集中のテキスト変更）
    const handleInput = (e: Event) => {
      if (!editingField) return;

      const target = e.target as HTMLElement;
      if (target.getAttribute('data-editable') === editingField.fieldName) {
        // innerTextで改行を保持（\nとして取得）
        const text = target.innerText || '';
        onTextChange(editingField.componentId, editingField.fieldName, text);
      }
    };

    // キーダウンハンドラ（Escapeで編集終了）
    const handleKeyDown = (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'Escape' && editingField) {
        onEditComplete();
      }
    };

    // blur時に編集完了
    const handleBlur = (e: Event) => {
      const focusEvent = e as FocusEvent;
      const target = focusEvent.target as HTMLElement;
      if (target.hasAttribute('data-editable') && editingField) {
        // 少し遅延させてクリックイベントと競合しないようにする
        setTimeout(() => {
          onEditComplete();
        }, 100);
      }
    };

    shadow.addEventListener('click', handleClick);
    shadow.addEventListener('dblclick', handleDoubleClick);
    shadow.addEventListener('input', handleInput);
    shadow.addEventListener('keydown', handleKeyDown as EventListener);
    shadow.addEventListener('blur', handleBlur as EventListener, true);

    return () => {
      shadow.removeEventListener('click', handleClick);
      shadow.removeEventListener('dblclick', handleDoubleClick);
      shadow.removeEventListener('input', handleInput);
      shadow.removeEventListener('keydown', handleKeyDown as EventListener);
      shadow.removeEventListener('blur', handleBlur as EventListener, true);
    };
  }, [
    isReady,
    editingField,
    onComponentSelect,
    onComponentDoubleClick,
    onTextChange,
    onEditComplete,
  ]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-white rounded-lg overflow-auto"
      style={{ minHeight: '400px' }}
    />
  );
}
