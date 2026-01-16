'use client';
import { useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { sanitizeHTML } from '@/lib/sanitize';

export default function PreviewPane() {
  const { html } = useEditorStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const srcdoc = `<!DOCTYPE html>
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
  <div id="root">${sanitizeHTML(html)}</div>
</body>
</html>`;

  return <iframe ref={iframeRef} srcDoc={srcdoc} className="w-full h-full border-0 bg-white" sandbox="allow-scripts" title="プレビュー" />;
}
