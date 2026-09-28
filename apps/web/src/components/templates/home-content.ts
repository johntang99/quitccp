import { homeContentDefaults, type HomeContent } from "@quitccp/content-schema";
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
    leadTitle: asString(row.leadTitle),
    leadHref: asString(row.leadHref, "/news"),
    image: asString(row.image),
    badge: asString(row.badge),
    footLabel: asString(row.footLabel),
    footHref: asString(row.footHref, "/news")
  }));

  const videoItems = asObjectArray(videoRow.items).map((row) => ({
    title: asString(row.title),
    meta: asString(row.meta),
    href: asString(row.href, "/videos"),
    image: asString(row.image)
  }));

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
    href: asString(row.href, "#")
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
      actions: heroActions.length > 0 ? heroActions : d.hero.actions,
      image: asString(heroRow.image, d.hero.image),
      imageAlt: asString(heroRow.imageAlt, d.hero.imageAlt),
      gallery: heroGallery.length > 0 ? heroGallery : d.hero.gallery,
      video: {
        // `src` falls back to "" rather than the default, so clearing it in the
        // CMS genuinely removes the video instead of resurrecting a default.
        src: asString(heroVideo.src),
        poster: asString(heroVideo.poster, d.hero.video.poster),
        caption: asString(heroVideo.caption, d.hero.video.caption)
      }
    },
    registry: {
      ...meta(registryRow, d.registry),
      eyebrow: asString(registryRow.eyebrow, d.registry.eyebrow),
      count: asString(registryRow.count, d.registry.count),
      countLabel: asString(registryRow.countLabel, d.registry.countLabel),
      noteLabel: asString(registryRow.noteLabel, d.registry.noteLabel),
      noteHref: asString(registryRow.noteHref, d.registry.noteHref),
      substats: substats.length > 0 ? substats : d.registry.substats,
      streamHeading: asString(registryRow.streamHeading, d.registry.streamHeading),
      liveLabel: asString(registryRow.liveLabel, d.registry.liveLabel),
      feedCount: Math.max(1, Math.min(20, asNumber(registryRow.feedCount, d.registry.feedCount)))
    },
    services: {
      ...meta(servicesRow, d.services),
      eyebrow: asString(servicesRow.eyebrow, d.services.eyebrow),
      heading: asString(servicesRow.heading, d.services.heading),
      moreLabel: asString(servicesRow.moreLabel, d.services.moreLabel),
      moreHref: asString(servicesRow.moreHref, d.services.moreHref),
      cards: serviceCards.length > 0 ? serviceCards : d.services.cards
    },
    news: {
      ...meta(newsRow, d.news),
      eyebrow: asString(newsRow.eyebrow, d.news.eyebrow),
      heading: asString(newsRow.heading, d.news.heading),
      moreLabel: asString(newsRow.moreLabel, d.news.moreLabel),
      moreHref: asString(newsRow.moreHref, d.news.moreHref),
      lead: {
        tag: asString(newsLead.tag, d.news.lead.tag),
        title: asString(newsLead.title, d.news.lead.title),
        body: asString(newsLead.body, d.news.lead.body),
        meta: asString(newsLead.meta, d.news.lead.meta),
        href: asString(newsLead.href, d.news.lead.href),
        image: asString(newsLead.image, d.news.lead.image)
      },
      items: newsItems.length > 0 ? newsItems : d.news.items
    },
    channels: {
      ...meta(channelsRow, d.channels),
      cards: channelCards.length > 0 ? channelCards : d.channels.cards
    },
    video: {
      ...meta(videoRow, d.video),
      eyebrow: asString(videoRow.eyebrow, d.video.eyebrow),
      heading: asString(videoRow.heading, d.video.heading),
      moreLabel: asString(videoRow.moreLabel, d.video.moreLabel),
      moreHref: asString(videoRow.moreHref, d.video.moreHref),
      items: videoItems.length > 0 ? videoItems : d.video.items
    },
    voices: {
      ...meta(voicesRow, d.voices),
      eyebrow: asString(voicesRow.eyebrow, d.voices.eyebrow),
      heading: asString(voicesRow.heading, d.voices.heading),
      lede: asString(voicesRow.lede, d.voices.lede),
      moreLabel: asString(voicesRow.moreLabel, d.voices.moreLabel),
      moreHref: asString(voicesRow.moreHref, d.voices.moreHref),
      items: voiceItems.length > 0 ? voiceItems : d.voices.items
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
      items: resourceItems.length > 0 ? resourceItems : d.resources.items
    },
    about: {
      ...meta(aboutRow, d.about),
      eyebrow: asString(aboutRow.eyebrow, d.about.eyebrow),
      heading: asString(aboutRow.heading, d.about.heading),
      lede: asString(aboutRow.lede, d.about.lede),
      moreLabel: asString(aboutRow.moreLabel, d.about.moreLabel),
      moreHref: asString(aboutRow.moreHref, d.about.moreHref),
      cells: aboutCells.length > 0 ? aboutCells : d.about.cells
    },
    involve: {
      ...meta(involveRow, d.involve),
      eyebrow: asString(involveRow.eyebrow, d.involve.eyebrow),
      heading: asString(involveRow.heading, d.involve.heading),
      items: involveItems.length > 0 ? involveItems : d.involve.items
    }
  };
}
