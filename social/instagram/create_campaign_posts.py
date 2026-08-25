from pathlib import Path
import base64
from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "brand" / "assets"
BOOKS = ROOT / "brand" / "books"
OUT = Path(__file__).resolve().parent

W, H = 1080, 1350
NAVY = (22, 29, 76)
CREAM = (255, 249, 243)
PINK = (235, 107, 167)
LAVENDER = (239, 230, 248)
GOLD = (244, 193, 74)
MUTED = (88, 85, 112)
WHITE = (255, 255, 255)

FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_REGULAR = "C:/Windows/Fonts/segoeui.ttf"


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def logo():
    im = Image.open(ASSETS / "logo-kawaii-muslim.png").convert("RGBA")
    im = im.crop(im.getbbox())
    im.thumbnail((158, 118), Image.Resampling.LANCZOS)
    return im


def rounded(im, size, radius=26):
    im = im.convert("RGB").resize(size, Image.Resampling.LANCZOS)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def paste_shadow(base, card, xy, blur=22, offset=(0, 14), alpha=48):
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    shade = Image.new("RGBA", card.size, (18, 25, 67, alpha))
    shade.putalpha(card.getchannel("A").point(lambda p: p * alpha // 255))
    shadow.alpha_composite(shade, (xy[0] + offset[0], xy[1] + offset[1]))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(shadow)
    base.alpha_composite(card, xy)


def pill(draw, box, label, fill, text_fill=NAVY, outline=None, size=18):
    draw.rounded_rectangle(box, radius=(box[3] - box[1]) // 2, fill=fill, outline=outline, width=2)
    draw.text(((box[0] + box[2]) / 2, (box[1] + box[3]) / 2), label, font=font(size, True), fill=text_fill, anchor="mm")


def save(base, filename):
    path = OUT / filename
    base.convert("RGB").save(path, quality=96)
    return path


def build_canva_html(paths):
    labels = [
        "01 — Découvrir l’univers",
        "02 — Safe Place",
        "03 — Découvrir les livres",
    ]
    pages = []
    for label, path in zip(labels, paths):
        encoded = base64.b64encode(Path(path).read_bytes()).decode("ascii")
        pages.append(
            f'<section data-document-role="page" data-label="{label}">'
            f'<img src="data:image/png;base64,{encoded}" alt="{label}">'
            '</section>'
        )
    html = """<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}
section[data-document-role="page"]{width:1080px;height:1350px;margin:0;overflow:hidden;page-break-after:always}
section[data-document-role="page"] img{display:block;width:1080px;height:1350px;object-fit:cover}
</style></head><body>""" + "".join(pages) + "</body></html>"
    target = OUT / "kawaii-muslim-campagne-instagram-3-pages.html"
    target.write_text(html, encoding="utf-8")
    return target


def post_discovery():
    base = Image.new("RGBA", (W, H), CREAM + (255,))
    d = ImageDraw.Draw(base)
    d.ellipse((790, -180, 1190, 220), fill=(246, 230, 245))
    d.ellipse((-210, 530, 150, 900), fill=(235, 239, 255))
    base.alpha_composite(logo(), (68, 48))
    pill(d, (720, 64, 1010, 116), "OUVERTURE PROCHAINE", LAVENDER, PINK, size=16)

    d.text((68, 188), "Et si le temps d’écran", font=font(67, True), fill=NAVY)
    d.text((68, 264), "devenait un moment", font=font(67, True), fill=NAVY)
    d.text((68, 340), "qui a du sens ?", font=font(67, True), fill=PINK)
    d.text((70, 430), "Lire  •  créer  •  apprendre  •  se recentrer", font=font(27), fill=MUTED)

    screen = rounded(Image.open(ASSETS / "landing-today.webp"), (410, 663), 32)
    frame = Image.new("RGBA", (434, 687), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle((0, 0, 433, 686), 38, fill=WHITE)
    frame.alpha_composite(screen, (12, 12))
    paste_shadow(base, frame, (323, 500), 24, (0, 18), 52)

    cover = rounded(Image.open(BOOKS / "miracles-du-coran" / "library-cover.png"), (260, 260), 25)
    paste_shadow(base, cover, (72, 720), 18, (0, 12), 45)
    coloring = rounded(Image.open(ASSETS / "coloring-armure-lumiere.png"), (250, 250), 25)
    paste_shadow(base, coloring, (760, 790), 18, (0, 12), 45)

    d.rounded_rectangle((68, 1160, 680, 1268), 28, fill=PINK)
    d.text((374, 1214), "DÉCOUVRIR L’UNIVERS", font=font(29, True), fill=WHITE, anchor="mm")
    d.text((718, 1183), "Le site est ouvert", font=font(22, True), fill=NAVY)
    d.text((718, 1221), "en avant-première", font=font(22), fill=MUTED)
    return save(base, "post-01-decouverte-gratuite.png")


def post_safe_place():
    base = Image.new("RGBA", (W, H), (248, 244, 252, 255))
    d = ImageDraw.Draw(base)
    d.rounded_rectangle((0, 0, W, 330), 0, fill=NAVY)
    d.ellipse((780, -150, 1160, 230), fill=(47, 55, 120))
    base.alpha_composite(logo(), (68, 45))
    pill(d, (690, 62, 1010, 116), "POUR TOUTE LA FAMILLE", (47, 55, 120), WHITE, size=16)
    d.text((68, 170), "Quand le cœur", font=font(68, True), fill=WHITE)
    d.text((68, 245), "en a besoin.", font=font(68, True), fill=(244, 178, 214))

    d.text((70, 375), "Safe Place", font=font(35, True), fill=PINK)
    d.text((70, 428), "Des invocations à écouter, apprendre", font=font(32, True), fill=NAVY)
    d.text((70, 470), "et retrouver facilement.", font=font(32, True), fill=NAVY)

    # Preserve the real 974:900 aspect ratio; never stretch the Safe Place screen.
    safe = rounded(Image.open(ASSETS / "landing-safe-place.webp"), (700, 647), 30)
    paste_shadow(base, safe, (190, 520), 25, (0, 18), 52)

    d.rounded_rectangle((70, 1200, 650, 1308), 28, fill=PINK)
    d.text((360, 1254), "DÉCOUVRIR SAFE PLACE", font=font(29, True), fill=WHITE, anchor="mm")
    d.text((700, 1225), "Ouverture", font=font(22, True), fill=NAVY)
    d.text((700, 1262), "prochaine", font=font(22), fill=MUTED)
    return save(base, "post-02-safe-place-famille.png")


def post_library():
    base = Image.new("RGBA", (W, H), NAVY + (255,))
    d = ImageDraw.Draw(base)
    for x, y, r in [(90, 180, 5), (980, 240, 7), (890, 600, 4), (130, 720, 6), (960, 1120, 5)]:
        d.ellipse((x-r, y-r, x+r, y+r), fill=GOLD)
    d.ellipse((810, -180, 1210, 220), outline=(63, 72, 145), width=3)
    base.alpha_composite(logo(), (68, 45))
    pill(d, (718, 64, 1010, 116), "OUVERTURE PROCHAINE", (43, 51, 112), WHITE, size=16)

    d.text((68, 185), "Une bibliothèque", font=font(71, True), fill=WHITE)
    d.text((68, 265), "qui grandit chaque mois.", font=font(64, True), fill=(244, 178, 214))
    d.text((70, 356), "Histoires  •  découvertes  •  coloriages", font=font(27), fill=(209, 211, 232))

    covers = [
        (OUT / "tawakkul-cover-user.png", (62, 500), (250, 250)),
        (BOOKS / "miracles-du-coran" / "library-cover.png", (314, 445), (280, 280)),
        (ASSETS / "coloring-bubble-tea.png", (600, 500), (250, 250)),
        (ASSETS / "cover-exploration-espace.png", (116, 755), (245, 245)),
        (ASSETS / "cover-animaux-coran.png", (420, 745), (260, 260)),
        (ASSETS / "cover-hijabi-girls.png", (720, 755), (245, 245)),
    ]
    for path, xy, size in covers:
        card = rounded(Image.open(path), size, 24)
        paste_shadow(base, card, xy, 18, (0, 14), 65)

    d.text((70, 1055), "Livres interactifs + activités créatives", font=font(31, True), fill=WHITE)
    d.text((70, 1105), "Chaque enfant retrouve sa progression.", font=font(25), fill=(209, 211, 232))
    d.rounded_rectangle((70, 1180, 660, 1288), 28, fill=PINK)
    d.text((365, 1234), "DÉCOUVRIR LES LIVRES", font=font(30, True), fill=WHITE, anchor="mm")
    d.text((705, 1200), "Le site est ouvert", font=font(20), fill=(209, 211, 232))
    d.text((705, 1232), "en avant-première", font=font(25, True), fill=WHITE)
    return save(base, "post-03-bibliotheque-mensuelle.png")


if __name__ == "__main__":
    generated = (post_discovery(), post_safe_place(), post_library())
    for path in generated:
        print(path)
    print(build_canva_html(generated))
