# tuidang.org 中文站原型

30 个页面，按顶层导航分目录。全部为可交互实样，非截图。

从 `index.html` 开始，点击导航即可走完全站。

## 目录结构

```text
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
  privacy.html                安全与隐私说明
  done.html                   声明完成页（步骤 3）

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
文件清单.md                  清单与模板对照
设计说明书.md                完整设计与技术说明
```

## 说明

- 每个页面目前都内嵌了一份完整 CSS，目的是让单个文件也能独立预览。
- 交付开发时应改回引用外部的 `site.css` 一份，避免样式分散维护。
