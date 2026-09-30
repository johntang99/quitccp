import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * Is this slug free, and if not, what is?
 *
 * The form asks while the editor is still typing, so a clash is visible before
 * they press 保存 rather than coming back as a refusal afterwards. A date prefix
 * makes clashes rarer but cannot rule them out -- 28 of the 74 duplicate titles
 * in the existing corpus were published on the same day as their twin.
 */
export async function GET(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const slug = (searchParams.get("slug") ?? "").trim();
  // The article being edited does not clash with itself.
  const selfId = (searchParams.get("id") ?? "").trim();
  const locale = (searchParams.get("locale") ?? "zh").trim();
  if (!slug) return NextResponse.json({ slug: "", available: false, suggestion: "" });

  const supabase = createSupabaseAdminClient();
  const taken = async (candidate: string) => {
    let query = supabase
      .from("cms_articles")
      .select("id, title")
      .eq("slug", candidate)
      .eq("locale", locale);
    if (selfId) query = query.neq("id", selfId);
    const { data } = await query.maybeSingle();
    return data ?? null;
  };

  const clash = await taken(slug);
  if (!clash) return NextResponse.json({ slug, available: true, suggestion: slug });

  // Walk up until something is free. Two articles with the same title on the
  // same day is the case a date prefix cannot solve, and -2 can.
  let suggestion = slug;
  for (let n = 2; n <= 50; n += 1) {
    suggestion = `${slug}-${n}`;
    if (!(await taken(suggestion))) break;
  }
  return NextResponse.json({
    slug,
    available: false,
    takenBy: String(clash.title ?? ""),
    suggestion
  });
}
