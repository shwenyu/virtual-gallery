/** Samples an image (must be CORS-accessible) down to a small canvas and averages pixel color. */
export async function extractDominantColor(src: string): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("图片加载失败（可能没有 CORS 权限）"));
    img.src = src;
  });

  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");
  ctx.drawImage(img, 0, 0, size, size);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    throw new Error("无法读取像素数据（图片没有开放 CORS）");
  }

  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 32) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  if (n === 0) throw new Error("图片没有可用像素");
  r = Math.round(r / n);
  g = Math.round(g / n);
  b = Math.round(b / n);

  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
