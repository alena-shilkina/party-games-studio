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
// Референс отвечает ТОЛЬКО за технику: чем и как нарисовано. Палитра, сюжет, вёрстка
// и шрифт берутся от темы статьи — иначе один референс намертво привязывал бы весь набор
// к своим цветам, и статья про Хэллоуин выходила в лавандовых тонах ночной ярмарки.
const STYLE_VISION_SYS=`You are writing a TECHNIQUE CONTRACT: how a whole SET of printable sheets should be DRAWN. Describe only the hand — the medium and the way it is applied. Not what the reference shows, not which colours it uses, not how it is laid out.

Cover ALL of:
(1) MEDIUM AND TECHNIQUE, named the way an illustrator would name it: dense wet-on-wet watercolour with pigment pooling; flat vector with no gradients; gouache with visible brush marks; engraved line art with cross-hatching; soft coloured pencil; marker with an ink outline. Say whether shapes are outlined or defined by colour alone.
(2) LINE AND EDGE: line weight and how even it is; whether edges are crisp, feathered or bleeding; how much paper or brush texture shows.
(3) SHADING AND DEPTH: flat fills, soft blended shading, hatching, dry-brush; how much contrast there is between light and dark.
(4) COLOUR CHARACTER — how the colour behaves, never which colour it is: muted and desaturated, soft pastel wash, deep and saturated, high-contrast, chalky, luminous.
(5) LEVEL OF DETAIL AND FINISH: sparse and airy or dense and decorative; hand-made and slightly irregular or crisp and geometric.

HARD LIMITS — these are what keep the contract reusable across every theme:
- NEVER name a colour, a hex code, a palette, a background colour or an accent colour. The palette comes from the article's own theme, not from this reference.
- NEVER describe the subject matter, the objects, the characters or the scene.
- NEVER describe layout, borders, frames or how elements are arranged.
- NEVER describe typography or any text visible on the reference.
- NEVER name a brand, franchise, logo or artist.

Write 2-4 compact sentences. Start the WHOLE block with the single word "STYLE:" once, then continue in plain sentences — do NOT repeat "STYLE:". Another illustrator must be able to reproduce the same hand on 15 different sheets, on any subject and in any palette, from this text alone. No preamble.`;

// Тот же разбор техники, но дополнительно называет героев: нужен, когда в референсе есть
// персонаж, который должен остаться персонажем.
const STYLE_VISION_SYS_MOTIFS=`You are writing a TECHNIQUE CONTRACT: how a whole SET of printable sheets should be DRAWN, plus the recurring characters that must carry over from the reference.

Cover ALL of:
(1) MEDIUM AND TECHNIQUE, named the way an illustrator would name it: dense wet-on-wet watercolour with pigment pooling; flat vector with no gradients; gouache with visible brush marks; engraved line art with cross-hatching; soft coloured pencil. Say whether shapes are outlined or defined by colour alone.
(2) LINE AND EDGE: line weight and how even it is; whether edges are crisp, feathered or bleeding; how much paper or brush texture shows.
(3) SHADING AND DEPTH: flat fills, soft blended shading, hatching, dry-brush; how much contrast there is between light and dark.
(4) COLOUR CHARACTER — how the colour behaves, never which colour it is: muted and desaturated, soft pastel wash, deep and saturated, high-contrast, chalky, luminous.
(5) RECURRING CHARACTERS: name the creatures or objects that must appear across the set, by kind, proportion and any accessory they consistently carry ("a small sitting teddy bear with a ribbon at the neck", "a rocking horse with a flowing mane"). Say which one is the lead. Describe their SHAPE, not their colour — they will be recoloured to each article's palette.

HARD LIMITS:
- NEVER name a colour, a hex code, a palette, a background colour or an accent colour. The palette comes from the article's own theme.
- NEVER describe layout, borders, frames or how elements are arranged.
- NEVER describe typography or any text visible on the reference.

Write 3-5 compact sentences. Start the WHOLE block with the single word "STYLE:" once, then continue in plain sentences — do NOT repeat "STYLE:". Another illustrator must be able to reproduce the same hand and the same characters on 15 different sheets, in any palette, from this text alone. No preamble.`;

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
  if(refUri && !model.includes('ideogram')){ const png=await toPngRef(refUri); if(png) task.referenceImages=[png]; }
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
