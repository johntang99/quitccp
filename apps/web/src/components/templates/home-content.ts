import { homeContentDefaults, type HomeContent } from "@quitccp/content-schema";
import { SITE_LOCALE } from "@/lib/site-config";
import { asObjectArray, asRecord, asString, asStringArray } from "./content-utils";

/**
 * Merges the stored `pages/home.json` payload over the defaults.
 *
 * Every field falls back to the default, so a partially-filled entry renders
 * correctly and an editor can clear one field without blanking a whole section.
 * Arrays are all-or-nothing: an empty array in the payload means "use the
 * default", because a section with zero cards is almost always a mistake rather
 * than an intent. Hiding a section is what `enabled: false` is for.
 */

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return !["false", "0", "no", "off"].includes(value.toLowerCase());
  return fallback;
}

function meta(row: Record<string, unknown>, fallback: { enabled: boolean; variant: string }) {
  return {
    enabled: asBool(row.enabled, fallback.enabled),
    variant: asString(row.variant, fallback.variant) || fallback.variant
  };
}

function links(value: unknown, fallback: { label: string; href: string }[]) {
  const rows = asObjectArray(value).map((row) => ({
    label: asString(row.label),
    href: asString(row.href, "#")
  }));
  return rows.length > 0 ? rows : fallback;
}

export function resolveHomeContent(payload: Record<string, unknown>): HomeContent {
  const d = homeContentDefaults;

  /*
   * 这些默认值是中文的样例内容 —— 样例文章标题、样例栏目、样例引语。
   *
   * 原来的规则是「CMS 里这一项是空的，就用默认值」。在中文站上那是对的：
   * 一个还没配好的区块，拿样例顶着比空着好看。但在别的语言的站上，那意味着
   * 一篇英文首页中间插进来一排中文标题，而且编辑在后台怎么删都删不掉 ——
   * 他把列表清空，页面就换上样例，看起来像没保存。
   *
   * 所以样例只在中文站顶。别的站上，空就是空：区块在，等编辑填。
   *
   * 2026-10-22 发第一篇英文文章时查出来的：首页一打开 news 区块，470 个汉字
   * 一起回来了。
   */
  const sample = SITE_LOCALE === "zh";
  /** 空列表时该不该拿样例顶上。 */
  const orSample = <T,>(rows: T[], fallback: T[]): T[] => (rows.length > 0 ? rows : sample ? fallback : []);
  /** 单个字符串的同款：中文站用样例，别的站留空。 */
  const sampleText = (fallback: string | undefined): string => (sample ? fallback ?? "" : "");

  const heroRow = asRecord(payload.hero);
  const registryRow = asRecord(payload.registry);
  const servicesRow = asRecord(payload.services);
  const newsRow = asRecord(payload.news);
  const channelsRow = asRecord(payload.channels);
  const videoRow = asRecord(payload.video);
  const voicesRow = asRecord(payload.voices);
  const networkRow = asRecord(payload.network);
  const resourcesRow = asRecord(payload.resources);
  const aboutRow = asRecord(payload.about);
  const involveRow = asRecord(payload.involve);

  const heroActions = asObjectArray(heroRow.actions).map((row) => ({
    label: asString(row.label),
    href: asString(row.href, "#"),
    variant: asString(row.variant, "seal"),
    stamp: asString(row.stamp)
  }));
  const heroGallery = asObjectArray(heroRow.gallery).map((row) => ({
    src: asString(row.src),
    alt: asString(row.alt)
  }));
  const heroVideo = asRecord(heroRow.video);

  const serviceCards = asObjectArray(servicesRow.cards).map((row) => ({
    tag: asString(row.tag),
    title: asString(row.title),
    en: asString(row.en),
    body: asString(row.body),
    links: links(row.links, []),
    ctaLabel: asString(row.ctaLabel),
    ctaHref: asString(row.ctaHref)
  }));

  const newsLead = asRecord(newsRow.lead);
  const newsItems = asObjectArray(newsRow.items).map((row) => ({
    title: asString(row.title),
    date: asString(row.date),
    href: asString(row.href, "/news"),
    image: asString(row.image)
  }));

  const channelCards = asObjectArray(channelsRow.cards).map((row) => ({
    title: asString(row.title),
    en: asString(row.en),
    leadTitle: asString(row.leadTitle),
    leadHref: asString(row.leadHref, "/news"),
    image: asString(row.image),
    badge: asString(row.badge),
    footLabel: asString(row.footLabel),
    /* Empty means "work it out from the column", which is what an editor gets
       by leaving the field alone. A default of "/news" here would make an
       unset field indistinguishable from one deliberately pointed at the news
       index, and the automatic link could never tell whether it was allowed
       to fill it in. */
    footHref: asString(row.footHref)
  }));

  const videoItems = asObjectArray(videoRow.items).map((row) => ({
    title: asString(row.title),
    meta: asString(row.meta),
    href: asString(row.href, "/videos"),
    image: asString(row.image),
    duration: asString(row.duration),
    badge: asString(row.badge)
  }));

  const videoSeries = asObjectArray(videoRow.series).map((row) => ({
    label: asString(row.label),
    href: asString(row.href, "/videos"),
    active: asBool(row.active, false)
  }));

  const videoFeatured = asRecord(videoRow.featured);
  // Blank entries would render as empty pills, so they are dropped rather than
  // kept; an editor clearing the list falls back to the default below.
  const featuredMeta = asStringArray(videoFeatured.meta).filter((entry) => entry.trim().length > 0);

  const voiceItems = asObjectArray(voicesRow.items).map((row) => ({
    quote: asString(row.quote),
    name: asString(row.name),
    role: asString(row.role),
    image: asString(row.image)
  }));

  const resourceItems = asObjectArray(resourcesRow.items).map((row) => ({
    label: asString(row.label),
    tag: asString(row.tag),
    href: asString(row.href, "#")
  }));

  const aboutCells = asObjectArray(aboutRow.cells).map((row) => ({
    heading: asString(row.heading),
    value: asString(row.value),
    body: asString(row.body),
    bars: asObjectArray(row.bars).map((bar) => ({
      label: asString(bar.label),
      percent: asNumber(bar.percent, 0)
    }))
  }));

  const involveItems = asObjectArray(involveRow.items).map((row) => ({
    title: asString(row.title),
    body: asString(row.body),
    href: asString(row.href, "#"),
    ctaLabel: asString(row.ctaLabel),
    glyph: asString(row.glyph),
    primary: asBool(row.primary, false)
  }));

  const substats = asObjectArray(registryRow.substats).map((row) => ({
    value: asString(row.value),
    label: asString(row.label)
  }));

  return {
    hero: {
      ...meta(heroRow, d.hero),
      eyebrow: asString(heroRow.eyebrow, d.hero.eyebrow),
      title: asString(heroRow.title, d.hero.title),
      body: asString(heroRow.body, d.hero.body),
      actions: orSample(heroActions, d.hero.actions),
      image: asString(heroRow.image, d.hero.image),
      imageAlt: asString(heroRow.imageAlt, d.hero.imageAlt),
      gallery: orSample(heroGallery, d.hero.gallery),
      video: {
        // `src` falls back to "" rather than the default, so clearing it in the
        // CMS genuinely removes the video instead of resurrecting a default.
        src: asString(heroVideo.src),
        /*
         * 手机专用的那一支，没填就是空字符串，组件会让手机沿用桌面版。
         *
         * 2026-10-19 漏掉过一次：类型上加了、后台能填能存、组件也认，唯独这里
         * 没加，于是编辑填完保存、库里也有，页面就是不认。这个函数是逐字段重建
         * 的，不是把原对象摊开 —— 少写一行的后果不是报错，是那个字段安静地消失。
         * 加字段时三处都要动：schema 的类型、后台的输入、还有这里。
         */
        srcMobile: asString(heroVideo.srcMobile),
        poster: asString(heroVideo.poster, d.hero.video.poster),
        caption: asString(heroVideo.caption, d.hero.video.caption),
        // Off unless the file really carries sound: a speaker button that
        // unmutes silence makes the site look broken.
        hasAudio: asBool(heroVideo.hasAudio, false),
        soundOn: asBool(heroVideo.soundOn, false)
      }
    },
    registry: {
      ...meta(registryRow, d.registry),
      eyebrow: asString(registryRow.eyebrow, d.registry.eyebrow),
      count: asString(registryRow.count, d.registry.count),
      countLabel: asString(registryRow.countLabel, d.registry.countLabel),
      noteLabel: asString(registryRow.noteLabel, d.registry.noteLabel),
      noteHref: asString(registryRow.noteHref, d.registry.noteHref),
      substats: orSample(substats, d.registry.substats),
      streamHeading: asString(registryRow.streamHeading, d.registry.streamHeading),
      liveLabel: asString(registryRow.liveLabel, d.registry.liveLabel),
      // Cleared deliberately means "show the statistics again", so these three
      // fall back to "" rather than to the default banner.
      asideImage: asString(registryRow.asideImage, d.registry.asideImage),
      asideImageAlt: asString(registryRow.asideImageAlt, d.registry.asideImageAlt),
      asideHref: asString(registryRow.asideHref, d.registry.asideHref),
      feedCount: Math.max(1, Math.min(20, asNumber(registryRow.feedCount, d.registry.feedCount)))
    },
    services: {
      ...meta(servicesRow, d.services),
      eyebrow: asString(servicesRow.eyebrow, d.services.eyebrow),
      heading: asString(servicesRow.heading, d.services.heading),
      moreLabel: asString(servicesRow.moreLabel, d.services.moreLabel),
      moreHref: asString(servicesRow.moreHref, d.services.moreHref),
      cards: orSample(serviceCards, d.services.cards)
    },
    news: {
      ...meta(newsRow, d.news),
      eyebrow: asString(newsRow.eyebrow, d.news.eyebrow),
      heading: asString(newsRow.heading, d.news.heading),
      moreLabel: asString(newsRow.moreLabel, d.news.moreLabel),
      moreHref: asString(newsRow.moreHref, d.news.moreHref),
      listTitle: asString(newsRow.listTitle, d.news.listTitle),
      listTitleEn: asString(newsRow.listTitleEn, d.news.listTitleEn),
      listMoreLabel: asString(newsRow.listMoreLabel, d.news.listMoreLabel),
      listMoreHref: asString(newsRow.listMoreHref, d.news.listMoreHref),
      lead: {
        tag: asString(newsLead.tag, sampleText(d.news.lead.tag)),
        title: asString(newsLead.title, sampleText(d.news.lead.title)),
        body: asString(newsLead.body, sampleText(d.news.lead.body)),
        meta: asString(newsLead.meta, sampleText(d.news.lead.meta)),
        href: asString(newsLead.href, sampleText(d.news.lead.href)),
        image: asString(newsLead.image, sampleText(d.news.lead.image)),
        kicker: asString(newsLead.kicker, sampleText(d.news.lead.kicker))
      },
      items: orSample(newsItems, d.news.items)
    },
    channels: {
      ...meta(channelsRow, d.channels),
      heading: asString(channelsRow.heading, d.channels.heading),
      cards: orSample(channelCards, d.channels.cards)
    },
    video: {
      ...meta(videoRow, d.video),
      eyebrow: asString(videoRow.eyebrow, d.video.eyebrow),
      heading: asString(videoRow.heading, d.video.heading),
      lede: asString(videoRow.lede, d.video.lede),
      moreLabel: asString(videoRow.moreLabel, d.video.moreLabel),
      moreHref: asString(videoRow.moreHref, d.video.moreHref),
      series: orSample(videoSeries, d.video.series),
      /* 「本期推荐」那一格的默认值也是中文样例（《铁证如山》那支片子），
         同样只在中文站顶。英文站没填就空着，区块自己会收起来。 */
      featured: {
        tag: asString(videoFeatured.tag, sampleText(d.video.featured.tag)),
        title: asString(videoFeatured.title, sampleText(d.video.featured.title)),
        body: asString(videoFeatured.body, sampleText(d.video.featured.body)),
        image: asString(videoFeatured.image, sampleText(d.video.featured.image)),
        href: asString(videoFeatured.href, sampleText(d.video.featured.href)),
        // Chip text: clearing it should hide the chip, not resurrect a
        // runtime the video may no longer have.
        duration: asString(videoFeatured.duration),
        meta: orSample(featuredMeta, d.video.featured.meta),
        primaryLabel: asString(videoFeatured.primaryLabel, sampleText(d.video.featured.primaryLabel)),
        primaryHref: asString(videoFeatured.primaryHref, sampleText(d.video.featured.primaryHref)),
        secondaryLabel: asString(videoFeatured.secondaryLabel, sampleText(d.video.featured.secondaryLabel)),
        secondaryHref: asString(videoFeatured.secondaryHref, sampleText(d.video.featured.secondaryHref))
      },
      latestLabel: asString(videoRow.latestLabel, d.video.latestLabel),
      items: orSample(videoItems, d.video.items),
      footNote: asString(videoRow.footNote, d.video.footNote),
      footMark: asString(videoRow.footMark, d.video.footMark)
    },
    voices: {
      ...meta(voicesRow, d.voices),
      eyebrow: asString(voicesRow.eyebrow, d.voices.eyebrow),
      heading: asString(voicesRow.heading, d.voices.heading),
      lede: asString(voicesRow.lede, d.voices.lede),
      moreLabel: asString(voicesRow.moreLabel, d.voices.moreLabel),
      moreHref: asString(voicesRow.moreHref, d.voices.moreHref),
      items: orSample(voiceItems, d.voices.items)
    },
    network: {
      ...meta(networkRow, d.network),
      eyebrow: asString(networkRow.eyebrow, d.network.eyebrow),
      heading: asString(networkRow.heading, d.network.heading),
      body: asString(networkRow.body, d.network.body),
      buttonLabel: asString(networkRow.buttonLabel, d.network.buttonLabel),
      buttonHref: asString(networkRow.buttonHref, d.network.buttonHref),
      citiesLabel: asString(networkRow.citiesLabel, d.network.citiesLabel),
      cities: asStringArray(networkRow.cities, d.network.cities)
    },
    resources: {
      ...meta(resourcesRow, d.resources),
      eyebrow: asString(resourcesRow.eyebrow, d.resources.eyebrow),
      heading: asString(resourcesRow.heading, d.resources.heading),
      moreLabel: asString(resourcesRow.moreLabel, d.resources.moreLabel),
      moreHref: asString(resourcesRow.moreHref, d.resources.moreHref),
      items: orSample(resourceItems, d.resources.items)
    },
    about: {
      ...meta(aboutRow, d.about),
      eyebrow: asString(aboutRow.eyebrow, d.about.eyebrow),
      heading: asString(aboutRow.heading, d.about.heading),
      lede: asString(aboutRow.lede, d.about.lede),
      moreLabel: asString(aboutRow.moreLabel, d.about.moreLabel),
      moreHref: asString(aboutRow.moreHref, d.about.moreHref),
      cells: orSample(aboutCells, d.about.cells)
    },
    involve: {
      ...meta(involveRow, d.involve),
      eyebrow: asString(involveRow.eyebrow, d.involve.eyebrow),
      heading: asString(involveRow.heading, d.involve.heading),
      lede: asString(involveRow.lede, d.involve.lede),
      items: orSample(involveItems, d.involve.items)
    }
  };
}
