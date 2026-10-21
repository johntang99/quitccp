"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { SITE_LOCALE, LOCALES, LOCALE_LABELS, type Locale } from "@/lib/site-config";
import { ABOUT_BLOCKS, ABOUT_SUBPAGE_BLOCKS, AboutSectionsEditor } from "./AboutSectionsEditor";
import { INVOLVE_BLOCKS } from "./involve-blocks";
import { SERVICES_BLOCKS } from "./services-blocks";
import { RESOURCES_BLOCKS } from "./resources-blocks";
import { LEGAL_BLOCKS } from "./legal-blocks";
import { HomeSectionsEditor } from "@/components/admin/HomeSectionsEditor";
import { BooksEditor } from "@/components/admin/BooksEditor";
import { ImagePickerModal } from "@/components/admin/ImagePickerModal";
import { formatDateTime } from "@/lib/format";

interface ContentFileItem {
  path: string;
  label: string;
  locale: string;
  section: string;
  slug: string;
  template: string;
  updatedAt?: string;
  hasRecord: boolean;
}

interface ContentRevisionItem {
  id: string;
  entryId: string;
  locale: string;
  path: string;
  createdBy: string;
  note?: string;
  createdAt: string;
}

interface StructuredFieldTemplate {
  key: string;
  label: string;
  minHeight?: number;
}

type StructuredFieldMode = "text" | "json";

interface StructuredFormFieldDef extends StructuredFieldTemplate {
  mode: StructuredFieldMode;
}

function parseObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function toPrettyJson(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function parseJsonValue(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const HOME_PATH = "pages/home.json";
const BOOKS_PATH = "pages/resources-index.json";

/**
 * Display-only rename of the homepage group. The underlying section stays
 * "root" because `routeSeeds` uses it to build the route catalogue -- renaming
 * it there would move the page off "/".
 */
const SECTION_DISPLAY_NAMES: Record<string, string> = {
  root: "home",
  legal: t("admin.ce.section.legal")
};

/**
 * Group order in the sidebar. Anything not listed falls to the end,
 * alphabetically.
 *
 * The homepage leads rather than sitting under "about": it is the page edited
 * most often, and alphabetical order was putting the most-used entry second.
 */
const SECTION_GROUP_ORDER = [
  "root", // shown as "home"
  "about",
  "involve",
  "news",
  "resources",
  "services",
  "videos",
  // Last: the two legal documents are edited rarely and only with approval.
  "legal"
];

function sectionDisplayName(section: string): string {
  return SECTION_DISPLAY_NAMES[section] ?? section;
}

/** Relabels "root/index - 首页" as "home/index - 首页" for the same reason. */
function fileDisplayLabel(file: { label: string; section: string }): string {
  const display = SECTION_DISPLAY_NAMES[file.section];
  if (!display) return file.label;
  return file.label.startsWith(`${file.section}/`)
    ? `${display}/${file.label.slice(file.section.length + 1)}`
    : file.label;
}

import {
  ABOUT_BLOCK_DEFAULTS,
  ABOUT_BLOCK_KEYS,
  ABOUT_INDEX_PATH,
  ABOUT_PAGE_DEFAULT_CONTENTS
} from "@/lib/admin/about-page-defaults";

const ABOUT_STRUCTURED_FORM_FIELDS: Record<string, StructuredFieldTemplate[]> = {
  "pages/about-accountability.json": [
    { key: "summaryCells", label: t("admin.ce.f.summaryCells"), minHeight: 220 },
    { key: "summaryLinks", label: t("admin.ce.f.summaryLinks"), minHeight: 140 },
    { key: "proseSections", label: t("admin.ce.f.proseSections"), minHeight: 240 },
    { key: "downloadsPanel", label: t("admin.ce.f.downloadsPanel"), minHeight: 200 },
    { key: "thirdPartyPanel", label: t("admin.ce.f.thirdPartyPanel"), minHeight: 180 }
  ],
  "pages/about-history.json": [
    { key: "timeline", label: t("admin.ce.f.timeline"), minHeight: 260 },
    { key: "relatedLinks", label: t("admin.ce.f.relatedLinks"), minHeight: 140 }
  ],
  "pages/about-network.json": [
    { key: "stats", label: t("admin.ce.f.stats"), minHeight: 170 },
    { key: "filters", label: t("admin.ce.f.filters"), minHeight: 120 },
    { key: "mapBlock", label: t("admin.ce.f.mapBlock"), minHeight: 160 },
    { key: "locations", label: t("admin.ce.f.locations"), minHeight: 260 },
    { key: "pager", label: t("admin.ce.f.pager"), minHeight: 120 },
    { key: "ctaPanel", label: t("admin.ce.f.ctaPanel"), minHeight: 160 },
    { key: "setupPanel", label: t("admin.ce.f.setupPanel"), minHeight: 180 },
    { key: "offeringsPanel", label: t("admin.ce.f.offeringsPanel"), minHeight: 180 }
  ],
  "pages/about-numbers.json": [
    { key: "stats", label: t("admin.ce.f.statsTop"), minHeight: 170 },
    { key: "sections", label: t("admin.ce.f.sections"), minHeight: 280 },
    { key: "actions", label: t("admin.ce.f.actions"), minHeight: 140 },
    { key: "relatedLinks", label: t("admin.ce.f.relatedLinks"), minHeight: 140 },
    { key: "citationPanel", label: t("admin.ce.f.citationPanel"), minHeight: 160 }
  ],
  "pages/about-team.json": [
    { key: "boardPanel", label: t("admin.ce.f.boardPanel"), minHeight: 260 },
    { key: "staffPanel", label: t("admin.ce.f.staffPanel"), minHeight: 260 },
    { key: "notePanel", label: t("admin.ce.f.notePanel"), minHeight: 150 },
    { key: "relatedPanel", label: t("admin.ce.f.relatedPanel"), minHeight: 160 },
    { key: "joinPanel", label: t("admin.ce.f.joinPanel"), minHeight: 150 }
  ]
};

function shouldUseAboutDefaultBlock(key: (typeof ABOUT_BLOCK_KEYS)[number], value: unknown): boolean {
  if (value === undefined || value === null) return true;
  const raw = JSON.stringify(value);
  return raw.includes("段落 1") || raw.includes("说明文本") || raw.includes("事件描述") || raw.includes("example.com/avatar");
}

function shouldUseAboutPageDefaults(path: string, value: Record<string, unknown>): boolean {
  const raw = JSON.stringify(value);
  if (
    raw.includes("区块可增删排序") ||
    raw.includes("模块化内容块支持在 CMS 中按栏目自由组合。") ||
    raw.includes("长文页面适用于问答") ||
    raw.includes("这是一条可在后台编辑的提示信息。")
  ) {
    return true;
  }
  if (path === "pages/about-network.json") return !Array.isArray(value.locations);
  if (path === "pages/about-accountability.json") return !Array.isArray(value.summaryCells);
  if (path === "pages/about-team.json") return typeof value.boardPanel !== "object" || value.boardPanel === null;
  if (path === "pages/about-numbers.json") return !Array.isArray(value.stats) || !Array.isArray(value.sections);
  if (path === "pages/about-history.json") return !Array.isArray(value.timeline);
  return false;
}

function guessPreviewPath(path: string): string | null {
  if (!path.startsWith("pages/") || !path.endsWith(".json")) return null;
  const name = path.replace("pages/", "").replace(".json", "");
  if (name === "home") return "/";
  if (name === "news-article") return "/news/sample";
  const splitIndex = name.indexOf("-");
  if (splitIndex <= 0) return null;
  const section = name.slice(0, splitIndex);
  const slug = name.slice(splitIndex + 1);
  if (slug === "index") return `/${section}`;
  return `/${section}/${slug}`;
}

function setAtPath(input: Record<string, unknown>, keyPath: string[], value: unknown): Record<string, unknown> {
  const draft = structuredClone(input);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = draft;
  for (let i = 0; i < keyPath.length - 1; i += 1) {
    const key = keyPath[i];
    const current = cursor[key];
    // Arrays must survive traversal: writing ["hero","gallery","0","src"] used
    // to replace the gallery array with {} and lose every item.
    if (typeof current !== "object" || current === null) {
      cursor[key] = /^\d+$/.test(keyPath[i + 1] ?? "") ? [] : {};
    }
    cursor = cursor[key];
  }
  cursor[keyPath[keyPath.length - 1]] = value;
  return draft;
}

export function ContentExplorer({ initialLocale = SITE_LOCALE, initialPath }: { initialLocale?: string; initialPath?: string }) {
  const [locale, setLocale] = useState(initialLocale);
  const [imagePickerField, setImagePickerField] = useState<string[] | null>(null);
  const [imagePickerLabel, setImagePickerLabel] = useState("");
  const [homeJsonDrafts, setHomeJsonDrafts] = useState<Record<string, string>>({});
  const [homeJsonErrors, setHomeJsonErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<ContentFileItem[]>([]);
  const [activePath, setActivePath] = useState(initialPath || "");
  const [activeData, setActiveData] = useState<Record<string, unknown> | null>(null);
  // Mirrors `activeData` synchronously so successive writes in one tick compose.
  const activeDataRef = useRef<Record<string, unknown> | null>(null);
  const [jsonDraft, setJsonDraft] = useState("{}");
  /* What the file looked like when it was last loaded or saved. 预览 opens the
     live page, so without this there was no way to tell an editor that what
     they are about to look at is not what they just typed. */
  const [savedJson, setSavedJson] = useState("{}");
  const [status, setStatus] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"form" | "json">("form");
  const [revisions, setRevisions] = useState<ContentRevisionItem[]>([]);
  const [aboutFormDrafts, setAboutFormDrafts] = useState<Record<string, string>>({});
  const [aboutFormErrors, setAboutFormErrors] = useState<Record<string, string>>({});

/**
 * Entries an editor must not be shown, because editing them changes nothing.
 *
 * Two separate reasons, both verified against the running site on 2026-10-07:
 *
 * 1. The page 404s. The seven old news menu slugs were replaced by the real
 *    categories (`/news/announcements` -> `/news/announcement-claims`), and the
 *    eleven book and magazine detail pages have a seed but no route.
 *
 * 2. The page renders, but never reads this entry. `/news` is built entirely by
 *    `getNewsHome()` from the database, and `/videos` plus every video category
 *    by `getVideoHome()` / `getVideoCategory()`. The article and film lists are
 *    supposed to come from the database -- that is the design -- so the stored
 *    `items`, `frontLead`, `briefItems` and the rest are leftovers that no
 *    template reads.
 *
 * Hiding them is not a loss of capability: none of these controls has ever had
 * an effect. The data stays in the table, so nothing is destroyed, and anything
 * removed from this list reappears immediately.
 */
const UNEDITABLE_PATHS = new Set([
  // 1. route 404s
  "pages/news-announcements.json",
  "pages/news-investigations.json",
  "pages/news-commentary.json",
  "pages/news-stories.json",
  "pages/news-solidarity.json",
  "pages/news-notable.json",
  "pages/news-article.json",
  "pages/resources-book-gongchanzhuyi-zhongji.json",
  "pages/resources-book-jieti-dangwenhua.json",
  "pages/resources-book-mogui-shijie.json",
  "pages/resources-magazine-archive.json",
  "pages/resources-magazine-2024-autumn.json",
  "pages/resources-magazine-2024-winter.json",
  "pages/resources-magazine-2025-spring.json",
  "pages/resources-magazine-2025-summer.json",
  "pages/resources-magazine-2025-autumn.json",
  "pages/resources-magazine-2025-winter.json",
  "pages/resources-magazine-2026-spring.json",
  // 2. page renders, but is driven by the database instead of this entry
  "pages/news-index.json",
  "pages/videos-index.json",
  "pages/videos-jiuping.json",
  "pages/videos-frontline.json",
  "pages/videos-ironclad.json",
  "pages/videos-awakening.json",
  "pages/videos-party-culture.json",
  "pages/videos-step-back.json"
]);

  const groupedFiles = useMemo(() => {
    const groups = new Map<string, ContentFileItem[]>();
    for (const file of files) {
      if (UNEDITABLE_PATHS.has(file.path)) continue;
      const key = file.section || "shared";
      const bucket = groups.get(key) ?? [];
      bucket.push(file);
      groups.set(key, bucket);
    }
    return [...groups.entries()].sort(([a], [b]) => {
      const ia = SECTION_GROUP_ORDER.indexOf(a);
      const ib = SECTION_GROUP_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [files]);

  const activeDataMetaPath = useMemo(() => {
    if (!activeData) return "";
    const meta = (activeData.meta as Record<string, unknown> | undefined) ?? undefined;
    return typeof meta?.path === "string" ? meta.path : "";
  }, [activeData]);

  const activeDataMatchesPath = Boolean(activeData) && (!activeDataMetaPath || activeDataMetaPath === activePath);

  const structuredFields = useMemo<StructuredFormFieldDef[]>(() => {
    if (!activeData || !activePath.startsWith("pages/")) return [];
    const customFields = ABOUT_STRUCTURED_FORM_FIELDS[activePath];
    if (customFields) {
      return customFields.map((field) => ({ ...field, mode: "json" }));
    }
    return Object.keys(activeData)
      .filter((key) => !["meta", "title", "subtitle"].includes(key))
      .map((key) => {
        const value = activeData[key];
        const mode: StructuredFieldMode = typeof value === "string" ? "text" : "json";
        return {
          key,
          label: t(mode === "text" ? "admin.ce.fieldText" : "admin.ce.fieldJson", { key }),
          minHeight: mode === "text" ? 110 : 180,
          mode
        };
      });
  }, [activeData, activePath]);

  const loadFiles = async (preferredPath?: string) => {
    setStatus(t("admin.ce.loadingList"));
    const response = await fetch(`/api/admin/content/files?locale=${encodeURIComponent(locale)}`);
    const payload = (await response.json()) as { rows?: ContentFileItem[]; error?: string };
    if (!response.ok) throw new Error(payload.error || t("admin.ce.loadListFailed"));
    const rows = payload.rows ?? [];
    setFiles(rows);
    // Falling through to rows[0] opened whatever the API happened to list first
    // -- feeds/santui.json -- so the page landed on a file nobody edits. The
    // homepage is the one opened most, so it is the default.
    const nextPath =
      preferredPath && rows.some((row) => row.path === preferredPath)
        ? preferredPath
        : activePath && rows.some((row) => row.path === activePath)
          ? activePath
          : rows.some((row) => row.path === HOME_PATH)
            ? HOME_PATH
            : rows[0]?.path || "";
    setActivePath(nextPath);
    setStatus("");
  };

  const loadFile = async (path: string) => {
    if (!path) return;
    setStatus(t("admin.ce.loadingContent"));
    const response = await fetch(
      `/api/admin/content/file?locale=${encodeURIComponent(locale)}&path=${encodeURIComponent(path)}`
    );
    const payload = (await response.json()) as { row?: { data: Record<string, unknown> }; error?: string };
    if (!response.ok || !payload.row) throw new Error(payload.error || t("admin.ce.loadFileFailed"));
    setActiveData(payload.row.data);
    setJsonDraft(toPrettyJson(payload.row.data));
    setSavedJson(toPrettyJson(payload.row.data));
    // Drafts are per-file; carrying them across a file switch would show one
    // page's JSON in another page's textarea.
    setHomeJsonDrafts({});
    setHomeJsonErrors({});
    setStatus("");
  };

  const loadRevisions = async (path: string) => {
    if (!path) return;
    const response = await fetch(
      `/api/admin/content/revisions?locale=${encodeURIComponent(locale)}&path=${encodeURIComponent(path)}&limit=10`
    );
    const payload = (await response.json()) as { rows?: ContentRevisionItem[] };
    if (!response.ok) {
      setRevisions([]);
      return;
    }
    setRevisions(payload.rows ?? []);
  };

  useEffect(() => {
    void loadFiles(initialPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    if (!activePath) return;
    void loadFile(activePath);
    void loadRevisions(activePath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, locale]);

  // Fills in any About block that is missing or still a placeholder, so the
  // structured editor always has a shape to render rather than an empty box.
  useEffect(() => {
    if (activePath !== ABOUT_INDEX_PATH || !activeData) return;
    let upgradedData: Record<string, unknown> | null = null;
    for (const key of ABOUT_BLOCK_KEYS) {
      if (!shouldUseAboutDefaultBlock(key, activeData[key])) continue;
      if (!upgradedData) upgradedData = { ...activeData };
      upgradedData[key] = structuredClone(ABOUT_BLOCK_DEFAULTS[key]);
    }
    if (upgradedData) {
      setActiveData(upgradedData);
      setJsonDraft(toPrettyJson(upgradedData));
      setStatus(t("admin.ce.filledAboutBlocks"));
    }
  }, [activePath, activeData]);

  useEffect(() => {
    if (!activeData) {
      setAboutFormDrafts({});
      setAboutFormErrors({});
      return;
    }
    if (!activeDataMatchesPath || structuredFields.length === 0) {
      setAboutFormDrafts({});
      setAboutFormErrors({});
      return;
    }
    const nextDrafts: Record<string, string> = {};
    for (const field of structuredFields) {
      const value = activeData[field.key] ?? null;
      nextDrafts[field.key] = field.mode === "text" ? String(value ?? "") : JSON.stringify(value, null, 2);
    }
    setAboutFormDrafts(nextDrafts);
    setAboutFormErrors({});
  }, [activeData, activeDataMatchesPath, structuredFields]);

  useEffect(() => {
    if (!activeData || activePath === ABOUT_INDEX_PATH || !activeDataMatchesPath) return;
    const defaults = ABOUT_PAGE_DEFAULT_CONTENTS[activePath];
    if (!defaults) return;
    if (!shouldUseAboutPageDefaults(activePath, activeData)) return;
    const next = { ...activeData, ...structuredClone(defaults) };
    setActiveData(next);
    setJsonDraft(toPrettyJson(next));
    setStatus(t("admin.ce.filledAboutPage"));
  }, [activePath, activeData, activeDataMatchesPath]);

  /** Returns whether the save actually went through; 保存并预览 needs to know. */
  const saveFile = async (): Promise<boolean> => {
    if (!activePath) return false;
    const parsed = parseObject(jsonDraft);
    if (!parsed) {
      setStatus(t("admin.ce.badJson"));
      return false;
    }
    setStatus(t("admin.ce.saving"));
    const response = await fetch("/api/admin/content/file", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        locale,
        path: activePath,
        content: parsed
      })
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(payload.error || t("admin.ce.saveFailed"));
      return false;
    }
    setStatus(t("admin.ce.saved"));
    setActiveData(parsed);
    setSavedJson(toPrettyJson(parsed));
    await loadFiles(activePath);
    await loadRevisions(activePath);
    return true;
  };

  const importPrototype = async () => {
    setStatus(t("admin.ce.importing"));
    const response = await fetch("/api/admin/content/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale, mode: "prototype", overwrite: false })
    });
    const payload = (await response.json()) as { imported?: number; skipped?: number; error?: string };
    if (!response.ok) {
      setStatus(payload.error || t("admin.ce.importFailed"));
      return;
    }
    setStatus(t("admin.ce.imported", { added: payload.imported ?? 0, skipped: payload.skipped ?? 0 }));
    await loadFiles(activePath);
  };

  const exportCurrentLocale = async () => {
    setStatus(t("admin.ce.exporting"));
    const response = await fetch(`/api/admin/content/export?locale=${encodeURIComponent(locale)}`);
    const payload = (await response.json()) as { rows?: Array<{ path: string; data: unknown }>; error?: string };
    if (!response.ok || !payload.rows) {
      setStatus(payload.error || t("admin.ce.exportFailed"));
      return;
    }
    const blob = new Blob([JSON.stringify({ locale, rows: payload.rows }, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `quitccp-content-${locale}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(t("admin.ce.exported", { n: payload.rows.length }));
  };

  const deleteCurrent = async () => {
    if (!activePath) return;
    const confirmed = window.confirm(t("admin.ce.confirmDelete", { path: activePath }));
    if (!confirmed) return;
    setStatus(t("admin.ce.deleting"));
    const response = await fetch(
      `/api/admin/content/file?locale=${encodeURIComponent(locale)}&path=${encodeURIComponent(activePath)}`,
      { method: "DELETE" }
    );
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(payload.error || t("admin.ce.deleteFailed"));
      return;
    }
    setStatus(t("admin.ce.deleted"));
    await loadFiles();
  };

  const duplicateCurrent = async () => {
    if (!activePath || !activeData) return;
    const newPath = window.prompt(t("admin.ce.copyPrompt"), activePath);
    if (!newPath || !newPath.trim()) return;
    setStatus(t("admin.ce.copying"));
    const response = await fetch("/api/admin/content/file", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        locale,
        path: newPath.trim(),
        content: activeData,
        note: `duplicate-from:${activePath}`
      })
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(payload.error || t("admin.ce.copyFailed"));
      return;
    }
    setStatus(t("admin.ce.copied"));
    await loadFiles(newPath.trim());
  };

  const restoreRevision = async (revisionId: string) => {
    setStatus(t("admin.ce.rollingBack"));
    const response = await fetch("/api/admin/content/revisions/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revisionId })
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(payload.error || t("admin.ce.rollbackFailed"));
      return;
    }
    setStatus(t("admin.ce.rolledBack"));
    await loadFile(activePath);
    await loadRevisions(activePath);
    await loadFiles(activePath);
  };

  /**
   * Writes one field.
   *
   * Reads through a ref rather than the `activeData` binding: two writes in the
   * same tick both saw the same stale snapshot, so the second silently threw
   * away the first. That is easy to hit -- a control that writes on click while
   * another is mid-edit, or any handler that touches two fields.
   */
  useEffect(() => {
    activeDataRef.current = activeData;
  }, [activeData]);

  const updateField = (keyPath: string[], value: unknown) => {
    const base = activeDataRef.current;
    if (!base) return;
    const next = setAtPath(base, keyPath, value);
    activeDataRef.current = next;
    setActiveData(next);
    setJsonDraft(toPrettyJson(next));
  };

  /**
   * Keeps the raw text of each homepage JSON textarea while it is being edited.
   * Without this the textarea would be re-serialised from the parsed value on
   * every keystroke, so a half-typed array would be reformatted underneath the
   * cursor. Invalid JSON is held here and flagged rather than discarded.
   */
  const updateHomeJsonDraft = (sectionKey: string, fieldKey: string, raw: string) => {
    const draftKey = `${sectionKey}.${fieldKey}`;
    setHomeJsonDrafts((prev) => ({ ...prev, [draftKey]: raw }));
    try {
      const parsed = JSON.parse(raw);
      setHomeJsonErrors((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      updateField([sectionKey, fieldKey], parsed);
    } catch {
      setHomeJsonErrors((prev) => ({ ...prev, [draftKey]: t("admin.ce.badJsonField") }));
    }
  };

  const updateStructuredFieldDraft = (field: StructuredFormFieldDef, raw: string) => {
    setAboutFormDrafts((prev) => ({ ...prev, [field.key]: raw }));
    if (field.mode === "text") {
      setAboutFormErrors((prev) => ({ ...prev, [field.key]: "" }));
      updateField([field.key], raw);
      return;
    }
    const parsed = parseJsonValue(raw);
    if (parsed === null) {
      setAboutFormErrors((prev) => ({ ...prev, [field.key]: t("admin.ce.badJsonShort") }));
      return;
    }
    setAboutFormErrors((prev) => ({ ...prev, [field.key]: "" }));
    updateField([field.key], parsed);
  };

  const fillAboutDefaults = () => {
    if (!activeData) return;
    if (activePath === ABOUT_INDEX_PATH) {
      const next = { ...activeData };
      for (const key of ABOUT_BLOCK_KEYS) {
        next[key] = structuredClone(ABOUT_BLOCK_DEFAULTS[key]);
      }
      setActiveData(next);
      setJsonDraft(toPrettyJson(next));
      setStatus(t("admin.ce.filledAboutBlocks2"));
      return;
    }
    const defaults = ABOUT_PAGE_DEFAULT_CONTENTS[activePath];
    if (!defaults) return;
    const next = { ...activeData, ...structuredClone(defaults) };
    setActiveData(next);
    setJsonDraft(toPrettyJson(next));
    setStatus(t("admin.ce.filledAboutPage2"));
  };

  const jsonValid = Boolean(parseObject(jsonDraft));
  const previewPath = guessPreviewPath(activePath);

  /* Compared as parsed objects, not as text: 格式化 rewrites the whitespace
     without changing anything, and that should not count as an edit. */
  const dirty = (() => {
    if (!activePath) return false;
    const now = parseObject(jsonDraft);
    const was = parseObject(savedJson);
    if (!now || !was) return jsonDraft.trim() !== savedJson.trim();
    return JSON.stringify(now) !== JSON.stringify(was);
  })();

  /**
   * Opens the live page -- which is the published one, not a draft of it.
   *
   * This button used to say 预览, and 预览 in Chinese means "look at it before
   * it goes out". So an editor typed something, pressed it, saw their old text,
   * and reported that preview was broken. The button was fine; its name made a
   * promise the button had never been able to keep. It says 看网页 now, which
   * is what it actually does.
   *
   * With unsaved edits it saves first and says so in its label.
   * The tab is opened synchronously, inside the click, because a `window.open`
   * that happens after an `await` has lost the user gesture and browsers
   * silently block it -- which would have turned this fix into the same
   * complaint.
   */
  const openLivePage = async () => {
    if (!previewPath) return;
    if (!dirty) {
      window.open(previewPath, "_blank");
      return;
    }
    const tab = window.open("about:blank", "_blank");
    const saved = await saveFile();
    if (!saved) {
      tab?.close();
      return;
    }
    if (tab) tab.location.href = previewPath;
    else setStatus(t("admin.ce.popupBlocked"));
  };
  const isHomeEditor = activePath === HOME_PATH;
  // Pages edited block by block rather than as JSON textareas: About, Involve,
  // Services and Resources. Every set is the same declaration shape and the
  // same renderer. The books page keeps its own purpose-built editor.
  const blockEditorBlocks =
    activePath === ABOUT_INDEX_PATH
      ? ABOUT_BLOCKS
      : ABOUT_SUBPAGE_BLOCKS[activePath] ??
        INVOLVE_BLOCKS[activePath] ??
        SERVICES_BLOCKS[activePath] ??
        RESOURCES_BLOCKS[activePath] ??
        LEGAL_BLOCKS[activePath];
  const isBooksEditor = activePath === BOOKS_PATH;
  const isStructuredEditor =
    !blockEditorBlocks && !isHomeEditor && !isBooksEditor && structuredFields.length > 0;
  const hasAboutDefaults = activePath === ABOUT_INDEX_PATH || Boolean(ABOUT_PAGE_DEFAULT_CONTENTS[activePath]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>{t("admin.ce.title")}</h2>
        <p>{t("admin.ce.intro")}</p>
        <div className="admin-toolbar">
          <label>
            Locale
            <select
              className="admin-select"
              value={locale}
              onChange={(event) => {
                setLocale(event.target.value);
              }}
              style={{ marginLeft: 8 }}
            >
              {/* 全部已配置的语言，不是写死的两项 —— 加一门语言时这里会跟上。 */}
              {LOCALES.map((code) => (
                <option key={code} value={code}>
                  {code} · {LOCALE_LABELS[code]}
                </option>
              ))}
            </select>
          </label>
          <button className="admin-btn" type="button" onClick={importPrototype}>
            {t("admin.ce.importPrototype")}
          </button>
          <button className="admin-btn" type="button" onClick={exportCurrentLocale}>
            {t("admin.ce.exportLocale")}
          </button>
          {status ? <span>{status}</span> : null}
        </div>
        {/*
          编辑别的站的内容时说一声。
          
          这一页所有编辑都能打开，而语言下拉一切，保存就改到那个站的页面上 ——
          英文站的编辑把它切到 zh，改的是中文站的首页。能跨站是有意的（播种
          新站、对照内容时要用），但不该悄无声息。计划第 2.2 节的原话是
          「跨语言的误操作要能一眼看出来」。
        */}
        {locale !== SITE_LOCALE ? (
          <p
            style={{
              margin: "10px 0 0",
              padding: "8px 10px",
              borderRadius: 4,
              background: "#fdf3e7",
              color: "#7a4a16",
              fontSize: 13
            }}
          >
            <b>
              {t("admin.ce.otherSiteWarning", {
                locale: LOCALE_LABELS[locale as Locale] ?? locale,
                site: LOCALE_LABELS[SITE_LOCALE]
              })}
            </b>
          </p>
        ) : null}
      </section>

      <section className="admin-card" style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
        <aside style={{ borderRight: "1px solid #ececec", paddingRight: 12, maxHeight: 700, overflow: "auto" }}>
          {groupedFiles.map(([group, rows]) => (
            <div key={group} style={{ marginBottom: 14 }}>
              <h4 style={{ margin: "0 0 8px 0" }}>{sectionDisplayName(group)}</h4>
              <div style={{ display: "grid", gap: 4 }}>
                {rows.map((row) => (
                  <button
                    key={row.path}
                    type="button"
                    className="admin-btn"
                    style={{
                      textAlign: "left",
                      justifyContent: "flex-start",
                      borderColor: row.path === activePath ? "#4a3c96" : undefined
                    }}
                    onClick={() => setActivePath(row.path)}
                  >
                    <span style={{ display: "inline-block", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {fileDisplayLabel(row)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        <article>
          <div className="admin-toolbar">
            <strong>{activePath || t("admin.ce.noFileSelected")}</strong>
            <button className="admin-btn" type="button" onClick={duplicateCurrent} disabled={!activePath}>
              {t("admin.ce.copy")}
            </button>
            <button className="admin-btn" type="button" onClick={deleteCurrent} disabled={!activePath}>
              {t("admin.ce.delete")}
            </button>
            <button className="admin-btn" type="button" onClick={() => setJsonDraft(toPrettyJson(parseObject(jsonDraft) || {}))}>
              {t("admin.ce.format")}
            </button>
            {previewPath ? (
              <button
                className="admin-btn"
                type="button"
                onClick={openLivePage}
                disabled={dirty && !jsonValid}
                title={t(dirty ? "admin.ce.openPageTitleDirty" : "admin.ce.openPageTitle")}
              >
                          {t(dirty ? "admin.ce.saveAndOpen" : "admin.ce.openPage")}
              </button>
            ) : null}
            {hasAboutDefaults ? (
              <button className="admin-btn" type="button" onClick={fillAboutDefaults}>
                {t("admin.ce.fillAboutPage")}
              </button>
            ) : null}
            <button className="admin-btn admin-btn-primary" type="button" onClick={saveFile} disabled={!jsonValid}>
              {t(dirty ? "admin.ce.saveDirty" : "admin.ce.save")}
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button className="admin-btn" type="button" onClick={() => setActiveTab("form")}>
              {t("admin.ce.structured")}
            </button>
            <button className="admin-btn" type="button" onClick={() => setActiveTab("json")}>
              JSON
            </button>
          </div>

          {activeTab === "form" ? (
            <div style={{ display: "grid", gap: 10 }}>
              {!activeData ? (
                <p>{t("admin.ce.pickFile")}</p>
              ) : !activeDataMatchesPath ? (
                <p>{t("admin.ce.loadingContent")}</p>
              ) : isHomeEditor ? (
                <HomeSectionsEditor
                  data={activeData}
                  updateField={updateField}
                  jsonDrafts={homeJsonDrafts}
                  jsonErrors={homeJsonErrors}
                  onJsonDraft={updateHomeJsonDraft}
                  onPickImage={(keyPath, label) => {
                    setImagePickerField(keyPath);
                    setImagePickerLabel(label);
                  }}
                />
              ) : isBooksEditor ? (
                <BooksEditor
                  data={activeData}
                  updateField={updateField}
                  onPickImage={(keyPath, label) => {
                    setImagePickerField(keyPath);
                    setImagePickerLabel(label);
                  }}
                />
              ) : blockEditorBlocks ? (
                <>
                  {/* A block may have claimed these two -- see `pageTitleFields`.
                      Rendering them here as well would put the same words in two
                      boxes on one screen, and leave an editor wondering which
                      one the page reads. */}
                  {blockEditorBlocks.some((block) => block.pageTitleFields) ? null : (
                    <>
                      <label>
                        {t("admin.ce.pageTitle")}
                        <input
                          className="admin-input"
                          value={String((activeData.title as string) ?? "")}
                          onChange={(event) => updateField(["title"], event.target.value)}
                        />
                      </label>
                      <label>
                        {t("admin.ce.pageSubtitle")}
                        <textarea
                          className="admin-textarea"
                          value={String((activeData.subtitle as string) ?? "")}
                          onChange={(event) => updateField(["subtitle"], event.target.value)}
                        />
                      </label>
                    </>
                  )}
                  <AboutSectionsEditor
                    blocks={blockEditorBlocks}
                    data={activeData}
                    updateField={updateField}
                    jsonDrafts={homeJsonDrafts}
                    jsonErrors={homeJsonErrors}
                    onJsonDraft={updateHomeJsonDraft}
                    onPickImage={(keyPath, label) => {
                      setImagePickerField(keyPath);
                      setImagePickerLabel(label);
                    }}
                  />
                </>
              ) : isStructuredEditor ? (
                <>
                  <label>
                    {t("admin.ce.pageTitle")}
                    <input
                      className="admin-input"
                      value={String((activeData.title as string) ?? "")}
                      onChange={(event) => updateField(["title"], event.target.value)}
                    />
                  </label>
                  <label>
                    {t("admin.ce.pageSubtitle")}
                    <textarea
                      className="admin-textarea"
                      value={String((activeData.subtitle as string) ?? "")}
                      onChange={(event) => updateField(["subtitle"], event.target.value)}
                    />
                  </label>
                  <p style={{ margin: "4px 0 0", color: "#666" }}>{t("admin.ce.structuredNote")}</p>
                  {structuredFields.map((field) => (
                    <label key={field.key}>
                      {field.label}
                      <textarea
                        className="admin-textarea"
                        style={
                          field.mode === "json"
                            ? { minHeight: field.minHeight ?? 180, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }
                            : { minHeight: field.minHeight ?? 110 }
                        }
                        value={aboutFormDrafts[field.key] ?? (field.mode === "text" ? String(activeData[field.key] ?? "") : "null")}
                        onChange={(event) => updateStructuredFieldDraft(field, event.target.value)}
                      />
                      {aboutFormErrors[field.key] ? (
                        <span style={{ color: "#b42318", fontSize: 12 }}>{aboutFormErrors[field.key]}</span>
                      ) : null}
                    </label>
                  ))}
                </>
              ) : (
                <>
                  <label>
                    {t("admin.ce.fieldTitle")}
                    <input
                      className="admin-input"
                      value={String((activeData.title as string) ?? "")}
                      onChange={(event) => updateField(["title"], event.target.value)}
                    />
                  </label>
                  <label>
                    {t("admin.ce.fieldSubtitle")}
                    <textarea
                      className="admin-textarea"
                      value={String((activeData.subtitle as string) ?? "")}
                      onChange={(event) => updateField(["subtitle"], event.target.value)}
                    />
                  </label>
                  <label>
                    {t("admin.ce.fieldNotice")}
                    <textarea
                      className="admin-textarea"
                      value={String((activeData.notice as string) ?? "")}
                      onChange={(event) => updateField(["notice"], event.target.value)}
                    />
                  </label>
                  <label>
                    {t("admin.ce.heroTitle")}
                    <input
                      className="admin-input"
                      value={String((((activeData.hero as Record<string, unknown>) ?? {}).title as string) ?? "")}
                      onChange={(event) => updateField(["hero", "title"], event.target.value)}
                    />
                  </label>
                  <label>
                    {t("admin.ce.heroDescription")}
                    <textarea
                      className="admin-textarea"
                      value={String((((activeData.hero as Record<string, unknown>) ?? {}).body as string) ?? "")}
                      onChange={(event) => updateField(["hero", "body"], event.target.value)}
                    />
                  </label>
                </>
              )}
            </div>
          ) : (
            <textarea
              className="admin-textarea"
              style={{ minHeight: 420, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              value={jsonDraft}
              onChange={(event) => setJsonDraft(event.target.value)}
            />
          )}

          {revisions.length > 0 ? (
            <div style={{ marginTop: 18 }}>
              <h4>{t("admin.ce.recentRevisions")}</h4>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t("admin.ce.col.time")}</th>
                    <th>{t("admin.ce.col.actor")}</th>
                    <th>{t("admin.ce.col.note")}</th>
                    <th>{t("admin.ce.col.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {revisions.map((revision) => (
                    <tr key={revision.id}>
                      <td>{formatDateTime(revision.createdAt)}</td>
                      <td>{revision.createdBy}</td>
                      <td>{revision.note ?? "-"}</td>
                      <td>
                        <button className="admin-btn" type="button" onClick={() => restoreRevision(revision.id)}>
                          {t("admin.ce.rollback")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>
      </section>

      <ImagePickerModal
        open={imagePickerField !== null}
        fieldLabel={imagePickerLabel}
        onClose={() => setImagePickerField(null)}
        onSelect={(url) => {
          if (imagePickerField) updateField(imagePickerField, url);
          setImagePickerField(null);
        }}
      />
    </div>
  );
}
