"""Before | after comparison sheets. Usage: python3 compare.py <before-dir> <after-dir> (needs Pillow).
Each dir holds passenger/, driver/, passenger-dark/, driver-dark/ ... as the capture scripts write them.
The sheets are written into <after-dir>. ALIAS maps before names to the after names of the 15 Oct 2026 redesign run."""
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont
if len(sys.argv) != 3:
    sys.exit(__doc__)
B = os.path.abspath(sys.argv[1]); A = os.path.abspath(sys.argv[2])
def font(sz):
    for p in ['/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/SFNS.ttf']:
        try: return ImageFont.truetype(p, sz)
        except Exception: pass
    return ImageFont.load_default()
ALIAS = {('passenger', '15k-carwash-order-washing-live'): '15m-carwash-order-washing', ('passenger', '15l-carwash-order-completed-team'): '15n-carwash-order-completed',
         ('driver', '32c-ledger-deeplink-back-error'): '32c-ledger-detail', ('passenger', '18d-famille-trip-contact-sheet'): None, ('passenger', '07f-quote-schedule-picker'): '07e-quote-schedule-picker'}
W, H = 300, 649; PAD = 14; LBL = 34
def pairs(app, bdir=None, adir=None):
    bdir = bdir or app; adir = adir or app; out = []
    for f in sorted(glob.glob(f'{B}/{bdir}/*.png')):
        n = os.path.basename(f)[:-4]; an = ALIAS.get((app, n), n)
        a = f'{A}/{adir}/{an}.png' if an else None
        out.append((f'{bdir}/{n}', f, a if a and os.path.exists(a) else None))
    return out
def tile(path, label, fg, bg):
    im = Image.new('RGB', (W, H), (200, 200, 200) if path is None else bg)
    if path: im = Image.open(path).convert('RGB').resize((W, H), Image.LANCZOS)
    else: ImageDraw.Draw(im).text((20, H // 2), 'not captured', fill=(90, 90, 90), font=font(22))
    return im
def sheet(rows, out, title, cols=3):
    bg = (248, 247, 249); fg = (41, 35, 45)
    cw = 2 * W + 3 * PAD; rh = H + LBL + PAD
    nrows = (len(rows) + cols - 1) // cols
    img = Image.new('RGB', (PAD + cols * (cw + PAD), 70 + nrows * rh + PAD), bg); d = ImageDraw.Draw(img)
    d.text((PAD, 20), title, fill=fg, font=font(28))
    for i, (name, b, a) in enumerate(rows):
        x = PAD + (i % cols) * (cw + PAD); y = 70 + (i // cols) * rh
        d.rectangle([x - 4, y - 4, x + cw - 2 * PAD + 4, y + H + LBL], fill=(236, 233, 238))
        img.paste(tile(b, 'before', fg, bg), (x, y)); img.paste(tile(a, 'after', fg, bg), (x + W + PAD, y))
        d.text((x, y + H + 6), f'{name}   BEFORE | AFTER', fill=fg, font=font(17))
    img.save(out, optimize=True); print(out, img.size, len(rows))
groups = {
  'passenger': pairs('passenger'), 'driver': pairs('driver'),
  'dark': pairs('passenger-dark') + pairs('driver-dark'),
  'famille-approval': [(f'passenger/{n}', f'{A}/passenger/{n}.png', f'{A}/passenger-dark/{n}.png') for n in ['17b-home-approval-banner', '11f-wallet-approval-banner', '18f-famille-trip-awaiting-approval', '12e-famille-home-approval']] + [('passenger/16b-ride-driver-assigned (banner under the safety disc)', f'{B}/passenger/16b-ride-driver-assigned.png', f'{A}/passenger/16b-ride-driver-assigned.png'), ('passenger/16e-ride-sos-sheet-banner', None, f'{A}/passenger/16e-ride-sos-sheet-banner.png')],
}
for g, rows in groups.items():
    rows = [r for r in rows]
    per = 12
    for k in range(0, len(rows), per):
        sheet(rows[k:k + per], f'{A}/compare-{g}-{k // per + 1:02d}.png', f'Naya redesign · {g} · before | after · 390x844 @2x · 15 Oct 2026 · sheet {k // per + 1}')
# Large text: after only, beside the light after of the same screen.
lt = [('home', f'{A}/passenger/05a-home-idle.png', f'{A}/largetext/P1-home-idle.png'), ('quote', f'{A}/passenger/07a-quote.png', f'{A}/largetext/P2-quote.png'),
      ('live ride', f'{A}/passenger/16b-ride-driver-assigned.png', f'{A}/largetext/P3-ride-driver-assigned.png'), ('safety sheet', f'{A}/passenger/16o-ride-sos-sheet.png', f'{A}/largetext/P4-ride-sos-sheet.png'),
      ('home, ride active', f'{A}/textscale-1/P5-home-active-ride.png', f'{A}/largetext/P5-home-active-ride.png'), ('driver home', f'{A}/driver/20c-home-online.png', f'{A}/largetext/D1b-home-online.png'), ('offer', f'{A}/driver/21a-offer.png', f'{A}/largetext/D2-offer.png'), ('driver ride', f'{A}/driver/22a-ride-assigned.png', f'{A}/largetext/D3-ride-assigned.png')]
sheet(lt, f'{A}/compare-largetext.png', 'Naya redesign · default text | largest text (x1.6, emulated) · after', cols=3)
key = [('passenger', '05a-home-idle'), ('passenger', '07a-quote'), ('passenger', '16a-ride-searching'), ('passenger', '16b-ride-driver-assigned'), ('passenger', '16j-ride-completed-receipt'), ('passenger', '04c-verify-pending'),
       ('passenger', '11c-wallet'), ('passenger', '15n-carwash-order-completed'), ('driver', '20c-home-online'), ('driver', '21a-offer'), ('driver', '24a-home-debt-blocked'), ('driver', '31a-wallet')]
rows = [(f'{a}/{n}', f'{B}/{a}/{n}.png', f'{A}/{a}/{n}.png') for a, n in key]
sheet(rows, f'{A}/compare-overview.png', 'Naya redesign · 12 key screens · before | after (light)', cols=4)
