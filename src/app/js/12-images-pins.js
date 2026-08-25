/* ---------- IMAGE GENERATION over the interleaved games array (parallel) ---------- */
async function generateImages(){
  const art=ST.article, kw=art.focusKeyword;
  const jobs=[];
  (art.games||[]).forEach((g,i)=>{ if(g.imagePrompt){ setGameImgState(i); jobs.push([g,i]); } });
  // pool of 2 — parallel enough to be fast, low enough to avoid Runware overload 5xx
  await runPool(jobs, async ([g,i])=>{
    try{
      g._img=await runwareGen(withStyle(g.imagePrompt,g.asset),SIZE_PRINT.w,SIZE_PRINT.h,3,g.asset==='illustration'?null:sheetRef()); g._err=null;
      g._file=buildFilename(kw,g.name,i);
      // ideas mode may ask for 1-2 extra detail shots (the cake, the table, a decor close-up)
      const extras=(g.extraImagePrompts||[]).filter(x=>String(x||'').trim()).slice(0,2);
      if(extras.length){
        g._imgs2=[];
        for(let k=0;k<extras.length;k++){
          try{
            const u=await runwareGen(withStyle(extras[k],g.asset),SIZE_PRINT.w,SIZE_PRINT.h,3,g.asset==='illustration'?null:sheetRef());
            if(u) g._imgs2.push({img:u,file:buildFilename(kw,g.name+'-detail-'+(k+1),i)});
          }catch(e){ if(e.message==='__ABORT__'||isBalanceError(e.message)) throw e; }
        }
      }
    }catch(e){ g._err=e.message; }
    rerenderGame(i);
  }, 2);
}

/* ---------- PINS ---------- */
// Пины временно отключены целиком: их будет делать pin-scheduler.
// Код ниже рабочий и не тронут — чтобы вернуть, поставь здесь true.
const PINS_ENABLED=false;
// прячет всё, что относится к пинам, пока выключатель снят
function applyPinsSwitch(){ const s=$('pinSection'); if(s) s.style.display=PINS_ENABLED?'':'none'; }
function themeBG(){ return `a soft ${v('category').toLowerCase()} themed background with tasteful party props, NO people`; }

// The user provides the exact pin HEADLINES. Claude only writes a CTA + two scenes per headline.
async function writePinContent(headlines){
  const a=ST.article;
  const sys=`You create Pinterest pin visuals. Every article offers a FREE printable download. You are given a fixed HEADLINE for each pin — do NOT change it. For each headline return three things:
- "cta": a very short call-to-action, 2-4 words, for a button on the pin pointing to the free printables (e.g. "Grab the Free Games", "Print These Tonight", "Get the Printables", "Free Download"). Vary them across the pins.
- "sceneVector": a MODERN FLAT EDITORIAL ILLUSTRATION scene that fits THIS headline's meaning (contemporary vector art, matte muted colours, simple shapes, subtle grain, decorative background — NOT a Disney/Pixar cartoon), featuring ONE expressive character showing a STRONG positive emotion (surprise, big smile, delight). Pick a character/scene that suits the specific headline. Clearly illustrated, never photorealistic. No text.
- "scenePhoto": a PHOTOREALISTIC flat-lay scene fitting THIS headline — an attractive real-photo arrangement of themed props and objects (NO people, NO faces, objects only), soft natural light. No text.
Make the 4 scenes distinct from each other, matched to each headline's content. ${HUMANIZER_SHORT}

Return ONLY raw JSON: {"pins":[{"cta":"","sceneVector":"","scenePhoto":""}, ...]} in the same order, no preamble.`;
  const vibeLine=isNeutralVibe()
    ? `\n\n${NO_SEASONAL}`
    : `\n\nVibe for every scene: ${resolvedVibeName()}.`;
  const msg=`Article: ${a.title}\nTheme: ${v('category')} (${v('audience')})${vibeLine}\n\nPin headlines (write cta + scenes for each, in order — keep headlines unchanged):\n${headlines.map((t,i)=>`${i+1}. ${t}`).join('\n')}`;
  try{
    const txt=await callClaude(sys,msg,false);
    const d=extractJSON(txt);
    if(Array.isArray(d.pins)&&d.pins.length===headlines.length) return d.pins;
  }catch(e){ /* fall back */ }
  return headlines.map(()=>({cta:'Get the Free Printables',sceneVector:themeBG(),scenePhoto:themeBG()}));
}
function buildPinPrompt(headline,scene,layout,vibeBlock,cta,mode){
  let p=layout.prompt
    .replace(/\{TITLE\}/g,headline)
    .replace(/\{SCENE\}/g,scene||themeBG())
    .replace(/\{VIBE\}/g,vibeBlock||'')
    .replace(/\{CTA\}/g,cta||'Free Download');
  p+=' '+(mode==='photo'?STYLE_PHOTO:STYLE_VECTOR);
  if(!vibeIsFixed()) p+=' '+TAILWIND_PALETTE;   // holidays keep their own palette; others use the proven Tailwind palette
  if(isNeutralVibe()) p+=' '+NO_SEASONAL;       // neutral pin_vibe → actively block holiday decor
  p+=' '+NO_YELLOW;
  return p+siteFooter();
}
// One switch for the whole pin stage. When off we skip BOTH the Claude call that writes pin CTAs
// and scenes AND the four Runware image generations — that is the token cost and the image cost.
function pinsOn(){ if(!PINS_ENABLED) return false; const el=$('makePins'); return el? el.checked : true; }
(function(){ try{ const v=localStorage.getItem('pgs_makePins');
  document.addEventListener('DOMContentLoaded',()=>{ const el=$('makePins');
    if(el&&v!==null){ el.checked=(v==='1'); togglePins(); } }); }catch(e){} })();
function togglePins(){ try{localStorage.setItem('pgs_makePins',pinsOn()?'1':'0');}catch(e){}
  const f=$('pinFields'); if(f) f.style.display=pinsOn()?'':'none'; }
async function generatePins(){
  if(!pinsOn()){ ST.pins=[]; renderPins(); return; }
  const headlines=v('pinKW').split('|').map(t=>t.trim()).filter(Boolean).slice(0,4);
  if(!headlines.length){ ST.pins=[]; renderPins(); toast('No pin headlines given','err'); return; }
  ST.pins=headlines.map(k=>({title:k,headline:k,img:null,err:null}));  // title = the user's headline
  renderPins();
  const content=await writePinContent(headlines);
  const vibe=currentVibeBlock();
  const layouts=[...PIN_LAYOUTS].sort(()=>Math.random()-0.5); // shuffle layouts
  const modes=['vector','vector','photo','photo'].sort(()=>Math.random()-0.5); // mix: 2 vector + 2 photo
  headlines.forEach((h,i)=>{
    const mode=modes[i%modes.length];
    const scene=mode==='photo'?(content[i].scenePhoto||content[i].scene):(content[i].sceneVector||content[i].scene);
    ST.pins[i].headline=h;                      // user's exact headline, unchanged
    ST.pins[i].cta=content[i].cta||'';
    ST.pins[i].mode=mode;
    ST.pins[i].layout=layouts[i%layouts.length].id;
    ST.pins[i].prompt=buildPinPrompt(h,scene,layouts[i%layouts.length],vibe,ST.pins[i].cta,mode);
  });
  renderPins();
  await runPool(headlines.map((h,i)=>i), async (i)=>{
    try{
      ST.pins[i].img=await runwareGen(ST.pins[i].prompt,SIZE_PIN.w,SIZE_PIN.h); ST.pins[i].err=null;
      ST.pins[i].file=buildFilename(ST.pins[i].headline,'pin',i);   // file name from the headline
    }catch(e){ ST.pins[i].err=e.message; }
    renderPins();
  }, 2);
}
