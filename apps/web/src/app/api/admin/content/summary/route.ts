import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";

/**
 * Drafts a summary with a language model, for an article or a video.
 *
 * The existing 从正文首段生成 button copies the opening sentences, which is fast
 * but is not a summary: an article that opens with a dateline or a greeting gets
 * a card that says nothing about what happened. This asks a model to read the
 * whole piece instead.
 *
 * What it writes is a draft, not a publication. The editor sees it in the field
 * and can change or discard it before saving -- nothing is written to the
 * article by this route.
 *
 * The body is sent to OpenAI, so this is an outbound disclosure of unpublished
 * copy. It only ever runs when an editor presses the button.
 *
 * Shared by both forms: a video's 简介 does the same job as an article's 摘要,
 * and is written from the transcript the same way.
 */

/** Long enough for any article here; keeps a runaway body out of the request. */
const MAX_BODY_CHARS = 24_000;

function strippedBody(markdown: string): string {
  return markdown
    .replace(/^:::\s*video[\s\S]*?^:::/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^[#>]+\s*/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_BODY_CHARS);
}

const SYSTEM = [
  "你是中文新闻编辑，为文章或影片撰写列表卡片与搜索结果使用的摘要。",
  "要求：",
  "1. 只依据给定正文，不得加入正文没有的事实、数字、人名、地点或评价。",
  "2. 100–150 个中文字符，一段，不分行。",
  "3. 写清楚发生了什么：人物、事件、时间、地点、结果，优先具体事实而非概括。",
  "4. 用陈述语气，不要「本文」「文章」「报道称」这类自指，也不要标题式短语。",
  "5. 不要使用引号包裹整段，不要加标题，不要列点，直接输出摘要正文。",
  "6. 保持原文的用词习惯（简体中文）。"
].join("\n");

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "未配置 OPENAI_API_KEY，无法生成摘要。" },
      { status: 503 }
    );
  }
  const model = process.env.AI_SUMMARY_MODEL?.trim() || process.env.OPENAI_MAIN_MODEL?.trim() || "gpt-5.4";

  let payload: { title?: unknown; body?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  const title = String(payload.title ?? "").trim();
  const body = strippedBody(String(payload.body ?? ""));
  if (body.length < 60) {
    return NextResponse.json({ error: "正文太短，无法生成摘要。" }, { status: 400 });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `标题：${title || "（无标题）"}\n\n正文：\n${body}`
          }
        ]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      // The upstream message can name the model or the key; surface the status
      // and a short hint, and keep the rest in the server log.
      console.error("summary: OpenAI returned", response.status, detail.slice(0, 500));
      return NextResponse.json(
        { error: `生成失败（OpenAI ${response.status}）。请稍后再试。` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const summary = (data.choices?.[0]?.message?.content ?? "")
      .trim()
      // Models sometimes wrap the whole thing in quotes despite being told not to.
      .replace(/^[「"'“]+|[」"'”]+$/g, "")
      .replace(/\s*\n\s*/g, "")
      .trim();

    if (!summary) {
      return NextResponse.json({ error: "模型没有返回内容，请重试。" }, { status: 502 });
    }
    return NextResponse.json({ summary, model });
  } catch (error) {
    console.error("summary: request failed", error);
    return NextResponse.json({ error: "生成失败，请稍后再试。" }, { status: 502 });
  }
}
