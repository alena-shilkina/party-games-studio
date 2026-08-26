/* ══════════════════════════════════════════════════════════════════
   PARTY GAMES STUDIO — single-file article generator
   Reuses proven patterns from PCC Studio v4 + Fashion Content Studio.
   ══════════════════════════════════════════════════════════════════ */
const $=id=>document.getElementById(id);
const v=id=>($(id)?.value||'').trim();
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* ---------- PIN STYLE PRESETS (from pin generator; {TITLE},{BG}) ---------- */
/* ---------- PIN LAYOUTS: 4 distinct designs auto-assigned to the 4 pins ----------
   Different composition per pin so Pinterest never sees them as duplicates.
   Readability is enforced in every layout: very large, bold, high-contrast text. */
const READ='The headline text must be VERY LARGE, bold, high-contrast and instantly readable on a phone screen, occupying a big share of the pin.';
// Course-based style: bright high-contrast VECTOR art with an expressive character; no photorealistic people
const NO_YELLOW='Colour grade: clean, crisp, premium colours — NO muddy yellow/amber/sepia cast, no dingy off-white, no aged-paper tint. Whites are clean white, backgrounds are neutral or the theme palette. Avoid the cheap warm-yellow AI look. For Halloween use deep saturated orange, plum, charcoal and cream — never dull mustard yellow.';
const STYLE_VECTOR='Overall style: MODERN FLAT EDITORIAL ILLUSTRATION (contemporary Instagram-illustrator look, like June Jewell / trendy 2020s vector art) — NOT a Disney/Pixar 3D cartoon, NOT glossy. Flat 2D shapes, matte muted colours, minimal shading, simple geometric forms, subtle grain/paper texture, decorative background patterns, stylised faces (dot eyes, rosy cheeks). Feature ONE expressive character with a strong positive emotion — surprise, joy, delight. The character can be a stylised person (e.g. a chic pregnant mom-to-be, cheerful friends) OR any modern illustrated figure; not limited to parenting scenes. Only rule: NEVER a photograph of a real person or a photorealistic face.';
const STYLE_PHOTO='Overall style: bright, high-quality PHOTOREALISTIC flat-lay of themed props and objects with shallow depth of field — NO people, NO faces, objects only. The headline is large and bold with a thick contrasting outline (or on a solid panel) for maximum legibility over the photo.';
// Course-based colour discipline (skipped for holidays that own a fixed palette)
const COLOR_RULE='Use only 2-3 main colours plus one accent — no more — for a clean, high-contrast look.';
const CTA_EL='Below the headline there MUST be a small pill-shaped button in the accent color with the short white text "{CTA}" — clearly visible.';
const PIN_LAYOUTS=[
  {id:'panel-top',
   prompt:`Pinterest pin, vertical 2:3. {SCENE} {VIBE} A solid opaque banner panel across the TOP third of the pin; on it the headline "{TITLE}" in a large bold clean sans-serif. ${CTA_EL} ${READ} Sharp focus, high quality.`},
  {id:'panel-center',
   prompt:`Pinterest pin, vertical 2:3. {SCENE} {VIBE} A clean rounded banner panel centered; the headline "{TITLE}" fills it in a large bold display font. ${CTA_EL} ${READ} Sharp focus, high quality.`},
  {id:'outline-overlay',
   prompt:`Pinterest pin, vertical 2:3. {SCENE} {VIBE} NO panel — the headline "{TITLE}" is set directly over the illustration in huge bold hand-lettered type with a thick contrasting outline and soft shadow for legibility, dynamic layout with varied word sizes. ${CTA_EL} ${READ} Sharp focus, high quality.`},
  {id:'bottom-darken',
   prompt:`Pinterest pin, vertical 2:3. {SCENE} {VIBE} The lower third has a strong dark gradient; the headline "{TITLE}" runs across the bottom in very large bold clean sans-serif in white. ${CTA_EL} ${READ} Sharp focus, high quality.`}
];

/* ---------- PIN PALETTE ---------- */
// Tailwind "Pinteresty" palette — soft light backgrounds + one bold accent (proven high-performers).
const TAILWIND_PALETTE='Use the proven Pinterest palette: a soft light background (e.g. #f5f1ee #f9f5f2 #eae6f7 #efd0d7 #e2e1cd) paired with ONE bold accent (e.g. #e86a87 #488691 #99b9d0 #a97a37 #dab5f4 #ffae9d), plus dark charcoal text. Soft base + single strong accent, high contrast.';

/* ---------- СТИЛЬ ПЕЧАТНЫХ ЛИСТОВ ----------
   Своего встроенного стиля у приложения больше нет. Стиль задаётся ТОЛЬКО приложенным
   референсом: Claude разбирает его подробно — техника, палитра, рамка, мотивы, шрифт, —
   и этот контракт держит весь набор ровным. Если референса нет, лист рисуется по описанию
   от Claude и решению генератора; мы не подсовываем ни пресетов, ни «фирменной» манеры.
   Встроенные пресеты приносили ботанику и вензеля по углам, поэтому их и убрали. */
