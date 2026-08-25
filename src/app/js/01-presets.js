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

/* ---------- VIBES: palette + decor per holiday / celebration (auto-detected, overridable) ----------
   fixed:true = the holiday owns its palette, so the "2-3 colours" rule is NOT applied. */
const PIN_VIBES={
  'Auto':{block:''},
  'Neutral':{block:'Soft, tasteful party mood with minimal props.'},
  // Holidays (fixed palettes)
  'Christmas':{fixed:true,block:'Cozy Christmas vibe: palette of deep pine green #1e5631, cranberry red #a4243b, warm gold #c8a24a and cream; evergreen sprigs, ornaments and soft string lights as decor.'},
  'Halloween':{fixed:true,block:'Cute-not-scary Halloween vibe: palette of warm cream, muted pumpkin orange #d98a5c, dusty plum #8a6b8f and soft black; little pumpkins, friendly ghosts, bats and autumn leaves as decor.'},
  'Easter':{fixed:true,block:'Fresh Easter vibe: pastel palette of soft lilac, mint, butter yellow and sky blue; painted eggs, tulips and bunnies as gentle decor.'},
  "Valentine's Day":{fixed:true,block:"Romantic Valentine's vibe: palette of soft rose #e8a5b0, cherry red #c8354b, blush and cream; hearts, roses and ribbon as decor."},
  'Thanksgiving':{fixed:true,block:'Warm Thanksgiving vibe: palette of burnt orange #c26b34, deep mustard #d9a441, chestnut brown and cream; pumpkins, wheat, autumn leaves and berries as decor.'},
  'Hanukkah':{fixed:true,block:'Festive Hanukkah vibe: palette of deep royal blue #1c3f94, crisp white, warm gold #c8a24a and soft silver; a lit menorah, spinning dreidels, Star of David motifs and gelt coins with a gentle candle glow as decor.'},
  "St. Patrick's Day":{fixed:true,block:"Festive St. Patrick's vibe: palette of shamrock green #2e7d4f, gold #c8a24a and cream; clovers, horseshoes and gold coins as playful decor."},
  '4th of July':{fixed:true,block:'Patriotic 4th of July vibe: palette of navy #1f3a5f, classic red #b23a48, and cream white; stars, stripes and sparklers as decor.'},
  'New Year':{fixed:true,block:'Sparkling New Year vibe: palette of black, champagne gold #c8a24a and silver; confetti, stars and glasses as elegant decor.'},
  // Parties & celebrations — colours come from the Tailwind palette; only decor/motifs here
  'Baby Showers':{block:'Sweet baby shower mood; tiny baby items, soft clouds and gentle florals as decor.'},
  'Birthday Parties':{block:'Cheerful birthday mood; balloons, confetti and streamers as decor.'},
  'Bridal Showers':{block:'Elegant bridal shower mood; roses, ribbon and delicate florals as refined decor.'},
  'Gender Reveals':{block:'Playful gender reveal mood; balloons, confetti and question-mark motifs as decor.'},
  'Graduations':{block:'Proud graduation mood; caps, stars and confetti as celebratory decor.'},
  'Anniversaries':{block:'Romantic anniversary mood; roses, candles and delicate sparkle as elegant decor.'}
};
let activeVibe='Auto';
// Tailwind "Pinteresty" palette — soft light backgrounds + one bold accent (proven high-performers).
// Applied to non-holiday vibes; holidays keep their own fixed palette.
const TAILWIND_PALETTE='Use the proven Pinterest palette: a soft light background (e.g. #f5f1ee #f9f5f2 #eae6f7 #efd0d7 #e2e1cd) paired with ONE bold accent (e.g. #e86a87 #488691 #99b9d0 #a97a37 #dab5f4 #ffae9d), plus dark charcoal text. Soft base + single strong accent, high contrast.';
// match a CSV/user value to a real PIN_VIBES key regardless of case/spacing ("neutral" → "Neutral")
function normVibe(name){
  const s=String(name||'').trim();
  if(!s) return 'Auto';
  const hit=Object.keys(PIN_VIBES).find(k=>k.toLowerCase()===s.toLowerCase());
  return hit||s;
}
// the vibe actually in force. An EXPLICIT pin_vibe always wins; only 'Auto' falls back to detection.
function resolvedVibeName(){
  const set=normVibe(activeVibe);
  return set==='Auto' ? detectVibe(v('mainKW'),v('category')) : set;
}
// when the vibe is neutral, seasonal decor must be actively suppressed — otherwise the model drifts
// back to Christmas/Halloween props because "party" imagery is so often holiday imagery in training data
const NO_SEASONAL='NOT SEASONAL — this is a neutral, non-holiday article. Use NO holiday motifs, props or palettes of any kind: no Christmas trees, evergreen sprigs, holly, ornaments, string lights, candy canes, snowflakes, Santa or winter scenes; no pumpkins, bats or Halloween decor; no Easter eggs, turkeys, hearts, fireworks or New Year countdown props. Keep decoration generic, tasteful and season-free.';
function isNeutralVibe(){ return resolvedVibeName()==='Neutral'; }
function vibeIsFixed(){ const name=resolvedVibeName(); return !!(PIN_VIBES[name]&&PIN_VIBES[name].fixed); }
// auto-detect vibe from the keyword text, then the category
function detectVibe(kw,category){
  const s=((kw||'')+' '+(category||'')).toLowerCase();
  const map=[['christmas','Christmas'],['xmas','Christmas'],['halloween','Halloween'],['easter','Easter'],
    ['valentine',"Valentine's Day"],['thanksgiving','Thanksgiving'],['hanuk','Hanukkah'],['chanuk','Hanukkah'],['patrick',"St. Patrick's Day"],
    ['july','4th of July'],['fourth of july','4th of July'],['new year','New Year'],
    ['gender reveal','Gender Reveals'],['bridal','Bridal Showers'],['baby shower','Baby Showers'],
    ['graduation','Graduations'],['anniversary','Anniversaries'],['birthday','Birthday Parties']];
  for(const [k,v2] of map){ if(s.includes(k)) return v2; }
  return 'Neutral';
}
function currentVibeBlock(){
  const name=resolvedVibeName();
  return (PIN_VIBES[name]&&PIN_VIBES[name].block)||PIN_VIBES['Neutral'].block;
}

/* ---------- СТИЛЬ ПЕЧАТНЫХ ЛИСТОВ ----------
   Своего встроенного стиля у приложения больше нет. Стиль задаётся ТОЛЬКО приложенным
   референсом: Claude разбирает его подробно — техника, палитра, рамка, мотивы, шрифт, —
   и этот контракт держит весь набор ровным. Если референса нет, лист рисуется по описанию
   от Claude и решению генератора; мы не подсовываем ни пресетов, ни «фирменной» манеры.
   Встроенные пресеты приносили ботанику и вензеля по углам, поэтому их и убрали. */
