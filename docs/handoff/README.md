# 共用页头片段 — 交接说明

给老站（WordPress）使用，让 `services.tuidang.org`、`donation.tuidang.org` 等子域名的
页头与新站保持一致。

对应 [domain-transition.md](../implementation/domain-transition.md) 第 4 节「做法一」。

---

## 文件

| 文件 | 说明 |
|---|---|
| `header-snippet.html` | 页头的 HTML（3.3KB）。所有链接与图片已写成绝对地址，可直接放在任何域名上。 |
| `header-snippet.css` | 页头样式（约 8KB，83 条规则）。已包含设计变量和一小段作用域内的重置。 |

**不依赖任何 JavaScript。**

---

## 怎么用

### 1. 放 CSS

把 `header-snippet.css` 的内容加到主题样式里，或存成文件后在 `<head>` 里引用：

```php
<link rel="stylesheet" href="<?php echo get_template_directory_uri(); ?>/css/header-snippet.css">
```

### 2. 放 HTML

把 `header-snippet.html` 的内容贴进主题的 `header.php`，放在 `<body>` 之后、
页面正文之前。

### 3. 调整当前页高亮（可选）

HTML 里菜单项都是普通链接。如果希望当前所在栏目高亮，给对应的 `<a>` 加
`style="color:var(--seal);border-bottom-color:var(--seal)"` 即可。

---

## ⚠️ 两个需要注意的地方

### 一、页头不要被只包着它的容器裹住

页头用 `position: sticky` 实现「菜单栏滚动时固定在顶部」。CSS 的 sticky 受**父元素
高度**限制：如果页头被放在一个只包着页头的 `<div>` 里，这个 div 只有页头那么高，
菜单栏一滚就跟着走了。

```html
<!-- ✅ 可以：父元素是整页容器 -->
<body>
  <header class="qc-header">…</header>
  <main>…</main>
</body>

<!-- ✅ 也可以：父元素包着整个页面 -->
<body>
  <div id="page">
    <header class="qc-header">…</header>
    <main>…</main>
  </div>
</body>

<!-- ❌ 不行：父元素只包着页头，sticky 会失效 -->
<body>
  <div class="header-wrapper">
    <header class="qc-header">…</header>
  </div>
  <main>…</main>
</body>
```

**即使位置不对，页头本身仍然正常显示**，只是不会固定在顶部——属于可接受的降级，
不会出问题。

### 二、变量名冲突

CSS 开头有一段 `:root { --paper: …; --ink: …; }`。如果老站主题已经定义了同名变量，
会互相覆盖。两种处理：

- 老站**没有**用这些变量名 → 直接用，不用改
- 老站**已经**用了 → 删掉 `:root { … }` 那一段，把 `.qc-header` 规则里的
  `var(--xxx)` 换成老站自己的变量，或直接换成具体颜色值（值都列在那段 `:root` 里）

---

## 作用域说明

所有规则都限定在 `.qc-header` 之内，包括那段重置：

```css
.qc-header a { color: inherit; text-decoration: none; }
.qc-header img { max-width: 100%; display: block; height: auto; }
```

已实测：**老站正文里的链接仍保持主题原本的蓝色下划线**，不受影响。

---

## 已验证

在模拟的 WordPress 环境下测过（主题自带 Georgia 字体、蓝色下划线链接、图片红框）：

| 项目 | 结果 |
|---|---|
| 桌面 1440px 页头高度 | 177px，与新站一致 |
| 平板 768px | 169px |
| 手机 390px | 280px，自动切换为汉堡菜单按钮 |
| 横向滚动 | 三种宽度均无 |
| 页头链接样式 | 不受主题影响（无下划线、颜色正确） |
| 老站正文链接 | 保持主题原样（蓝色下划线） |
| 粘顶 | 父元素正确时正常 |

**手机上的汉堡按钮目前只是一个样式，点击没有展开菜单** —— 展开动作需要
JavaScript，新站是用 React 组件做的。如果需要，可以：

- 由老站自己接一段几行的展开/收起脚本，或
- 告诉我们，我们补一个不依赖框架的版本

---

## 日后更新

这两个文件是从新站导出的。新站页头改版后需要重新导出一次，不要在老站手工改结构
——否则下次同步会冲突。
