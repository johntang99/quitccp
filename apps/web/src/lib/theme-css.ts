import themeDefaults from "@/data/theme.json";

export type Theme = typeof themeDefaults;
export { themeDefaults };

/**
 * Font families cannot be free text: next/font resolves faces at build time, so a
 * family nobody compiled in would silently fall back. The theme stores a role name
 * and the build maps it to a real stack. Add a role here and in app/fonts.ts together.
 */
export const FONT_ROLES: Record<string, string> = {
  "serif-sc": 'var(--font-serif-sc), "Songti SC", serif',
  "system-sc": '-apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  "system-serif-sc": '"Songti SC", "SimSun", serif',
  "plex-mono": '"IBM Plex Mono", ui-monospace, Menlo, monospace',
};


const font = (role: string) => FONT_ROLES[role] ?? FONT_ROLES["system-sc"];

/**
 * Render the theme as the :root block the stylesheets consume. The legacy token
 * names (--paper, --seal, --grad-hero …) are kept verbatim so the 4,400 lines of
 * existing CSS keep working untouched; the --fs-/--lh-/--tr- scale is additive.
 *
 * Roles, for anyone reading this palette for the first time:
 *   primary    --seal    #4A3C96   印章紫 — links, active nav, buttons, rules
 *   secondary  --gold    #D6AC4E   CTA fills and accents
 *              --gold-ink #8E6A1A  the same role for gold TEXT on light grounds;
 *                                  the bright gold measures under 2:1 there
 *   backdrop   --paper / --card    page ground and card ground
 *              --pl-deep           the inverse (dark band) ground
 * The full table is in _roles in data/theme.json, and the generic names are
 * emitted below as aliases.
 */
export function themeToCss(theme: Theme): string {
  const c = theme.colors;
  const g = theme.gradients;
  const t = theme.typography;
  const s = theme.surfaces;
  return `:root{
--paper:${c.paper};--card:${c.card};--ink:${c.ink};--ink-2:${c.ink2};
--ink-soft:${c.inkSoft};--muted:${c.muted};--rule:${c.rule};--rule-dark:${c.ruleDark};
--seal:${c.seal};--seal-deep:${c.sealDeep};--pl-deep:${c.plumDeep};--pl-mid:${c.plumMid};
--pl-menu:${c.plumMenu};--gold:${c.gold};--gold-lt:${c.goldLight};
--lav:${c.lavender};--lav-lt:${c.lavenderLight};
--grad-hero:${g.hero};--grad-band:${g.band};--grad-band2:${g.band2};--gold-grad:${g.gold};
--serif:${font(t.fonts.heading)};--sans:${font(t.fonts.body)};--mono:${font(t.fonts.mono)};
--wrap:${theme.spacing.wrap};--section-y:${theme.spacing.sectionY};--gutter:${theme.spacing.gutter};
--radius:${theme.shape.radius};--shadow:${theme.shape.shadow};
--fs-display:${t.size.display};--fs-h2:${t.size.h2};--fs-h3:${t.size.h3};
--fs-item:${t.size.item};--fs-body:${t.size.body};--fs-small:${t.size.small};
--fs-label:${t.size.label};
--lh-heading:${t.lineHeight.heading};--lh-h3:${t.lineHeight.h3};
--lh-item:${t.lineHeight.item};--lh-body:${t.lineHeight.body};
--tr-heading:${t.tracking.heading};--tr-body:${t.tracking.body};--tr-label:${t.tracking.label};
--measure-body:${t.measure.body};--measure-lede:${t.measure.lede};
--on-gold:${s.onGold};--band-deep:${s.bandDeep};--band-deepest:${s.bandDeepest};
--ink-band:${s.inkBand};--ink-dim:${s.inkDim};--ink-mid:${s.inkMid};
--gold-ink:${s.goldInk};--gold-muted:${s.goldMuted};
--cream-text:${s.creamText};--cream-rule:${s.creamRule};
--lav-rule:${s.lavRule};--lav-tint:${s.lavTint};--lav-text:${s.lavText};
--lav-muted:${s.lavMuted};--lav-dim:${s.lavDim};
--seal-bright:${s.sealBright};--grad-mid:${s.gradMid};--grad-top:${s.gradTop};
--apricot:${s.apricot};
/* Generic design-system aliases. The descriptive names above stay the source of
   truth -- this site has three purples doing different jobs, which primary/
   primary-dark cannot express -- but these let anyone who thinks in
   primary/secondary/backdrop find the right colour. See _roles in theme.json. */
--primary:var(--seal);--primary-dark:var(--seal-deep);--primary-bright:var(--seal-bright);
--secondary:var(--gold);--secondary-light:var(--gold-lt);--secondary-dark:var(--gold-ink);
--backdrop-primary:var(--paper);--backdrop-secondary:var(--card);--backdrop-inverse:var(--pl-deep);
--text-primary:var(--ink);--text-secondary:var(--ink-soft);--text-muted:var(--muted);
--text-on-inverse:var(--lav-lt);--border:var(--rule);--border-inverse:var(--rule-dark);
}`;
}
