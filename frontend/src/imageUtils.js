/** 品目画像をアップロード用にリサイズ・圧縮（JPEG data URL） */
export async function compressImageFile(
  file,
  { maxWidth = 480, maxBytes = 200000, quality = 0.82 } = {}
) {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("画像ファイルを選んでください");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / Math.max(bitmap.width, bitmap.height, 1));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);
  if (typeof bitmap.close === "function") bitmap.close();

  let q = quality;
  let dataUrl = canvas.toDataURL("image/jpeg", q);
  while (dataUrl.length > maxBytes && q > 0.4) {
    q -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  if (dataUrl.length > maxBytes) {
    throw new Error("画像が大きすぎます。別の写真をお試しください");
  }
  return dataUrl;
}
