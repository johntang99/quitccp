import qrcode from "qrcode-generator";

/**
 * 把一条地址编成二维码，交出一条 SVG path。
 *
 * ## 为什么不用现成的二维码图片接口
 *
 * 网上那种 `api.qrserver.com/...?data=<URL>` 一行就能用，代价是每打开一个页面，
 * 就把读者的 IP 和他正在看哪一篇，送到另一家服务器上去。这个站劝人退党，读者
 * 里有在意这件事的人 —— 省这几行代码换来的是把他们卖了。
 *
 * ## 为什么是 path，不是一堆 rect
 *
 * 29×29 的码有四百多个黑格。一格一个 `<rect>` 是四百多个节点，而把同一行连续
 * 的黑格并成一段，整张码就是一条 `d`。实测三千字符左右，比 rect 省一个数量级，
 * 而且它是纯静态标记，服务端渲完就定了，页面上不跑任何脚本。
 *
 * 坐标以「格」为单位，所以外面套 `viewBox="0 0 size size"` 就能缩放到任意尺寸，
 * 配合 `shape-rendering="crispEdges"` 不会糊边。
 */
export type QrCode = {
  /** 边长有多少格，直接拿去写 viewBox。 */
  size: number;
  /** 整张码的单条 path。 */
  path: string;
};

/**
 * 纠错等级固定 M（约 15%）。短地址本来就短，码的密度低，M 已经足够应付印在
 * 传单上被折一道、或者屏幕反光；再往上调只会把格子变密，反而更难扫。
 */
export function toQrCode(text: string): QrCode {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const size = qr.getModuleCount();
  let path = "";
  for (let row = 0; row < size; row += 1) {
    let col = 0;
    while (col < size) {
      if (!qr.isDark(row, col)) {
        col += 1;
        continue;
      }
      /* 把这一行里连着的黑格一次画完 */
      let run = 1;
      while (col + run < size && qr.isDark(row, col + run)) run += 1;
      path += `M${col} ${row}h${run}v1h-${run}z`;
      col += run;
    }
  }
  return { size, path };
}
