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
// auto style derived from the article category, so a set stays consistent even with no reference
function autoStyleBlock(){
  const c=v('category').toLowerCase(), a=v('audience');
  const kids=a==='kids'||/kids|birthday/.test(c);
  return kids
    ? 'STYLE: soft cheerful storybook watercolor, gentle rounded shapes, pastel palette of blush, mint, butter yellow and powder blue with soft grey text; friendly little mascot motif repeated across the set.'
    : 'STYLE: elegant airy watercolor on a cream background, muted tasteful palette with one soft accent color and charcoal text; delicate recurring floral and dot motifs; refined and consistent across the set.';
}
// append the shared style block (reference-derived > preset > auto) + site footer to an image prompt
// Референс для печатного листа: приложенный вручную или к строке — главнее всего,
// иначе берётся картинка из библиотеки стилей по выбранному стилю. Фотографии сюда
// не попадают: у них свой контракт и референс им не передаётся.
function sheetRef(){ return ST.refDataUri || styleRefFor(activeInfoStyle); }
// выбор стиля в сайдбаре подтягивает его референс, если своего не приложено
function setInfoStyle(val){ activeInfoStyle=val; if(!ST.baseRef) ST.refDataUri=styleRefFor(val); }
function styleText(){
  let sb=(v('styleBlock')||ST.styleBlock||'').trim();      // 1. reference-derived (Vision)
  if(!sb){                                                 // 2. no reference → chosen preset
    const preset=INFO_STYLES.find(s=>s.id===activeInfoStyle);
    sb=(preset&&preset.block)?preset.block:autoStyleBlock(); // 'auto' or empty → autoStyleBlock
  }
  return sb;
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
  const mode=explicit||refModeNow();
  if(mode==='motifs') return MOTIF_ORIGINALITY;
  return mode==='image' ? REF_ORIGINALITY : ORIGINALITY;
}
const STYLE_LOCK='CONSISTENCY: this sheet is one of a matching printable set. Reproduce the style contract above EXACTLY — same background colour, same border treatment, same palette hexes, same motifs and the same typeface family on every sheet. Do not reinterpret, restyle or introduce new colours, borders or decorative elements. THE SHEET DESCRIPTION IS CONTENT, NOT STYLE: if it mentions a drawing technique, a colour, a background, a line weight, a mood, or the word "clean", ignore that word completely and draw the sheet in the style contract above. The style contract wins over every style word anywhere else in this prompt.';
// Editorial photography contract — used for "illustration" assets (cakes, arches, tablescapes, dishes).
// These are PHOTOGRAPHS, not designed sheets, so they must never receive the printable style contract,
// the "SHEET TO DRAW" framing or the site footer: that is what made them flat, white and lifeless.
const PHOTO_CONTRACT=`EDITORIAL PHOTOGRAPHY — this is a photograph for a magazine feature, NOT a printable sheet, NOT flat vector art, NOT an illustration.
- SHOOT WHAT THE PARAGRAPH DESCRIBES, nothing else. The scene is whatever that idea actually is: a gift basket on a bed, a shelf of jars, a lit corner of a room, a plated dish, a wrapped parcel, a dressed table. Style it the way a magazine would style THAT subject, with props that belong to it. Do not add party decor, balloons, cake or confetti unless the idea is itself about them.
- Natural, soft directional light with gentle shadows and real depth; shallow depth of field with a softly blurred background; realistic materials and textures (frosting, fabric, paper, foliage, balloon latex).
- Rich, warm, inviting mood — the kind of picture that makes the reader want to copy it. Never a bare object floating on an empty white background, never a clip-art or infographic look.
- Composition: the whole subject fits inside the frame with comfortable breathing room; nothing is cropped awkwardly or runs off the edge.
- PHYSICAL PLAUSIBILITY: everything must be buildable and complete, resting on a real surface and obeying gravity. Nothing is fused into a wall, broken, warped, floating or trailing off the edge. Stacked or tiered things sit level and hold together.
- NO people, no hands, no faces. NO text, letters, numbers, captions, watermarks or logos anywhere in the image. No brand labels.
- PHOTOREALISM — this must look like a real photograph taken by a magazine photographer, not a render. CAMERA: shot on a 50mm lens at about f/2.8, from a natural eye-level or slight three-quarter angle; soft directional daylight from one side with gentle falloff and real, slightly soft shadows; shallow depth of field where the front of the food is sharp and the back genuinely falls out of focus. IMPERFECTION IS THE POINT: hand-made and hand-arranged things are never identical. Every piece differs in size, angle and placement — some lean, one sits slightly apart, garnish lands unevenly. Include honest small mess: a few crumbs, a smear on the board, an oil pool that is not symmetrical, a herb leaf out of place, one piece already eaten or a bite taken. Real props show light wear — a scratched board, a linen napkin with creases, a fingerprint on a glass. REAL SURFACES: matte where food is matte (cheese, bread, meat), shine only where fat or glaze genuinely sits. No plastic or waxy sheen, no rubbery highlights, no uniform glossy coating over everything. FORBIDDEN AI LOOK: no HDR glow, no halo or rim-light around every item, no over-saturated candy colours, no perfect radial symmetry, no identical repeated objects cloned across the frame, no impossibly clean surfaces, no floating ingredients, no smooth airbrushed texture. Slight natural grain and true-to-life colour, as if straight out of camera with minimal editing.`;
// Стиль и подвал можно передать явно: очередь ревью рисует лист из снимка, а не из
// текущего состояния. Раньше она склеивала промпт по-своему — стилевой блок шёл ПОСЛЕ
// описания листа и без замка в конце, поэтому перерисованный лист уезжал от набора.
// Теперь сборка одна на все случаи.
function withStyle(prompt,asset,styleOverride,footerOverride){
  // photographs take a completely different route from printable sheets
  if(asset==='illustration') return PHOTO_CONTRACT+'\n\nPHOTOGRAPH TO SHOOT:\n'+prompt;
  const sb=(styleOverride)?styleOverride:styleText();
  const foot=(footerOverride!=null)?footerOverride:siteFooter();
  // the style contract goes FIRST so it anchors the whole image. Long sheet descriptions used to
  // dilute a trailing style block, which is why packs drifted away from the reference.
  // RICH_SHEET demands borders, patterned bands and vignettes — that directly contradicts a minimal
  // contract, so it is skipped whenever the chosen style (or a reference) asks for a clean look.
  const minimal=/STRICTLY NO decorative|minimal|no decorative frames|clean editorial|lots of white space/i.test(sb)
              || ['editorial','light-modern','stationery','recipe-card'].includes(activeInfoStyle);
  const rich=(!minimal && ['prompts','ideas','recipes'].includes(v('articleMode')||'games'))?'\n\n'+RICH_SHEET:'';
  if(!sb) return prompt+rich+foot;
  return sb+'\n\n'+originalityClause()+'\n\n'+STYLE_LOCK+rich+'\n\nSHEET TO DRAW (content only — keep the style above unchanged):\n'+prompt+'\n\n'+STYLE_LOCK+foot;
}
