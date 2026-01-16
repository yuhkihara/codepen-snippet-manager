'use client';
import { useRef, useEffect, useState, useMemo } from 'react';
import { useEmailComposerStore } from '@/store/emailComposerStore';
import { sanitizeHTML } from '@/lib/sanitize';

export default function EmailPreviewPane() {
  const { html } = useEmailComposerStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isIframeReady, setIsIframeReady] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const initialHtmlRef = useRef(html);

  // クライアントサイドでのみマウント
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // iframe内にメッセージリスナーを設定するスクリプト（変更されない）
  const initScript = useMemo(() => `
    <script>
      let lastScrollTop = 0;
      let lastScrollLeft = 0;

      // 親に準備完了を通知
      window.parent.postMessage({ type: 'IFRAME_READY' }, '*');

      // スクロール位置を記録
      window.addEventListener('scroll', () => {
        lastScrollTop = document.documentElement.scrollTop;
        lastScrollLeft = document.documentElement.scrollLeft;
      });

      // 親からのメッセージを受信
      window.addEventListener('message', (event) => {
        if (event.data.type === 'UPDATE_HTML') {
          const root = document.getElementById('root');
          if (root) {
            // スクロール位置を保存
            const scrollTop = lastScrollTop;
            const scrollLeft = lastScrollLeft;

            // HTMLを更新（親で既にサニタイズ済み）
            root.innerHTML = event.data.html;

            // スクロール位置を復元
            requestAnimationFrame(() => {
              document.documentElement.scrollTop = scrollTop;
              document.documentElement.scrollLeft = scrollLeft;
            });
          }
        }
      });
    </script>
  `, []);

  // 初回レンダリング用のHTML（初回のhtmlのみを使用、サニタイズ済み）
  const initialFullHtml = useMemo(() => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      margin: 0;
      padding: 16px;
      font-family: system-ui, -apple-system, sans-serif;
    }
  </style>
</head>
<body>
  <div id="root">${sanitizeHTML(initialHtmlRef.current)}</div>
  ${initScript}
</body>
</html>`, [initScript]);

  // iframeからの準備完了メッセージを受信
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'IFRAME_READY') {
        setIsIframeReady(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 初回: srcdocを設定
  useEffect(() => {
    if (!isMounted || isIframeReady) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    iframe.srcdoc = initialFullHtml;
  }, [isMounted, isIframeReady, initialFullHtml]);

  // HTMLが変更されたらiframeを更新
  useEffect(() => {
    if (!isIframeReady) return;

    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    // postMessageでHTMLのみ更新（サニタイズ済み）
    iframe.contentWindow.postMessage(
      { type: 'UPDATE_HTML', html: sanitizeHTML(html) },
      '*'
    );
  }, [html, isIframeReady]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <div className="w-1 h-6 bg-gradient-to-b from-primary-600 to-accent-600 rounded-full"></div>
          メールプレビュー
        </h2>
        <p className="text-xs text-gray-500 mt-1 ml-3">
          リアルタイムプレビュー（スニペットは下のコードエディタにドロップ）
        </p>
      </div>
      <div className="flex-1 p-4">
        {isMounted ? (
          <iframe
            ref={iframeRef}
            className="w-full h-full border-2 border-gray-200 rounded-xl shadow-lg bg-white"
            sandbox="allow-scripts"
            title="メールプレビュー"
          />
        ) : (
          <div className="w-full h-full border-2 border-gray-200 rounded-xl shadow-lg bg-white flex items-center justify-center">
            <p className="text-gray-400">プレビューを読み込み中...</p>
          </div>
        )}
      </div>
    </div>
  );
}
