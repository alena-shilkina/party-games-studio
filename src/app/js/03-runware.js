/* ---------- RUNWARE (from fashion runwareGenerate) ---------- */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const isTransient=m=>/server error|try again|429|500|502|503|504|overload|timeout|rate limit|too many/i.test(m||'');
// turn any reference (local upload or remote WP WebP) into a PNG the model accepts
async function toPngRef(src){
  if(!src) return null;
  if(src.startsWith('data:image/png')) return src;
  if(src.startsWith('data:')){                        // uploaded file (maybe webp/jpeg) → convert locally via canvas
    try{
      const blob=await (await fetch(src)).blob();
      const bmp=await createImageBitmap(blob);
      const cv=document.createElement('canvas'); cv.width=bmp.width; cv.height=bmp.height;
      cv.getContext('2d').drawImage(bmp,0,0);
      return cv.toDataURL('image/png');
    }catch(e){ return src; }
  }
  // remote URL (e.g. WordPress .webp) — browser fetch is CORS-blocked, so route through the weserv image proxy,
  // which returns a PNG with proper headers that Runware fetches server-side.
  const clean=src.replace(/^https?:\/\//,'');
  return 'https://images.weserv.nl/?url='+encodeURIComponent(clean)+'&output=png';
}
// describe the STYLE of a remote reference image (from CSV) as text, so it drives GPT Image like a manual upload does.
// fetched through weserv (CORS-enabled) so the browser can read the bytes for Vision.
// System prompt for reading a reference image into a WRITTEN style contract.
// Deliberately style-level: it captures HOW the reference is drawn and WHAT KIND of objects live in it,
// but never the specific illustrations themselves — so the generated sheets share the mood and the
// subject world of the reference while being original artwork, not a trace of someone else's clipart.
const STYLE_VISION_SYS=`You are writing a STYLE CONTRACT so that a whole SET of printable sheets can be generated in one identical, coordinated look — WITHOUT copying the reference artwork.

Describe the reference image's visual system, covering ALL of:
(1) illustration technique (e.g. soft watercolour, flat vector, gouache, engraved line art, marker-and-ink) — line weight, fills, texture, shading;
(2) exact palette — name every key colour with an approximate hex code, and say which is the BACKGROUND colour and which is the dominant accent;
(3) the border / frame treatment (thickness, colour, single or double rule, inset margin, any patterned band and where it sits);
(4) MOTIF WORLD — the CATEGORY of small objects the set is built from, as generic nouns only (e.g. "everyday teen-room objects: phones, headphones, nail polish, boba cups, scrunchies, polaroids" or "woodland botanicals: ferns, berries, small birds"), plus how they are arranged (scattered corner clusters, a top band, a loose confetti spread, a tidy grid);
(5) typography character (serif/sans, weight, all-caps or mixed, colour) — the whole set must share one type style.

HARD LIMITS — this contract must be reproducible from words alone:
- Do NOT describe, name or single out any individual illustration, drawing, icon or arrangement from the reference. Describe families and categories, never specific artworks.
- Do NOT name or reference any character, mascot, brand, logo, franchise or named artist, and do NOT describe anything that would identify one.
- Do NOT describe the subject matter of the reference or the words printed on it.

Write it as a compact directive block of 3-5 sentences. Start the WHOLE block with the single word "STYLE:" once, then continue in plain sentences — do NOT repeat "STYLE:" at the start of each sentence. Be concrete and repeatable — another generator must be able to produce the SAME look on 15 different sheets from this text alone. No preamble.`;

// Вариант для режима «перенести и мотивы»: тот же разбор, но пункт (4) называет
// конкретных персонажей и предметы, чтобы мишка остался мишкой, а не превратился в зайца.
// Запрет на торговые марки остаётся: узнаваемого фирменного маскота переносить нельзя.
const STYLE_VISION_SYS_MOTIFS=`You are writing a STYLE CONTRACT so that a whole SET of printable sheets can be generated in one identical, coordinated look, keeping the SAME recurring subjects as the reference.

Describe the reference image's visual system, covering ALL of:
(1) illustration technique (e.g. soft watercolour, flat vector, gouache, engraved line art, marker-and-ink) — line weight, fills, texture, shading;
(2) exact palette — name every key colour with an approximate hex code, and say which is the BACKGROUND colour and which is the dominant accent;
(3) the border / frame treatment (thickness, colour, single or double rule, inset margin, any patterned band and where it sits);
(4) RECURRING SUBJECTS — name the actual creatures and objects the set is built from, concretely enough to redraw them: species or kind, colour, proportions, and any accessory they consistently carry (e.g. "a small cream teddy bear with a dark green ribbon at the neck, sitting", "a pale rocking horse with a gold mane"). Say which of them is the lead subject that should appear on most sheets, and how they are arranged (scattered corner clusters, a top band, a loose confetti spread, a tidy grid);
(5) typography character (serif/sans, weight, all-caps or mixed, colour) — the whole set must share one type style.

HARD LIMITS — this contract must be reproducible from words alone:
- Describe the subjects by what they look like: kind, colour, proportions, accessories. That description is what gets redrawn, so it has to stand on its own without the picture.
- Do NOT copy the reference's layout, composition or the exact arrangement of its elements.
- Do NOT describe the words printed on the reference.

Write it as a compact directive block of 4-6 sentences. Start the WHOLE block with the single word "STYLE:" once, then continue in plain sentences — do NOT repeat "STYLE:" at the start of each sentence. Be concrete and repeatable — another generator must produce the SAME look and the SAME recurring subjects on 15 different sheets from this text alone. No preamble.`;

// какой разбор применять — зависит от выбранного режима референса
function styleVisionSys(mode){ return (mode||refModeNow())==='motifs' ? STYLE_VISION_SYS_MOTIFS : STYLE_VISION_SYS; }
async function styleFromRefUrl(url,mode){
  if(!url||!keyReady('claude')) return '';
  const proxied='https://images.weserv.nl/?url='+encodeURIComponent(url.replace(/^https?:\/\//,''))+'&output=png';
  const blob=await (await fetch(proxied)).blob();
  const dataUri=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(blob); });
  const m=dataUri.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/); if(!m) return '';
  const sys=styleVisionSys(mode);
  const res=await fetch('/api/claude',{method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':v('claudeKey'),'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:400,system:sys,
      messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:m[1],data:m[2]}},{type:'text',text:'Write the compact STYLE line.'}]}]})});
  const j=await res.json(); if(j.error) throw new Error(j.error.message||'vision error');
  let out=(j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim();
  return cleanStyleBlock(out);
}
// strip repeated "STYLE:" markers the model sometimes puts before every sentence → keep one at the front
function cleanStyleBlock(t){
  if(!t) return t||'';
  t=t.replace(/\bSTYLE:\s*/gi,' ').replace(/\s{2,}/g,' ').trim();
  return 'STYLE: '+t;
}
async function runwareGen(prompt,width,height,tries=3,refUri=null){
  const key=v('runwareKey'); if(!keyReady('runware')) throw new Error('Runware key missing in Settings');
  const model=v('imgModel')||'openai:gpt-image@2';
  // Seedream valid sizes (per model): use 3:4 portrait 1728×2304, 4:3 landscape, 1:1 square
  if(model.includes('seedream')){
    if(height>width){ width=1728; height=2304; }       // 3:4 portrait  = 3,981,312 px
    else if(width>height){ width=2304; height=1728; }   // 4:3 landscape
    else { width=2048; height=2048; }                   // 1:1 square    = 4,194,304 px
  }
  // Ideogram 4.0 (Runware supported sizes): 2:3 portrait = 1664×2496, matches pins & infographics
  else if(model.includes('ideogram')){
    if(height>width){ width=1664; height=2496; }        // 2:3 portrait
    else if(width>height){ width=2496; height=1664; }   // 3:2 landscape
    else { width=2048; height=2048; }                   // 1:1 square
  }
  const task={taskType:'imageInference',taskUUID:crypto.randomUUID(),model,positivePrompt:prompt,
    width,height,numberResults:1,includeCost:true,outputType:'URL',outputFormat:'PNG'};
  // GPT Image 2 quality: 'low' is by far the cheapest; 'medium' is the safe default;
  // 'high' usually exceeds Runware's sync window (failedTaskTimeout)
  if(model.startsWith('openai:')) task.providerSettings={openai:{quality:(v('imgQuality')||'medium')}};
  // reference image: only attached when the user explicitly chose "send the image" mode.
  // In the default "style only" mode the reference NEVER reaches the image model — the Vision-written
  // style contract carries the look instead, so the model draws original artwork rather than copying
  // someone else's clipart. Ideogram never takes reference images and always uses the text style.
  const refMode=refModeNow();
  if(refUri && refMode!=='style' && !model.includes('ideogram')){ const png=await toPngRef(refUri); if(png) task.referenceImages=[png]; }
  for(let attempt=1;attempt<=tries;attempt++){
    try{
      if(batchStopped) throw new Error('__ABORT__');
      const r=await fetch('/api/runware',{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify([task]),signal:batchAbort?.signal});
      let d; try{ d=await r.json(); }catch(e){ throw new Error('Runware '+r.status+' (bad response)'); }
      if(d.errors?.length) throw new Error(d.errors[0].message||'Runware error');
      if(!r.ok) throw new Error('Runware '+r.status);
      const item=(d.data||[]).find(x=>x.imageURL);
      if(!item) throw new Error('No image returned — check Runware key, balance & GPT Image 2 access');
      return item.imageURL;
    }catch(e){
      if(e.name==='AbortError'||e.message==='__ABORT__') throw new Error('__ABORT__');
      if(isBalanceError(e.message)){ batchStopped=true; runwareOut=true; showRunwareBanner(); if(batchAbort)try{batchAbort.abort();}catch(x){} throw e; }
      // retry only on transient overload/rate errors, with backoff (2s, 6s)
      if(attempt<tries && isTransient(e.message)){ await sleep(2000*attempt); continue; }
      throw e;
    }
  }
}
// run jobs with limited concurrency so we don't trip Runware's per-provider overload limit
async function runPool(items,worker,concurrency=2){
  let idx=0;
  const run=async()=>{ while(idx<items.length){ const i=idx++; await worker(items[i]); } };
  await Promise.all(Array.from({length:Math.min(concurrency,items.length||1)},run));
}
// GPT Image 2 / Seedream valid portrait sizes
const SIZE_PRINT={w:1024,h:1536}; // 2:3 portrait, safe for gpt-image & seedream
const SIZE_PIN={w:1024,h:1536};
