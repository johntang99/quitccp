/**
 * 脚本在哪个语言站上操作。
 *
 * 脚本直接连数据库，绕过应用层的收口，所以每一个会写内容表的脚本都要自己把
 * locale 带上。默认 zh：绝大多数现存脚本是为中文站写的，而一个忘了传参数的运行
 * 应该落在它本来就在的那个站上，不应该落在别人的站上。
 *
 *     npx tsx scripts/xxx.ts --locale en
 *     SITE_LOCALE=en npx tsx scripts/xxx.ts
 */
export function scriptLocale(argv: string[] = process.argv): string {
  const i = argv.indexOf("--locale");
  const fromArg = i >= 0 ? argv[i + 1] : null;
  return (fromArg || process.env.SITE_LOCALE || "zh").trim().toLowerCase();
}
