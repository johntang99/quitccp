import { AwsClient } from "aws4fetch";
import { readFileSync } from "node:fs";
for (const l of readFileSync(".env.local","utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,"").trim(); }
const bucket=process.env.R2_LOG_BUCKET, endpoint=`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const aws=new AwsClient({accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY,service:"s3",region:"auto"});
const p=n=>String(n).padStart(2,"0");
async function list(){
  const d=new Date(), pre=`logs/${d.getUTCFullYear()}/${p(d.getUTCMonth()+1)}/${p(d.getUTCDate())}/${p(d.getUTCHours())}/`;
  const r=await aws.fetch(`${endpoint}/${bucket}?list-type=2&max-keys=1000&prefix=${encodeURIComponent(pre)}`);
  const xml=await r.text();
  return [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(m=>({
    key:m[1].match(/<Key>([^<]+)</)[1], size:+m[1].match(/<Size>(\d+)</)[1]}));
}
const before=(await list()).length;
console.log(`当前这一小时已有 ${before} 个对象，等真实日志进来…`);
for(let i=0;i<24;i++){
  await new Promise(r=>setTimeout(r,15000));
  const now=await list();
  if(now.length>before){
    const fresh=now.slice(before);
    console.log(`\n✅ ${i*15+15} 秒后，新增 ${fresh.length} 个对象，共 ${fresh.reduce((s,o)=>s+o.size,0)} 字节`);
    fresh.slice(0,3).forEach(o=>console.log("   "+o.key+"  "+o.size+" 字节"));
    process.exit(0);
  }
}
console.log("⚠️ 6 分钟内没有新对象");
