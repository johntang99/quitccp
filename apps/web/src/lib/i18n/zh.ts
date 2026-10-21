/**
 * 中文文案。
 *
 * 这是**基准表** —— 其余语言缺的条目回退到这里，而 i18n:check 拿它当清单检查
 * 别的表少了哪些。所以新增文案时先加到这里。
 *
 * key 按「区域.含义」起名，不按英文原文起 —— 文案一改 key 就得跟着改，而 key
 * 是散落在代码里的。
 */

export const zh: Record<string, string> = {
  "site.nameEn": "Global Service Center for Quitting the Chinese Communist Party",
  "site.name": "全球退党服务中心",
  "share.heading": "转载与分享",
  "share.share": "分享",
  "share.copy": "复制",
  "share.copied": "已复制 ✓",
  "share.copyPrompt": "复制这个地址：",
  "share.aria.box": "转载与分享",
  "share.aria.x": "分享到 X",
  "share.aria.facebook": "分享到 Facebook",
  "share.aria.telegram": "分享到 Telegram",
  "share.aria.whatsapp": "分享到 WhatsApp",
  "share.aria.email": "用邮件分享",
  "share.qr": "二维码",
  "share.print": "打印",
  "share.qrTile": "扫码分享",
  "share.aria.qrZoom": "放大二维码",
  "share.aria.qrImage": "本页短地址的二维码",
  "share.qrDialogTitle": "扫码打开本页",
  "share.aria.qrDialog": "扫码打开本页",
  "share.qrDownload": "下载图片",
  "share.close": "关闭",
  "share.reprintArticle": "本文可自由转载、翻译与再制作，无需事先取得授权，注明来源即可。",
  "share.reprintVideo": "本片可自由转载、翻译与再制作，无需事先取得授权，注明来源即可。",
  "share.source": "来源：{site} {url}",
  "footer.services": "服务",
  "footer.content": "内容",
  "footer.about": "关于我们",
  "footer.declare": "声明三退",
  "footer.cert": "办理退党证明",
  "footer.verify": "查询验证",
  "footer.faq": "三退问答",
  "footer.tools": "安全访问",
  "footer.news": "新闻与报告",
  "footer.stories": "三退故事",
  "footer.videos": "视频",
  "footer.resources": "资源馆",
  "footer.network": "全球网络",
  "footer.mission": "使命与原则",
  "footer.team": "理事会与团队",
  "footer.contact": "联系我们",
  "footer.copyright": "© 2005-2026 {site} · 501(c)(3) 非营利组织",
  "footer.mirrors": "免翻墙链接",
  "footer.aria.socials": "社交渠道",
  "footer.terms": "服务条款",
  "footer.privacy": "隐私政策",
};
