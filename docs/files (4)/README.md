# tuidang.org 中文站设计稿

28 个页面，按顶层导航分目录。全部为可交互实样，非截图。

从 `index.html` 开始，点击导航即可走完全站。

## 目录结构

```
index.html                  首页

about/                      A 关于我们
  index.html                  机构简介
  numbers.html                数字与统计方法
  network.html                全球网络
  accountability.html         公开与问责
  team.html                   理事会与团队
  history.html                历史沿革

services/                   B 我们的服务
  index.html                  服务总览
  declare.html                声明三退（表单）
  cert.html                   退党证书
  verify.html                 查询验证
  immigration.html            移民相关政策
  faq.html                    三退问答
  contact.html                信息变更／联系我们

involve/                    C 参与支持
  index.html                  捐助我们
  volunteer.html              成为义工
  endccp.html                 ENDCCP 征签
  stories.html                义工故事
  other-ways.html             其他支持方式

news/                       D 新闻与报告
  index.html                  归档列表页
  article.html                文章页模板

videos/                     E 视频
  index.html                  影音库

resources/                  F 资源馆
  index.html                  书籍与文集
  culture.html                中华传统文化
  downloads.html              资料下载
  tools.html                  安全访问工具
  magazine.html               杂志《回归》
  press.html                  媒体与记者

site.css                    共用样式表（交付开发用）
subnav-options.html         子导航方案比较（五种）
```

## 关于样式表

每个页面目前都内嵌了一份完整 CSS，目的是让单个文件也能独立预览。
交付开发时应改回引用外部的 `site.css` 一份，避免同一份样式散落在 28 处。

## 七种页面模板

| 模板 | 代表文件 | 覆盖范围 |
|---|---|---|
| 首页 | `index.html` | 仅首页 |
| 栏目首页 | `about/index.html` 等 | A、B、C、F 四个顶层栏目 |
| 列表／归档 | `news/index.html` | D 全部子栏目、标签页、年份页、搜索结果 |
| 文章页 | `news/article.html` | 全部约 2,800 篇既有文章 |
| 表单页 | `services/declare.html` | 声明、办证、变更、征签、义工报名 |
| 视频库 | `videos/index.html` | E 全部 |
| 问答／长文 | `services/faq.html` | 问答、安全说明、统计方法、书籍章节 |

## 尚未完成

- 安全与隐私说明页（全站链接最多、目前缺失）
- 服务点地图（需先确定位置信息公开到什么颗粒度）
- 搜索结果页（可沿用列表模板）
- 移动端抽屉式导航（目前 980px 以下主导航隐藏）
