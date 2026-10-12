import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { slugifyTitle } from "@/lib/admin/slugify";

/**
 * Romanises a title for 资料's slug field.
 *
 * It is a round trip for something the browser could in principle do, and that
 * is the point: the pinyin dictionary is about a megabyte and belongs on the
 * server. See `lib/admin/slugify.ts` for why a small character table is not an
 * acceptable substitute.
 *
 * Behind the admin session like every other route here. Not because a
 * romanisation is secret, but because an open endpoint that runs a dictionary
 * lookup per request is a free CPU faucet.
 */
export async function GET(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const title = params.get("title") ?? "";
  /* Titles are short. The cap is here so a pasted article body cannot turn one
     keystroke into a megabyte of dictionary work. */
  if (title.length > 300) {
    return NextResponse.json({ error: "Title too long" }, { status: 400 });
  }

  const slug = slugifyTitle(title, { withDate: params.get("date") === "1" });
  return NextResponse.json({ slug });
}
