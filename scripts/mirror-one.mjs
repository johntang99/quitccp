/**
 * 把 Storage 里的某几个对象单独补进 R2 镜像。
 *
 *   node --env-file=.env.local scripts/mirror-one.mjs home/1792280897797-hero-30s-10-17-1920.mp4
 *   node --env-file=.env.local scripts/mirror-one.mjs "https://xxx.supabase.co/storage/v1/object/public/media/home/a.mp4"
 *
 * push-media-mirror.mjs 推的是整棵本地镜像目录，要先 mirror-media.mjs 拉一遍；
 * 补一个刚上传的文件用不着那么大动静。参数可以是对象键，也可以直接是公开地址。
 *
 * 常规路径（后台上传、拼接台出片）都会自己镜像，所以这个脚本是补漏用的：
 * 镜像那步失败了、或者文件是从别处直接写进 Storage 的。
 */
import { AwsClient } from "aws4fetch";
import { createHash } from "node:crypto";

const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const publicPrefix = `${supabaseUrl}/storage/v1/object/public/${bucket}/`;

const keys = process.argv.slice(2).map((arg) =>
  arg.startsWith("http") ? decodeURIComponent(arg.split("?")[0].replace(publicPrefix, "")) : arg
);
if (keys.length === 0) {
  console.error("用法：node --env-file=.env.local scripts/mirror-one.mjs <对象键或公开地址> ...");
  process.exit(1);
}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT } = process.env;
if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !(R2_ACCOUNT_ID || R2_ENDPOINT)) {
  console.error("R2 未配置：要 R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY、R2_BUCKET。");
  process.exit(1);
}

const aws = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto"
});
const base = R2_ENDPOINT
  ? `${R2_ENDPOINT.replace(/\/$/, "")}/${R2_BUCKET}`
  : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;

let failed = 0;
for (const key of keys) {
  const response = await fetch(publicPrefix + key.split("/").map(encodeURIComponent).join("/"));
  if (!response.ok) {
    console.error(`✗ ${key} —— 源站 HTTP ${response.status}`);
    failed += 1;
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const put = await aws.fetch(`${base}/${key.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PUT",
    body: bytes,
    headers: {
      "content-type": response.headers.get("content-type") || "application/octet-stream",
      /* R2 拒绝未签名载荷的 PUT，这个哈希是必需的不是可选的。 */
      "x-amz-content-sha256": createHash("sha256").update(bytes).digest("hex"),
      /* 显式写长度：不写的话运行时会把它当成分块流发出去，R2 回 411。 */
      "content-length": String(bytes.length),
      "cache-control": "public, max-age=31536000, immutable"
    }
  });
  if (put.ok) {
    console.log(`✓ ${key}  ${(bytes.length / 1048576).toFixed(1)} MB`);
  } else {
    console.error(`✗ ${key} —— R2 HTTP ${put.status}`);
    failed += 1;
  }
}
process.exit(failed > 0 ? 1 : 0);
