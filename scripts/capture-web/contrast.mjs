// WCAG text contrast of a rendered Expo web page (used by lib.mjs when CONTRAST=1).

/** Composites everything under each text element's centre and computes WCAG contrast. */
export async function measure(page) {
  // Decorative layers (gloss, frost, gradients) are pointer-events:none, which hides them from elementsFromPoint.
  await page.addStyleTag({ content: '*{pointer-events:auto!important}' }).then((h) => h.evaluate((n) => n.setAttribute('data-measure', '1')));
  try { return await page.evaluate(() => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
    const out = [];
    const seen = new Set();
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
    for (const el of document.querySelectorAll('body *')) {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
      if (!own || !vis(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      const x = Math.min(innerWidth - 1, Math.max(0, rect.left + Math.min(rect.width / 2, 12))), y = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const stack = document.elementsFromPoint(x, y);
      if (!stack[0] || !(stack[0] === el || el.contains(stack[0]))) continue; // covered by something else (another tab, a sheet, a scrim)
      const layers = [];
      let image = false;
      for (const s of stack) {
        if (s === el || el.contains(s)) continue;
        const sc = getComputedStyle(s);
        if (s.tagName === 'IMG' || s.tagName === 'CANVAS' || s.tagName === 'svg' || (sc.backgroundImage && sc.backgroundImage !== 'none' && !sc.backgroundImage.includes('gradient'))) { if (s.tagName === 'IMG' || s.tagName === 'CANVAS' || sc.backgroundImage.includes('url')) { image = true; } }
        const bg = parse(sc.backgroundColor);
        let o = Number(sc.opacity);
        if (bg && bg.a > 0) { layers.push({ ...bg, a: bg.a * o, tag: s.tagName, testid: s.closest('[data-testid]')?.getAttribute('data-testid') ?? '' }); if (bg.a * o >= 0.999) break; }
        if (sc.backgroundImage.includes('gradient')) { const m = sc.backgroundImage.match(/rgba?\([^)]+\)/); if (m) { const g = parse(m[0]); layers.push({ ...g, tag: 'GRAD', testid: '' }); if (g.a >= 0.999) break; } }
      }
      let bg = { r: 255, g: 255, b: 255, a: 1 };
      const doc = parse(getComputedStyle(document.body).backgroundColor);
      if (doc && doc.a > 0) bg = doc;
      for (let i = layers.length - 1; i >= 0; i--) bg = blend(layers[i], bg);
      const fg0 = parse(cs.color);
      if (!fg0) continue;
      const fg = blend({ ...fg0, a: fg0.a * Number(cs.opacity) }, bg);
      const L1 = lum(fg), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize), weight = Number(cs.fontWeight) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const key = own + '|' + Math.round(rect.top);
      if (seen.has(key)) continue; seen.add(key);
      const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
      out.push({ text: own.slice(0, 60), fg: hex(fg0) + (fg0.a < 1 ? `@${fg0.a}` : ''), bg: hex(bg), bgFrom: layers[0] ? `${layers[0].tag}${layers[0].testid ? '#' + layers[0].testid : ''}` : 'body', ratio: Math.round(ratio * 100) / 100, size, large, image, top: Math.round(rect.top), testid: el.closest('[data-testid]')?.getAttribute('data-testid') ?? '' });
    }
    return out;
  }); } finally { await page.evaluate(() => document.querySelectorAll('style[data-measure]').forEach((n) => n.remove())); }
}
