import type { SectionBlockDef } from "./section-fields";

/**
 * Block declarations for the two legal documents.
 *
 * Each is a single Markdown body rather than a page of panels, so there is one
 * block. `title` and `subtitle` are edited by the header fields every page
 * gets, and `meta` is hidden -- which leaves nothing that would fall through
 * to a raw JSON box.
 *
 * Keyed by content path, which is what ContentExplorer knows.
 */
const MD_HINT = "空行分段。`## 小标题` 是二级标题，`### ` 是三级，`**加粗**`，`[文字](链接)` 是链接。";

function legalBody(note: string): SectionBlockDef[] {
  return [
    {
      key: "intro",
      label: "正文",
      note,
      text: [{ key: "updated", label: "最后更新日期（Updated，如 2020-08-09）" }],
      markdown: [{ key: "body", label: "条款正文（Markdown）", hint: MD_HINT }]
    }
  ];
}

export const LEGAL_BLOCKS: Record<string, SectionBlockDef[]> = {
  "pages/legal-privacy.json": legalBody(
    "隐私政策全文。这是对外的法律文件，改动前请先与理事会或法务确认。页面地址：/legal/privacy"
  ),
  "pages/legal-terms.json": legalBody(
    "服务条款全文。这是对外的法律文件，改动前请先与理事会或法务确认。页面地址：/legal/terms"
  )
};
