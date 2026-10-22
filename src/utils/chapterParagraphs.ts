export function escapeText(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export function sanitizeInlineHtml(html: string): string {
  return html.replace(/<(\/?)([a-zA-Z0-9]+)[^>]*>/g, (_m, slash, tag) => {
    const t = String(tag).toLowerCase();
    return ['b', 'strong', 'i', 'em', 'u', 'br'].includes(t) ? `<${slash}${t}>` : '';
  });
}
export function plainFromHtml(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '');
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || '';
}
export function contentToParagraphs(content: string): { html: string; text: string }[] {
  if (!content) return [];
  const hasHtml = /<\/?(b|strong|i|em|u|div|p|br|span|hr|h[1-6]|li|ul|ol|blockquote|table)\b/i.test(content);
  if (!hasHtml) {
    return content.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean)
      .map((t) => ({ html: escapeText(t).replace(/\n/g, '<br>'), text: t }));
  }
  const s = content
    // Structures riches (import Word) rendues avec des équivalents SÛRS :
    // titres → paragraphes en gras, éléments de liste → puces, tableaux →
    // cellules espacées. Avant, ces balises étaient simplement supprimées et
    // leur texte se collait au paragraphe suivant.
    .replace(/<h[1-6][^>]*>/gi, '\n<strong>')
    .replace(/<\/h[1-6]>/gi, '</strong>\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/?(ul|ol|blockquote|table|thead|tbody|tr)[^>]*>/gi, '\n')
    .replace(/<\/?t[dh][^>]*>/gi, ' ')
    .replace(/<\/(div|p)>/gi, '\n')
    .replace(/<(div|p)[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n* * *\n');
  return s.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    .map((l) => ({ html: sanitizeInlineHtml(l), text: plainFromHtml(l).trim() }));
}

