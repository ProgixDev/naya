"""Generates the fictional SPÉCIMEN documents used by the demo seed. Run from the repo root."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

F = 'node_modules/@expo-google-fonts/inter'
font = lambda w, size: ImageFont.truetype(f'{F}/{w}/Inter_{w}.ttf', size)
out = 'services/demo-api/fixtures'
A = 'packages/assets/characters'
INK = (46, 32, 44); MUTED = (117, 103, 117)

def card(name, title, lines, portrait=None, w=1000, h=630, tint=(240, 228, 236)):
    im = Image.new('RGB', (w, h), tint)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=36, outline=(214, 196, 208), width=4)
    d.text((48, 40), 'ROYAUME FICTIF · DOCUMENT DE DÉMONSTRATION', fill=MUTED, font=font('600SemiBold', 24))
    d.text((48, 84), title, fill=INK, font=font('700Bold', 44))
    x = 330 if portrait else 48
    if portrait:
        p = Image.open(portrait).convert('RGBA'); s = 250 / p.width; p = p.resize((250, int(p.height * s))).crop((0, 0, 250, 300))
        bg = Image.new('RGBA', (250, 300), (255, 255, 255, 255)); bg.alpha_composite(p); im.paste(bg.convert('RGB'), (48, 170))
    y = 180
    for k, v in lines:
        d.text((x, y), k.upper(), fill=MUTED, font=font('600SemiBold', 22)); d.text((x, y + 28), v, fill=INK, font=font('500Medium', 34)); y += 84
    wm = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(wm).text((w * 0.14, h * 0.44), 'SPÉCIMEN · FICTIF', fill=(107, 54, 87, 64), font=font('800ExtraBold', 76))
    im = Image.alpha_composite(im.convert('RGBA'), wm.rotate(16, resample=Image.BICUBIC)).convert('RGB')
    im.save(f'{out}/{name}.jpg', quality=86)

for who, full, birth, num, portrait in [('salma', 'Salma El Mansouri', '1996-04-12', 'AB123456', f'{A}/salma-portrait.png'), ('amina', 'Amina Bennani', '1988-09-03', 'CD654321', f'{A}/amina-portrait.png'), ('generic', 'Titulaire fictive', '1994-01-01', 'ZZ000000', None)]:
    card(f'{who}-id-front', "Carte d’identité", [('Nom', full), ('Née le', birth), ('N° de document', num)], portrait)
    card(f'{who}-id-back', 'Carte d’identité · verso', [('Adresse', 'Adresse fictive, Rabat'), ('Valable jusqu’au', '2031-12-31'), ('Mention', 'Aucune donnée réelle')])
card('amina-licence', 'Permis de conduire', [('Titulaire', 'Amina Bennani'), ('Catégorie', 'B'), ('Délivré le', '2012-06-18')], f'{A}/amina-portrait.png')
card('generic-licence-blurry', 'Permis de conduire', [('Titulaire', 'Photo floue'), ('Catégorie', 'B'), ('Délivré le', '—')])
Image.open(f'{out}/generic-licence-blurry.jpg').filter(ImageFilter.GaussianBlur(9)).save(f'{out}/generic-licence-blurry.jpg', quality=80)
card('vehicle-registration', 'Carte grise', [('Véhicule', 'Naya Signature · Perle'), ('Immatriculation', 'DÉMO-001'), ('Mise en circulation', '2024-02-01')], tint=(236, 238, 242))
card('vehicle-registration-2', 'Carte grise', [('Véhicule', 'Naya Signature · Prune'), ('Immatriculation', 'DÉMO-002'), ('Mise en circulation', '2023-05-14')], tint=(236, 238, 242))
card('insurance', 'Attestation d’assurance', [('Assurée', 'Titulaire fictive'), ('Validité', '2026-01-01 → 2026-12-31'), ('Compagnie', 'Assureur fictif')], tint=(238, 242, 236))
for c in ['pearl', 'plum']:
    src = Image.open(f'packages/assets/cars/naya-signature-{c}.png').convert('RGBA')
    bg = Image.new('RGBA', src.size, (236, 232, 236, 255)); bg.alpha_composite(src); bg.convert('RGB').save(f'{out}/vehicle-{c}.jpg', quality=84)
for who in ['salma', 'amina']:
    src = Image.open(f'{A}/{who}-portrait.png').convert('RGBA')
    bg = Image.new('RGBA', src.size, (232, 222, 230, 255)); bg.alpha_composite(src); bg.convert('RGB').save(f'{out}/{who}-selfie.jpg', quality=86)
print('fixtures ok')
