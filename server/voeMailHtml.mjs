// Quality-Hub의 VOE 메일 서식과 HTML 허용 목록을 사용합니다.
import { parseFragment } from "parse5"
import { isQnaFontSize } from "../src/features/voe/fontSizes.mjs"

export function escapeMailHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character])
}

// VOE 본문 서식을 메일에서도 적용하도록 외부 CSS 대신 인라인 스타일로 구성한다.
const styles = {
  p: "margin:0 0 14px;",
  h1: "margin:22px 0 10px;font-size:24px;font-weight:700;line-height:1.35;",
  h2: "margin:22px 0 10px;color:#172c3c;font-size:18px;font-weight:680;line-height:1.35;",
  h3: "margin:22px 0 10px;color:#172c3c;font-size:15px;font-weight:680;line-height:1.35;",
  h4: "margin:18px 0 10px;font-size:14px;font-weight:700;",
  h5: "margin:18px 0 10px;font-size:13px;font-weight:700;",
  h6: "margin:18px 0 10px;font-size:12px;font-weight:700;",
  strong: "font-weight:700;", b: "font-weight:700;",
  em: "font-style:italic;", i: "font-style:italic;",
  s: "text-decoration:line-through;", del: "text-decoration:line-through;",
  u: "text-decoration:underline;",
  ul: "margin:12px 0;padding-left:24px;list-style-type:disc;",
  ol: "margin:12px 0;padding-left:24px;list-style-type:decimal;",
  li: "margin:0;",
  blockquote: "margin:18px 0;padding:12px 15px;border-left:3px solid #6ec0f7;background:#eef6fc;color:#405665;",
  a: "color:#0673bc;text-decoration:underline;",
  table: "width:100%;border-collapse:collapse;table-layout:fixed;",
  th: "padding:9px 10px;border:1px solid #d5e3ec;vertical-align:top;text-align:left;background:#eef6fc;font-weight:650;",
  td: "padding:9px 10px;border:1px solid #d5e3ec;vertical-align:top;text-align:left;",
  pre: "white-space:pre-wrap;font-family:monospace;",
  code: "font-family:monospace;",
  hr: "border:0;border-top:1px solid #d5e3ec;margin:18px 0;",
}
const allowed = new Set([...Object.keys(styles), "br", "div", "span", "thead", "tbody", "tfoot", "tr", "colgroup", "col", "sub", "sup"])
const dropped = new Set(["script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea", "select", "template", "svg", "math", "video", "audio", "source", "link", "meta", "base"])
const voidTags = new Set(["br", "hr", "col"])

export function richHtmlToMailHtml(html, portalUrl) {
  function render(node, depth = 0) {
    if (depth > 100) throw new Error("메일 본문 중첩 깊이 초과")
    if (node.nodeName === "#text") return escapeMailHtml(node.value)
    const tag = node.tagName
    if (tag === "img") return "[이미지: 게시글에서 확인]"
    if (dropped.has(tag) || (node.namespaceURI && node.namespaceURI !== "http://www.w3.org/1999/xhtml")) return ""
    const children = () => (node.childNodes ?? []).map((child) => render(child, depth + 1)).join("")
    if (!allowed.has(tag)) return children()
    const attributes = new Map((node.attrs ?? []).map(({ name, value }) => [name, value]))
    const fontSize = attributes.get("data-qna-font-size")
    const style = (styles[tag] ?? "") + (isQnaFontSize(fontSize) ? `font-size:${fontSize}pt;` : "")
    let attrs = style ? ` style="${style}"` : ""
    if (tag === "a" && attributes.has("href")) {
      try {
        const url = new URL(attributes.get("href"), portalUrl)
        if (["http:", "https:", "mailto:"].includes(url.protocol)) attrs += ` href="${escapeMailHtml(url.href)}" rel="noopener noreferrer"`
      } catch { /* 해석할 수 없는 링크는 텍스트만 유지한다. */ }
    }
    const numeric = tag === "ol" ? ["start"] : ["td", "th"].includes(tag) ? ["colspan", "rowspan"] : tag === "col" ? ["span", "width"] : []
    for (const name of numeric) {
      const value = attributes.get(name)
      if (/^\d{1,4}$/.test(value ?? "") && Number(value) > 0) attrs += ` ${name}="${Number(value)}"`
    }
    return `<${tag}${attrs}>${voidTags.has(tag) ? "" : `${children()}</${tag}>`}`
  }
  return render(parseFragment(String(html ?? "")))
}
