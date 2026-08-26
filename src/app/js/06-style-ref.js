/* ---------- INFOGRAPHIC STYLE REFERENCE + CLAUDE VISION ---------- */
function loadRef(e){
  const f=e.target.files[0]; if(!f)return;
  const rd=new FileReader();
  rd.onload=async()=>{
    ST.refDataUri=rd.result;
    ST.baseRef=rd.result;      // attached by hand → default for rows that have no reference of their own
    $('refPreview').innerHTML=`<div style="display:flex;gap:8px;align-items:center">
      <img src="${rd.result}" style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:2px solid var(--coral)">
      <button class="btn btn-ghost btn-sm" onclick="analyzeRef()">🔍 Re-read style</button>
      <button class="btn btn-ghost btn-sm" onclick="clearRef()">Clear</button></div>`;
    $('styleBlock').style.display='block';
    if(keyReady('claude')) await analyzeRef(); else toast('Add a Claude key to auto-describe the style','err');
  };
  rd.readAsDataURL(f);
}
// Claude Vision writes a COMPACT style block: technique + colors + motifs only
async function analyzeRef(){
  if(!ST.refDataUri){toast('Load a reference first','err');return;}
  if(!keyReady('claude')){toast('Add a Claude key in Settings','err');return;}
  const m=ST.refDataUri.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/); if(!m){toast('Unsupported image','err');return;}
  $('styleBlock').value='Reading style…';
  try{
    const sys=styleVisionSys();
    const res=await fetch('/api/claude',{method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':v('claudeKey'),'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:400,system:sys,
        messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:m[1],data:m[2]}},{type:'text',text:'Write the compact STYLE line.'}]}]})});
    const j=await res.json();
    if(j.error) throw new Error(j.error.message||'Claude error');
    const txt=cleanStyleBlock((j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim());
    $('styleBlock').value=txt||''; ST.styleBlock=txt||'';
    if(ST.baseRef===ST.refDataUri) ST.baseStyle=txt||'';   // remember the hand-attached reference's style
    toast('Style described','ok');
  }catch(e){ $('styleBlock').value=''; toast('Vision: '+e.message,'err'); }
}
function clearRef(){ST.refDataUri=null;ST.styleBlock='';ST.baseRef=null;ST.baseStyle='';$('refPreview').innerHTML='';$('styleBlock').value='';$('styleBlock').style.display='none';$('refFile').value='';}
// append the current (possibly hand-edited) style block to an image prompt
// domain of the active site, for the on-image footer/watermark
function siteDomain(){ const s=getSite(); if(!s)return''; try{return new URL(s.url).hostname.replace(/^www\./,'');}catch(e){return (s.url||'').replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/^www\./,'');} }
function siteFooter(){ const d=siteDomain(); return d?`\n\nAt the very bottom center, add a small, subtle footer text reading "${d}" in a tiny unobtrusive font.`:''; }
// append the shared style block (reference-derived > preset > auto) + site footer to an image prompt
// Референс для печатного листа: приложенный вручную или к строке — главнее всего,
// иначе берётся картинка из библиотеки стилей по выбранному стилю. Фотографии сюда
// не попадают: у них свой контракт и референс им не передаётся.
function sheetRef(){ return ST.refDataUri; }
// Единственное, что мы навязываем всегда — тёплый фон и чистый белый. Остальное решают
// Claude в описании листа и генератор картинки. Свой встроенный стиль мы больше
// не подсовываем: именно он приносил веточки и цветочки по углам.
// «soft tinted ground» здесь раньше ограничивало насыщенность и спорило с плотной
// карточкой рецепта. Запрет на тёплый грязно-белый и на голый белый остаётся, а сила
// цвета теперь за темой: приглушённый лист и яркий одинаково допустимы.
const BACKGROUND_RULE='BACKGROUND: the sheet must NOT sit on yellow, cream, ivory, beige, butter, sand, tan or any warm off-white ground; those read as cheap and dated. Plain white is also wrong. Use a tinted ground instead, at whatever strength the theme calls for, from a quiet wash to a fully saturated colour, and keep it identical across every sheet of this set.';
/* Домашний стиль печаток. Применяется ТОЛЬКО когда референс не назначен, и только к
   печатному материалу: фотографии уходят по ветке PHOTO_CONTRACT и его не видят.
   Разобран с трёх образцов современной иллюстрации, присланных 26 августа 2026:
   «Childhood Noel», «season food» и «Hand-drawn Quirky Christmas Whimsy». Общее у всех
   трёх: светлая бумага с зерном, акварель и гуашь с настоящим поведением пигмента,
   приглушённая палитра, много воздуха, рукописная типографика, полностью матовая печать.
   Мотивы намеренно НЕ названы: их даёт тема листа, а не приложение. */
const DEFAULT_SHEET_STYLE=`HOUSE ILLUSTRATION STYLE. No style reference is attached to this sheet, so draw it in the house style described here, and follow it as strictly as you would follow a reference image.

MEDIUM: hand-painted watercolour and gouache with real pigment behaviour. Soft blooms where colour pools, edges that move from crisp to feathered inside one shape, visible brush direction, an occasional dry-brush break along an edge, granulation settling in the deeper washes. Thin pencil or fine ink linework only where a shape genuinely needs definition, never a uniform outline traced around everything. Flat matte shapes with no outline may sit alongside the painted pieces, and they stay equally matte.

GROUND: pale paper with a faint tooth or speckle so it reads as real uncoated stock rather than a digital fill. Neutral to barely cool. NOT clinical pure white, and NOT yellow, butter, cream, ivory, sand or tan; the paper never carries a warm dirty tint.

PALETTE: LOAD THE BRUSH. This is the part to get wrong in the generous direction, not the timid one. Pigment is heavy and present: colour goes down at full strength, deep where the wash pools at an edge, and it holds its intensity instead of thinning into a tint. Think of paint straight from the pan with just enough water to move it, not a wash you can see the paper through.

Pick two or three colours that genuinely SING together and let them carry the sheet at real saturation: a deep rose against a strong sage, a warm terracotta beside a proper cobalt, a saturated mustard next to a clean teal. Supporting colours may sit quieter, but the leads never do. Pale, dusty and greyed-down is the wrong sheet: if you are unsure, put more pigment on.

The one thing the paint is not is synthetic. No neon, no fluorescent, no digital glow, no plastic sheen, no airbrushed gradient blends. Strong and joyful is right, and so is a bright childlike palette when the sheet is for children. What is wrong is chalky, washed out, or afraid of colour. The drawing itself stays crisp, confident and contemporary, made by an illustrator working today.

FINISH: completely matte, as if printed on uncoated paper. The gradation that happens inside a wet wash is right and wanted; what is wrong is a smooth digital gradient fill. No glow, no drop shadows, no bevels, no 3D rendering, no glossy highlights, no digital airbrush, no vector gloss.

COMPOSITION: generous breathing space. Elements sit as separate spot illustrations with paper visible between them, never packed edge to edge.

NO CORNER ORNAMENT, and this rule outranks any instinct you have about how a printable of this kind usually looks. Do NOT place a floral spray, a leafy sprig, a lavender stem, a eucalyptus branch, a botanical wreath, a laurel, a vine, a mirrored bouquet or any ornamental cluster in the corners or along the edges. Do NOT frame the sheet with a decorative border, and do NOT balance one corner against the opposite one. The corners of this sheet are empty paper. Every illustration on the sheet earns its place by being the SUBJECT the sheet is actually about, drawn where the layout needs it, never as decoration filling the margins.

TYPE: hand-lettered in feel. A relaxed script or cursive for short supporting lines, and a light, generously letter-spaced serif or hand-drawn capitals for headings. Type sits directly on the paper rather than inside a heavy filled box.

PEOPLE AND ANIMALS, where the sheet calls for them: painted in the same medium, soft and gentle, faces kept simple and calm rather than heavily detailed or cartoon-exaggerated.`;

// Стиль берётся из референса, а если его нет, из домашнего стиля выше.
function styleText(){
  return (v('styleBlock')||ST.styleBlock||'').trim();
}
const RICH_SHEET='RICHNESS — this is a premium downloadable printable, not a plain title card. Every sheet must carry the FULL decorative system from the style contract: the layered border/frame, the patterned band, ornamental rules or dividers, and at least one illustrated motif or vignette drawn in the contract technique. Compose it as a properly designed page: a focal illustration, a strong heading with real typographic hierarchy, supporting text sized against it, and ornament filling what would otherwise be dead space. NEVER output a bare heading floating inside an empty rectangle, and never leave a large blank area — fill it with the motifs named in the contract.';
// Travels with every styled sheet. The style contract tells the model HOW to draw and WHAT KIND of
// objects to draw; this tells it that the artwork itself must be its own, not a copy of anything.
const ORIGINALITY='ORIGINAL ARTWORK: draw every element from scratch in the technique described above. Invent your own icons, poses, arrangements and compositions that merely BELONG to the motif world named in the contract — do not reproduce, trace or closely imitate any existing clipart set, sticker pack, illustration or layout. No trademarked or copyrighted characters, mascots, logos, brand names, monograms or emblems anywhere on the sheet, including on any clothing, packaging or props drawn in it.';
// Used when the reference IMAGE itself is attached to the generation. The reference is what makes the
// look land, so it stays — but the model is told to behave like the illustrator of that series drawing
// the NEXT piece, rather than a copier rearranging the icons that are already there.
const REF_ORIGINALITY=`HOW TO USE THE ATTACHED REFERENCE IMAGE — it is a STYLE SAMPLE from an illustrated series, not content to reproduce. You are the illustrator of that series, drawing a NEW piece for it.
- MATCH: the drawing technique, line weight and quality, fill and shading style, level of detail, palette, and the general FAMILY of objects the series is about.
- INVENT: all the icons on this sheet must be your own new drawings. Choose DIFFERENT objects from within that same world, at different angles, sizes and arrangements than the reference uses. Where the reference shows one object from a category, draw a different member of that category.
- NEVER: copy, trace, cut out, re-crop, mirror or re-place any individual icon, figure, mascot or decorative element from the reference; never repeat its layout or composition; never reproduce any text, wordmark or signature visible in it.
- The finished sheet should look like it belongs beside the reference on a shelf — clearly the same series, obviously not the same page.
- No trademarked or copyrighted characters, mascots, logos, brand names, monograms or emblems anywhere, including on clothing, packaging or props drawn in the artwork.`;
// Третий режим: переносим не только манеру рисунка, но и самих героев. Нужен, когда
// в референсе есть персонаж, который должен остаться персонажем — мишка не должен
// превращаться в зайца только потому, что повторять предметы из референса запрещено.
const MOTIF_ORIGINALITY=`HOW TO USE THE ATTACHED REFERENCE IMAGE — you are illustrating the NEXT sheet of the SAME series, and this series keeps its cast of characters and objects.
- MATCH: the drawing technique, line weight, fills and shading, palette and border treatment — AND the recurring subjects named in the style contract above. If the series is built around a teddy bear, this sheet carries that same teddy bear. Do not swap it for a different animal or object.
- REDRAW, DO NOT COPY: draw those subjects yourself, in NEW poses, angles, sizes and arrangements that suit this sheet. Never trace, cut out, mirror or re-place an element from the reference, and never repeat its layout or composition.
- VARY the supporting props and their placement so the sheets are not identical, but keep the lead subject recognisably the same across the whole set.`;
// which originality clause travels with a styled sheet, depending on the chosen reference mode
function originalityClause(explicit){
  // Правило зависит от того, ЕСТЬ ли референс на самом деле: без него нельзя писать
  // «используй приложенную картинку». Раньше это решал режим, и без референса
  // в промпт всё равно попадала инструкция про несуществующее изображение.
  if(!sheetRef()) return ORIGINALITY;
  return (explicit||refModeNow())==='motifs' ? MOTIF_ORIGINALITY : REF_ORIGINALITY;
}
// Листы одной статьи рисуются РАЗНЫМИ запросами: генератор не видит соседние листы
// и не знает, что он там нарисовал. Единственное, что держит комплект вместе, — этот
// текст, одинаковый во всех запросах. Поэтому он перечисляет всё поимённо: шрифты,
// рамку, поля, мотивы. Общего «сделай в одном стиле» тут не хватает.
const STYLE_LOCK='CONSISTENCY — THIS SHEET IS ONE PAGE OF A MATCHING SET, and the buyer will see all of them side by side. Someone flipping through the pack must not be able to tell which sheet was made first. Everything below is IDENTICAL on every sheet of this article:\n'
+'- THE HAND: the same medium, line quality, edge treatment, shading and level of finish described above. Never switch technique between sheets.\n'
+'- THE TYPE: the SAME two typefaces throughout — one display face for the sheet title, one quiet face for body text and labels. The same weights, the same capitalisation habit, the same title treatment and the same relative sizes. Never a different lettering style, never hand-lettering on one sheet and a typeface on another.\n'
+'- THE COLOURS: the same ground and the same accent family on every sheet.\n'
+'- THE FRAME: the same border or frame treatment, the same corner behaviour and the same page margins, so the sheets stack evenly.\n'
+'- THE MOTIFS: the same family of decorative elements, drawn fresh each time but recognisably from one set — if one sheet has painted botanical sprigs in the corners, they all do.\n'
+'Only the CONTENT changes from sheet to sheet. '
+'THE SHEET DESCRIPTION IS CONTENT, NOT STYLE: if it mentions a drawing technique, a colour, a background, a line weight, a mood, or the word "clean", ignore that word completely and draw the sheet in the style contract above. The style contract wins over every style word anywhere else in this prompt.';
// Editorial photography contract — used for "illustration" assets (cakes, arches, tablescapes, dishes).
// These are PHOTOGRAPHS, not designed sheets, so they must never receive the printable style contract,
// the "SHEET TO DRAW" framing or the site footer: that is what made them flat, white and lifeless.
const PHOTO_CONTRACT=`EDITORIAL PHOTOGRAPHY — this is a photograph for a magazine feature, NOT a printable sheet, NOT flat vector art, NOT an illustration.
- SHOOT WHAT THE PARAGRAPH DESCRIBES, nothing else. The scene is whatever that idea actually is: a gift basket on a bed, a shelf of jars, a lit corner of a room, a plated dish, a wrapped parcel, a dressed table. Style it the way a magazine would style THAT subject, with props that belong to it. Do not add party decor, balloons, cake or confetti unless the idea is itself about them.
- LIGHT: daylight, and the SHOT line at the end decides what kind. Sunshine is not only allowed, it is often what the picture needs: direct sun through a window with real patches and defined shadow edges, a bright airy room, the warm low sun of late afternoon. Soft overcast light is ONE option among several, not the default. The picture should read as a bright, cheerful day unless the subject genuinely calls for something quieter. Realistic materials and textures throughout (frosting, fabric, paper, foliage, balloon latex).
- Rich, warm, inviting mood — the kind of picture that makes the reader want to copy it, and the kind of picture a person associates with a celebration. Never a bare object floating on an empty white background, never a clip-art or infographic look. Never grey, flat, dim or wintry-gloomy unless the idea itself is about that.
- Composition: the whole subject fits inside the frame with comfortable breathing room; nothing is cropped awkwardly or runs off the edge.
- PHYSICAL PLAUSIBILITY: everything must be buildable and complete, resting on a real surface and obeying gravity. Nothing is fused into a wall, broken, warped, floating or trailing off the edge. Stacked or tiered things sit level and hold together.
- NO people, no hands, no faces. NO text, letters, numbers, captions, watermarks or logos anywhere in the image. No brand labels.
- PHOTOREALISM — this must look like a real photograph taken by a magazine photographer, not a render. CAMERA: a real camera and a real lens, held by a person standing where a person would stand. Choose the angle and the distance that suit what is being photographed, and keep enough of the setting in frame that the reader can see where the thing lives. Never blur the room into mush, and never crop in close just because close is easier to light. IMPERFECTION IS THE POINT: hand-made and hand-arranged things are never identical. Every piece differs in size, angle and placement — some lean, one sits slightly apart, garnish lands unevenly. Include honest small mess: a few crumbs, a smear on the board, an oil pool that is not symmetrical, a herb leaf out of place, one piece already eaten or a bite taken. Real props show light wear — a scratched board, a linen napkin with creases, a fingerprint on a glass. REAL SURFACES: matte where food is matte (cheese, bread, meat), shine only where fat or glaze genuinely sits. No plastic or waxy sheen, no rubbery highlights, no uniform glossy coating over everything. FORBIDDEN AI LOOK: no HDR glow, no halo or rim-light around every item, no over-saturated candy colours, no perfect radial symmetry, no identical repeated objects cloned across the frame, no impossibly clean surfaces, no floating ingredients, no smooth airbrushed texture. Slight natural grain and true-to-life colour, as if straight out of camera with minimal editing.`;
// Стиль и подвал можно передать явно: очередь ревью рисует лист из снимка, а не из
// текущего состояния. Раньше она склеивала промпт по-своему — стилевой блок шёл ПОСЛЕ
// описания листа и без замка в конце, поэтому перерисованный лист уезжал от набора.
// Теперь сборка одна на все случаи.
// Еда на редакционном контракте выходила пластмассовой и «нейросетевой»: идеальные
// порции, глянец, студийный свет. Домашний телефонный кадр читается живым, поэтому
// в режиме рецептов поверх общего контракта идёт этот блок.
const HOME_KITCHEN=`SHOT AT HOME, NOT IN A STUDIO — this is a photo the cook took in her own kitchen on a recent phone, not a styled studio set.
- Light: daylight from a nearby window, uneven the way real rooms are. Bright, and often sunny: a sun patch falling across the counter, warm afternoon light from one side. No studio strobes, no perfect fill, no rim light, but also nothing grey or gloomy. A dim kitchen is the wrong picture.
- Surroundings: ordinary domestic things — a scratched wooden board, a chipped everyday plate, a worn tea towel, a normal countertop with a crumb on it. Not perfect props, not a prop-styled table.
- Framing: casual and human, taken from where a person actually stands, slightly off-centre, not perfectly level.
- Phone-camera character: fairly deep focus rather than creamy studio bokeh, a little sensor noise in the shadows, white balance that is close but not perfectly corrected.
- The food was made by hand ten minutes ago: uneven portions, a smear on the rim, crumbs on the board, a spoon left in the bowl, real steam or condensation where it belongs, one piece already taken.
- NOTHING glossy, waxy, symmetrical or airbrushed. If it looks like a stock photo or a render, it is wrong.`;
function withStyle(prompt,asset,styleOverride,footerOverride){
  // photographs take a completely different route from printable sheets
  if(asset==='illustration'){
    const home=(v('articleMode')==='recipes')?'\n\n'+HOME_KITCHEN:'';
    return PHOTO_CONTRACT+home+'\n\nPHOTOGRAPH TO SHOOT:\n'+prompt;
  }
  const sb=(styleOverride)?styleOverride:styleText();
  const foot=(footerOverride!=null)?footerOverride:siteFooter();
  // the style contract goes FIRST so it anchors the whole image. Long sheet descriptions used to
  // dilute a trailing style block, which is why packs drifted away from the reference.
  // RICH_SHEET demands borders, patterned bands and vignettes — that directly contradicts a minimal
  // contract, so it is skipped whenever the chosen style (or a reference) asks for a clean look.
  const minimal=/STRICTLY NO decorative|no decorative frames|lots of white space/i.test(sb);
  // только вместе со стилевым контрактом: без него «полная декоративная система»
  // превращается в выдуманные веточки и вензеля по углам
  const rich=(sb && !minimal && ['prompts','ideas','recipes'].includes(v('articleMode')||'games'))?'\n\n'+RICH_SHEET:'';
  // Без референса раньше стиль не навязывался вообще, и листы выходили какие придётся.
  // Теперь есть домашний стиль по умолчанию, разобранный с трёх присланных образцов.
  // Он задаёт свою бумагу, поэтому BACKGROUND_RULE здесь не нужен: тот требует
  // подкрашенный фон и спорил бы со светлой бумагой.
  // Референс, когда он есть, по-прежнему главнее: домашний стиль к нему не примешивается.
  // RICH_SHEET сюда намеренно не идёт: он требует полную декоративную систему с рамками
  // и лентами, а домашний стиль построен на воздухе и отдельно стоящих объектах.
  // Карточки рецептов домашний стиль не трогает: у них свой вид, и он остаётся как есть.
  if(!sb) return (v('articleMode')==='recipes')
    ? prompt+'\n\n'+BACKGROUND_RULE+foot
    : DEFAULT_SHEET_STYLE+'\n\n'+ORIGINALITY+'\n\nSHEET TO DRAW (content only, keep the style above unchanged):\n'+prompt+foot;
  return sb+'\n\n'+BACKGROUND_RULE+'\n\n'+originalityClause()+'\n\n'+STYLE_LOCK+rich+'\n\nSHEET TO DRAW (content only — keep the style above unchanged):\n'+prompt+'\n\n'+STYLE_LOCK+foot;
}
