import DOMPurify from 'isomorphic-dompurify';

/**
 * HTMLをサニタイズしてXSS攻撃を防止
 *
 * @param html - サニタイズするHTML文字列
 * @returns サニタイズされたHTML文字列
 */
export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'p', 'span', 'a', 'img', 'table', 'tr', 'td', 'th',
      'tbody', 'thead', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 'br', 'hr', 'ul', 'ol', 'li'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'style', 'class', 'id', 'alt', 'title',
      'width', 'height', 'align', 'border', 'cellpadding', 'cellspacing',
      'data-editable', 'data-component-id', 'data-component-type'
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'style'],
    FORBID_ATTR: [
      'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus',
      'onblur', 'onchange', 'onsubmit'
    ],
  });
}
