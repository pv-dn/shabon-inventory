"""logo_1.png のマークから、ブランドブルー背景のシャープな .ico を生成"""
from collections import deque
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

APP_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = APP_DIR / "assets"
PUBLIC_DIR = APP_DIR / "frontend" / "public"
SOURCE = Path.home() / "OneDrive" / "Desktop" / "logo_1.png"
OUTPUT_ICO = ASSETS_DIR / "app.ico"
OUTPUT_PNG = ASSETS_DIR / "app-icon.png"

# シャボン玉石けんロゴの「シャボン玉」文字色（logo_1.png から抽出）
BRAND_BLUE = (0, 159, 232)
MASTER_SIZE = 512


def flood_remove_outer_black(img: Image.Image, threshold: int = 42) -> Image.Image:
    """外周の黒背景だけを透明にする（キャラの黒線は残す）"""
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()

    def is_bg(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        return r <= threshold and g <= threshold and b <= threshold

    visited: set[tuple[int, int]] = set()
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))

    while q:
        x, y = q.popleft()
        if (x, y) in visited or not is_bg(x, y):
            continue
        visited.add((x, y))
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                q.append((nx, ny))
    return img


def is_character_pixel(r: int, g: int, b: int) -> bool:
    # 白い体・赤いリボン・黒い輪郭
    if r > 140 and g > 140 and b > 140:
        return True
    if r > 150 and g < 90 and b < 90:
        return True
    if r < 50 and g < 50 and b < 50:
        return True
    return False


def extract_character(img: Image.Image) -> Image.Image:
    w, h = img.size
    top = img.crop((0, 0, w, min(h, 52)))
    tw, th = top.size
    minx, miny, maxx, maxy = tw, th, 0, 0
    rgba = top.convert("RGBA")
    for y in range(th):
        for x in range(tw):
            r, g, b = rgba.getpixel((x, y))[:3]
            if is_character_pixel(r, g, b):
                minx, miny = min(minx, x), min(miny, y)
                maxx, maxy = max(maxx, x), max(maxy, y)

    pad = 4
    minx = max(0, minx - pad)
    miny = max(0, miny - pad)
    maxx = min(tw - 1, maxx + pad)
    maxy = min(th - 1, maxy + pad)
    cropped = top.crop((minx, miny, maxx + 1, maxy + 1))
    return flood_remove_outer_black(cropped)


def build_icon_master(character: Image.Image) -> Image.Image:
    """高解像度キャンバスに配置してから縮小し、ぼやけを抑える"""
    cw, ch = character.size
    target = int(MASTER_SIZE * 0.86)
    scale = target / max(cw, ch)

    # 小さい元画像を段階的に拡大してエッジをなめらかに
    step1 = character.resize((cw * 4, ch * 4), Image.Resampling.LANCZOS)
    step2 = step1.resize((cw * 8, ch * 8), Image.Resampling.LANCZOS)
    sized = step2.resize(
        (max(1, int(cw * scale)), max(1, int(ch * scale))),
        Image.Resampling.LANCZOS,
    )

    canvas = Image.new("RGBA", (MASTER_SIZE, MASTER_SIZE), BRAND_BLUE + (255,))
    ox = (MASTER_SIZE - sized.size[0]) // 2
    oy = (MASTER_SIZE - sized.size[1]) // 2
    canvas.paste(sized, (ox, oy), sized)

    rgb = Image.new("RGB", (MASTER_SIZE, MASTER_SIZE), BRAND_BLUE)
    rgb.paste(canvas, mask=canvas.split()[3])

    # 軽いシャープのみ（強すぎるとギザギザになる）
    return rgb.filter(ImageFilter.UnsharpMask(radius=0.8, percent=100, threshold=3))


def save_ico(img: Image.Image, path: Path) -> None:
    sizes = [256, 128, 64, 48, 32, 24, 16]
    icons = [img.resize((s, s), Image.Resampling.LANCZOS) for s in sizes]
    icons[0].save(
        path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=icons[1:],
    )


def sync_public_icons(master: Image.Image) -> None:
    """デスクトップ用 app.ico と同じ見た目を Web / PWA 用 public に反映"""
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    master.save(OUTPUT_PNG, optimize=True)
    save_ico(master, OUTPUT_ICO)

    for size, name in ((192, "icon-192.png"), (512, "icon-512.png")):
        master.resize((size, size), Image.Resampling.LANCZOS).save(
            PUBLIC_DIR / name,
            optimize=True,
        )

    import shutil

    shutil.copy2(OUTPUT_ICO, PUBLIC_DIR / "favicon.ico")
    shutil.copy2(OUTPUT_PNG, PUBLIC_DIR / "favicon.png")
    print(f"同期: {PUBLIC_DIR}")


def main():
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    if not SOURCE.exists():
        if OUTPUT_PNG.exists() and OUTPUT_ICO.exists():
            master = Image.open(OUTPUT_PNG).convert("RGB")
            sync_public_icons(master)
            print(f"logo_1.png なし — 既存アイコンを public に同期: {PUBLIC_DIR}")
            return
        raise FileNotFoundError(f"元画像が見つかりません: {SOURCE}")
    img = Image.open(SOURCE)
    if img.mode == "P":
        img = img.convert("RGBA")
    else:
        img = img.convert("RGBA")
    character = extract_character(img)
    master = build_icon_master(character)
    sync_public_icons(master)
    print(f"背景色 RGB{BRAND_BLUE}")
    print(f"作成: {OUTPUT_ICO}")
    print(f"作成: {OUTPUT_PNG}")


if __name__ == "__main__":
    main()
