/* ---------- BATCH WORK ZONE ---------- */
function blankRow(){ return {id:crypto.randomUUID(),kw:'',title:'',mode:'games',aud:'adult',
  wpCat:ST.pubCat||'',infoStyle:'auto',vibe:'Auto',downloadable:false,pinKW:'',context:'',featKW:'',styleBlock:'',refUrl:'',paa:[],paaSel:[],status:'',link:'',error:''}; }
// auto-detect the article theme from the keyword (feeds the generation context)
function detectTheme(kw){
  const s=(kw||'').toLowerCase();
  if(/baby shower/.test(s))return 'Baby Shower';
  if(/bachelorette|hen party/.test(s))return 'Bachelorette';
  if(/bridal/.test(s))return 'Bridal Shower';
  if(/birthday/.test(s))return 'Birthday Party';
  if(/kids|children|toddler|preschool/.test(s))return 'Kids Party';
  if(/girls night|galentine/.test(s))return 'Girls Night';
  if(/christmas|halloween|easter|thanksgiving|valentine|new year|patrick|july|holiday|hanuk|chanuk|new-year/.test(s))return 'Holiday Party';
  // NEVER default to a holiday: an unrecognised topic (senior games, office, trivia night, road trip…)
  // used to fall through to 'Holiday Party', which then fed the article + pin prompts and produced
  // Christmas-styled sheets and pins on completely non-seasonal articles.
  return 'General Party';
}
function loadBatch(){
  try{ ST.batch=JSON.parse(localStorage.getItem('pgs_batch')||'null'); }catch(e){ ST.batch=null; }
  if(!ST.batch||!Array.isArray(ST.batch.rows)) ST.batch={status:'draft',autoFeatured:true,rows:[blankRow(),blankRow(),blankRow(),blankRow(),blankRow()]};
}
function saveBatch(){
  localStorage.setItem('pgs_batch',JSON.stringify(ST.batch));
  const s=$('bzSave'); if(s){ s.classList.add('show'); clearTimeout(saveBatch._t); saveBatch._t=setTimeout(()=>s.classList.remove('show'),900); }
}
function openBatch(){ if(!ST.batch)loadBatch(); $('bzStatus').value=ST.batch.status||'draft'; if($('featMode'))$('featMode').value=ST.batch.featMode||(ST.batch.autoFeatured===false?'manual':'pexels');
  if($('bzMode'))$('bzMode').value=ST.batch.mode||'review';
  $('bzSite').textContent=getSite()?getSite().name:'No site — set in ⚙';
  updateReviewCount(); renderBatch(); $('batchZone').classList.add('on'); }
function closeBatch(){ $('batchZone').classList.remove('on'); }
// per-row infographic reference: image kept in memory (ST.rowRefs), Vision style block saved with the row
const ROWREF={};   // id -> dataURI (session only, not persisted — too big for localStorage)
function loadRowRef(e,id){
  const f=e.target.files[0]; if(!f)return;
  const r=ST.batch.rows.find(x=>x.id===id); if(!r)return;
  const rd=new FileReader();
  rd.onload=async()=>{
    ROWREF[id]=rd.result; r.refName=f.name; saveBatch(); renderBatch(); setRowRefState(id,'reading…');
    if(!keyReady('claude')){ setRowRefState(id,'add Claude key'); return; }
    const m=rd.result.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/); if(!m){setRowRefState(id,'bad image');return;}
    try{
      const sys=STYLE_VISION_SYS;
      const res=await fetch('/api/claude',{method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':v('claudeKey'),'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:400,system:sys,
          messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:m[1],data:m[2]}},{type:'text',text:'Write the compact STYLE line.'}]}]})});
      const j=await res.json();
      if(j.error) throw new Error(j.error.message||'error');
      const txt=cleanStyleBlock((j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim());
      r.styleBlock=txt||''; saveBatch(); renderBatch(); setRowRefState(id,'✓ style read — editable below');
    }catch(err){ setRowRefState(id,'style error'); }
  };
  rd.readAsDataURL(f);
}
function setRowRefState(id,msg){ const el=$('rref-'+id); if(el)el.textContent=msg; }
// per-row PAA research
async function rowPAA(id){
  const r=ST.batch.rows.find(x=>x.id===id); if(!r)return;
  if(!r.kw.trim()){toast('Enter a keyword for this row first','err');return;}
  if(!keyReady('claude')){toast('Add your Claude key in Settings','err');return;}
  const btn=$('paabtn-'+id); if(btn){btn.disabled=true;btn.textContent='⏳ Searching…';}
  try{
    const txt=await callClaude(
      'You research real user questions. Search Google People Also Ask, Reddit, Quora. Return ONLY raw JSON: {"questions":["q1","q2",...]} No preamble.',
      'Find 8-10 real People Also Ask questions for: "'+r.kw+'"', true);
    const d=extractJSON(txt);
    r.paa=(d.questions||[]).slice(0,10); r.paaSel=r.paa.map(()=>true);
    saveBatch(); renderBatch();
    toast(r.paa.length+' questions found','ok');
  }catch(e){ toast('PAA: '+e.message,'err'); }
  const b2=$('paabtn-'+id); if(b2){b2.disabled=false;b2.textContent='🔍 Find questions';}
}
function toggleRowPAA(id,idx){
  const r=ST.batch.rows.find(x=>x.id===id); if(!r||!r.paaSel)return;
  r.paaSel[idx]=!r.paaSel[idx]; saveBatch(); renderBatch();
}
function optionList(items,val){ return items.map(o=>`<option value="${esc(o.v)}" ${String(o.v)===String(val)?'selected':''}>${esc(o.l)}</option>`).join(''); }
function catOpts(val){ return optionList([['Baby Shower'],['Birthday Party'],['Girls Night'],['Bachelorette'],['Kids Party'],['Holiday Party'],['Bridal Shower']].map(x=>({v:x[0],l:x[0]})),val); }
function audOpts(val){ return optionList([{v:'adult',l:'Adults'},{v:'kids',l:'Kids / family'},{v:'mixed',l:'Mixed'}],val); }
function countOpts(val){ return optionList([{v:'0',l:'Auto 11–17'},{v:'10',l:'10'},{v:'12',l:'12'},{v:'14',l:'14'},{v:'16',l:'16'},{v:'18',l:'18'}],val); }
function infoOpts(val){ return optionList(INFO_STYLES.map(s=>({v:s.id,l:s.label})),val); }
function vibeOpts(val){ return optionList(Object.keys(PIN_VIBES).map(k=>({v:k,l:k==='Auto'?'Auto':k})),val); }
function wpCatOpts(val){ const c=(ST.wpCats||[]); if(!c.length)return `<option value="">— load in main screen —</option>`; return `<option value="">(site default)</option>`+optionList(c.map(x=>({v:x.id,l:x.name})),val); }
function statusPill(r){
  const retry=`<button class="btn btn-ghost btn-sm" style="width:auto;font-size:11px;padding:3px 8px;margin-left:6px" onclick="retryRow('${r.id}')" title="Regenerate this article">↻ Retry</button>`;
  if(r.status==='done')return `<span class="brow-status" style="color:var(--ok)">✅ ${r.link?`<a href="${r.link}" target="_blank" style="color:var(--ok)">open in WP</a>`:'done'}</span>${retry}`;
  if(r.status==='running')return `<span class="brow-status" style="color:var(--plum)"><span class="spin"></span> working…</span>`;
  if(r.status==='error')return `<span class="brow-status" style="color:var(--warn)">⚠ ${esc(r.error||'error')}</span>${retry}`;
  return `<span class="brow-status" style="color:var(--muted)">queued</span>`;
}
// re-run a single row through the full pipeline (for rows that errored or came out wrong)
async function retryRow(id){
  if(batchRunning){ toast('Wait for the batch to finish, or Stop it first','err'); return; }
  const r=ST.batch.rows.find(x=>x.id===id); if(!r)return;
  if(!r.kw.trim()){ toast('This row has no keyword','err'); return; }
  if(!getSite()){ toast('Select a WP site in Settings','err'); return; }
  batchStopped=false; batchAbort=new AbortController();
  r.status='running'; r.error=''; renderBatch();
  const mode=$('bzMode')?$('bzMode').value:(ST.batch.mode||'review');
  const status=$('bzStatus')?$('bzStatus').value:(ST.batch.status||'draft');
  try{
    if(r.refUrl && !r.styleBlock){ try{ r.styleBlock=await styleFromRefUrl(r.refUrl); saveBatch(); }catch(e){} }
    applyRowToFields(r);
    await applyFeatured(r.featKW||r.kw, !!r.featKW);
    await generateArticle();
    if(!ST.article) throw new Error('generation failed');
    if(mode==='review'){ const rr=await stageForReview(status); if(rr&&rr.ok){ r.status='done'; r.link=''; } else throw new Error('staging failed'); }
    else { const res=await publish(status); if(res&&res.ok){ r.status='done'; r.link=res.link; } else throw new Error(res&&res.error||'publish failed'); }
    toast('Article regenerated','ok');
  }catch(e){ r.status='error'; r.error=e.message==='__ABORT__'?'stopped':e.message; }
  batchAbort=null; renderBatch(); saveBatch(); updateReviewCount();
}
function renderBatch(){
  const rows=ST.batch.rows;
  $('bzCount').textContent=`(${rows.length}/50)`;
  $('bzRows').innerHTML=rows.map((r,i)=>`<div class="brow ${r.status}" id="brow-${r.id}">
    <div class="brow-head"><span class="brow-num">${i+1}</span>
      <span style="flex:1;font-weight:600;font-size:13px">${esc(r.title||r.kw||'Untitled article')}</span>
      ${statusPill(r)}
      <button class="brow-x" onclick="removeBatchRow('${r.id}')" title="Remove">✕</button></div>

    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <div class="fg" style="flex:1;min-width:220px"><label>Title (number in it = item count)</label><input placeholder="e.g. 17 Adorable Baby Shower Games" value="${esc(r.title||'')}" onchange="updRow('${r.id}','title',this.value)"></div>
      <div class="fg" style="flex:0 0 170px"><label>Mode</label><select onchange="updRow('${r.id}','mode',this.value)">${optionList([{v:'games',l:'Games listicle'},{v:'prompts',l:'Prompts + cards'},{v:'ideas',l:'Ideas round-up'},{v:'recipes',l:'Recipe round-up'}],r.mode||'games')}</select></div>
      <div class="fg" style="flex:1;min-width:220px"><label>Main keyword</label><input placeholder="e.g. baby shower games for a boy" value="${esc(r.kw)}" onchange="updRow('${r.id}','kw',this.value)"></div>
    </div>

    ${PINS_ENABLED?`<div class="fg"><label>4 pin headlines (separated by | )</label><input placeholder="Headline 1 | Headline 2 | Headline 3 | Headline 4" value="${esc(r.pinKW)}" onchange="updRow('${r.id}','pinKW',this.value)"></div>`:''}

    <div class="fg"><label>Extra info / context (optional)</label><input placeholder="angle, must-include games, notes" value="${esc(r.context)}" onchange="updRow('${r.id}','context',this.value)"></div>

    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <div class="fg" style="flex:1;min-width:150px"><label>Infographic style</label><select onchange="updRow('${r.id}','infoStyle',this.value)">${infoOpts(r.infoStyle)}</select></div>
      <div class="fg" style="flex:1.4;min-width:200px"><label>Infographic reference</label>
        <div class="brow-ref">
          ${ROWREF[r.id]?`<img src="${ROWREF[r.id]}">`:`<div class="brow-ref-ph">no image</div>`}
          <div style="flex:1">
            <label class="btn btn-ghost btn-sm" style="cursor:pointer;width:auto;display:inline-block">${ROWREF[r.id]?'🔄 Change':'📎 Upload'}<input type="file" accept="image/*" style="display:none" onchange="loadRowRef(event,'${r.id}')"></label>
            <div id="rref-${r.id}" style="font-size:11px;color:var(--ok);margin-top:5px">${r.styleBlock?'✓ style read':(ROWREF[r.id]?'image attached':'')}</div>
          </div>
        </div>
      </div>
      <div class="fg" style="flex:1;min-width:150px"><label>Pin vibe</label><select onchange="updRow('${r.id}','vibe',this.value)">${vibeOpts(r.vibe)}</select></div>
    </div>
    <div class="fg" style="margin-top:-2px"><textarea placeholder="Reference style description appears here — editable" style="min-height:46px;font-size:12px" onchange="updRow('${r.id}','styleBlock',this.value)">${esc(r.styleBlock||'')}</textarea></div>

    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <div class="fg" style="flex:1;min-width:140px"><label>Audience</label><select onchange="updRow('${r.id}','aud',this.value)">${audOpts(r.aud)}</select></div>
      <div class="fg" style="flex:1;min-width:140px"><label>WP category</label><select onchange="updRow('${r.id}','wpCat',this.value)">${wpCatOpts(r.wpCat)}</select></div>
      <div class="fg" style="flex:1;min-width:140px"><label>PAA research</label><button class="btn btn-ghost btn-sm" style="width:100%" onclick="rowPAA('${r.id}')" id="paabtn-${r.id}">🔍 Find questions</button></div>
    </div>
    ${(r.paa&&r.paa.length)?`<div class="brow-paa" id="paa-${r.id}">${r.paa.map((q,qi)=>`<span class="chip ${(r.paaSel&&r.paaSel[qi])?'on':''}" onclick="toggleRowPAA('${r.id}',${qi})">${esc(q)}</span>`).join('')}</div>`:``}

    <div class="fg" style="margin-top:6px"><label style="font-size:10px">Featured image keyword (optional · blank = main keyword)</label><input placeholder="blank = main keyword" value="${esc(r.featKW||'')}" onchange="updRow('${r.id}','featKW',this.value)"></div>
    </div>`).join('');
}
function updRow(id,field,val){ const r=ST.batch.rows.find(x=>x.id===id); if(!r)return; r[field]=val; saveBatch(); }
function addBatchRow(){ if(ST.batch.rows.length>=50){toast('Max 50 per batch','err');return;} ST.batch.rows.push(blankRow()); saveBatch(); renderBatch(); }
function removeBatchRow(id){ ST.batch.rows=ST.batch.rows.filter(x=>x.id!==id); if(!ST.batch.rows.length)ST.batch.rows.push(blankRow()); saveBatch(); renderBatch(); }
function clearBatchDone(){ ST.batch.rows=ST.batch.rows.filter(r=>r.status!=='done'); if(!ST.batch.rows.length)ST.batch.rows.push(blankRow()); saveBatch(); renderBatch(); }
function bzProg(pct,lbl){ $('bzFill').style.width=pct+'%'; if(lbl!=null)$('bzProgLbl').textContent=lbl; }

// push a row's settings into the single-article fields, then reuse the whole pipeline
function applyRowToFields(r){
  ST.batchRow=r;   // ideas mode reads r.downloadable when building the brief
  $('mainKW').value=r.kw; $('category').value=detectTheme(`${r.kw} ${r.title||''} ${r.wpCat||''}`); $('audience').value=r.aud;
  $('titleInput').value=r.title||''; $('context').value=r.context||''; $('pinKW').value=r.pinKW||'';
  if($('articleMode')) $('articleMode').value=r.mode||'games';
  activeVibe=r.vibe||'Auto'; activeInfoStyle=r.infoStyle||'auto'; ST.pubCat=r.wpCat||getSite()?.cat||null;
  // per-row infographic reference: image from memory (if re-attached this session) + saved style block
  // Reference resolution, in strict priority order — never inherit the PREVIOUS row's style:
  //   1. the row's own reference (uploaded on the row, or ref_url from CSV)
  //   2. a reference attached by hand in the sidebar, used as a default for rows that have none
  //   3. nothing → fall back to the preset/auto style
  const rowRef=ROWREF[r.id]||r.refUrl||null;
  if(rowRef){ ST.refDataUri=rowRef; ST.styleBlock=r.styleBlock||''; }
  else if(ST.baseRef){ ST.refDataUri=ST.baseRef; ST.styleBlock=r.styleBlock||ST.baseStyle||''; }
  else { ST.refDataUri=null; ST.styleBlock=r.styleBlock||''; }
  // keep the on-screen style field in sync — styleText() reads the DOM first, so a stale value
  // from the previous article would silently override this row's reference style
  if($('styleBlock')) $('styleBlock').value=ST.styleBlock;
  // selected PAA questions for this row → FAQ
  ST.paa=(r.paa||[]).filter((q,i)=>!r.paaSel||r.paaSel[i]);
  ST.feat=null;
}
let usedFeatIds=new Set();   // Pexels photo ids already used as featured in this session → avoid repeats across the batch
// turn a keyword like "winter party games for adults" into a brighter, on-theme photo query:
// strip the "games/printable/for adults/…" words that pull dim literal stock, keep the festive theme, add a celebration cue
function featuredQuery(kw){
  let s=(kw||'').toLowerCase();
  s=s.replace(/\b(free|printable|printables?|best|fun|easy|cute|top|list of|the ultimate|\d+)\b/g,' ')
     .replace(/\b(games?|activities|activity|ideas?|things to do|office|classroom|indoor|outdoor|virtual|online)\b/g,' ')
     .replace(/\bfor (adults?|kids?|teens?|couples?|families|friends|groups?|the office|work|school)\b/g,' ')
     .replace(/\s+/g,' ').trim();
  if(!s) s=(kw||'').toLowerCase().trim();
  return (s+' celebration').trim();
}
async function pexelsPool(q){
  const r=await fetch('/api/pexels?per_page=30&orientation=landscape&query='+encodeURIComponent(q),{headers:{Authorization:v('pexelsKey')}});
  const d=await r.json(); return (d&&d.photos)||[];
}
// kw = the featured keyword; explicit=true means the user typed it → use as-is, don't rewrite the query
async function fetchFeaturedFor(kw, explicit){
  if(!keyReady('pexels'))return;
  try{
    let list=await pexelsPool(explicit ? kw : featuredQuery(kw));
    if(!list.length && !explicit) list=await pexelsPool(kw);   // cleaned query found nothing → fall back to the raw keyword
    if(!list.length) return;
    let pool=list.filter(p=>!usedFeatIds.has(p.id));
    if(!pool.length) pool=list;                                // whole pool already used → allow reuse rather than nothing
    const p=pool[Math.floor(Math.random()*pool.length)];       // pick a RANDOM photo, not always the top one
    usedFeatIds.add(p.id);
    ST.feat={url:p.src.large2x,credit:p.photographer,pexId:p.id};
  }catch(e){}
}

const SIZE_HERO={w:1536,h:1024};   // 3:2 landscape for GPT Image; runwareGen remaps to Seedream/Ideogram landscape automatically
// generate an on-brand festive hero via Runware (same engine as pins) — always on theme, never repeats, no dim stock
async function genFeaturedAI(kw){
  if(!keyReady('runware')) return;
  const theme=((featuredQuery(kw)||kw||'party').replace(/\bcelebration\b/,'').trim())||'party';
  const vibeName=(typeof detectVibe==='function')?detectVibe(kw,v('category')):'';
  const decor=(vibeName&&PIN_VIBES[vibeName]&&PIN_VIBES[vibeName].block)||'';
  const prompt=`Wide landscape blog header illustration, modern flat editorial vector art — contemporary, matte muted colours, simple clean shapes, subtle grain, decorative background. NOT a Disney/Pixar cartoon, never photorealistic. Cheerful scene of a ${theme} celebration: friends having fun together, warm inviting festive mood with tasteful party props and confetti. ${decor} Balanced composition with comfortable open space. ABSOLUTELY NO text, no words, no letters, no numbers.`;
  try{
    const url=await runwareGen(prompt,SIZE_HERO.w,SIZE_HERO.h,3,null);
    if(url) ST.feat={url,credit:'',pexId:null,ai:true};
  }catch(e){ if(e.message==='__ABORT__'||isBalanceError(e.message)) throw e; }   // let a real stop propagate; skip on transient hiccups
}
// which featured mode is active (selector wins, then saved batch setting, default pexels)
function featModeVal(){ return (($('featMode')&&$('featMode').value))||(ST.batch&&ST.batch.featMode)||'pexels'; }
// dispatch featured for a batch row by mode. manual = leave whatever the user set (usually none).
async function applyFeatured(kw, explicit){
  const m=featModeVal();
  if(m==='ai') await genFeaturedAI(kw);
  else if(m==='manual') { /* no auto featured */ }
  else await fetchFeaturedFor(kw, explicit);
}

let batchPaused=false, batchRunning=false, batchStopped=false;
let batchAbort=null;   // AbortController so Stop cancels in-flight API calls immediately
// detect Runware out-of-credit / balance-reserved errors
function isBalanceError(msg){ return /balance|insufficient|credit|concurrent request limit|reserved by in-flight/i.test(msg||''); }
// classify a systemic error that should HALT the whole batch (vs a one-article error). Returns {reason, link} or null.
function systemicStop(msg){
  msg=msg||'';
  if(isBalanceError(msg)) return {reason:'⚠ Runware is out of credit — image generation stopped. Top up your wallet, then Resume.', link:'https://my.runware.ai/'};
  if(/Runware key missing/i.test(msg)) return {reason:'⚠ Runware API key is missing — add it in Settings, then Resume.', link:''};
  if(/401|403|invalid.*key|authentication|x-api-key|Claude key missing/i.test(msg)) return {reason:'⚠ Claude API key problem (missing/invalid) — check it in Settings, then Resume.', link:''};
  if(/no site|select a (wp )?site|site in settings/i.test(msg)) return {reason:'⚠ No WordPress site selected — set it in Settings, then Resume.', link:''};
  if(/Network error|went to sleep|Failed to fetch|NETWORK_IO_SUSPENDED/i.test(msg)) return {reason:'⚠ Network lost (the computer may have gone to sleep). Check your connection, then Resume.', link:''};
  if(/overloaded/i.test(msg)) return {reason:'⚠ The AI service stayed overloaded after several retries. Wait a bit, then Resume.', link:''};
  return null;
}
function showStopBanner(reason,link){
  const b=$('runwareBanner'); if(!b)return;
  $('stopReason').innerHTML='<strong>'+esc(reason)+'</strong>';
  const a=$('stopLink'); if(a){ if(link){ a.href=link; a.style.display='inline'; } else a.style.display='none'; }
  b.style.display='block';
}
function showRunwareBanner(){ showStopBanner('⚠ Runware is out of credit — image generation stopped. Top up your wallet, then Resume.','https://my.runware.ai/'); }
let runwareOut=false, stopReasonMsg='';
function pauseBatch(){ batchPaused=true; $('bzPause').textContent='⏸ Pausing…'; bzStatusBanner('⏸ Finishing the current article, then pausing…','pause'); }
function stopBatch(){ batchStopped=true; batchPaused=true; $('bzStop').textContent='⏹ Stopping…';
  if(batchAbort)try{batchAbort.abort();}catch(e){}   // cancel in-flight API calls right now
  bzStatusBanner('⏹ Stopping now — cancelling the current article…','stop'); }
// prominent status banner over the progress bar
function bzStatusBanner(msg,kind){
  const lbl=$('bzProgLbl'); if(!lbl)return;
  lbl.textContent=msg;
  lbl.style.color = kind==='stop'?'#ff8a8a' : kind==='pause'?'#ffcf6a' : 'var(--plum)';
  lbl.style.fontWeight='700';
}
async function runBatch(){
  if(batchRunning) return;
  if(!getSite()){toast('Add & select a WP site in Settings','err');openSettings();return;}
  if(!keyReady('claude')){toast('Add your Claude key in Settings','err');openSettings();return;}
  const valid=ST.batch.rows.filter(r=>r.kw.trim());
  if(valid.length<1){toast('Add at least one keyword','err');return;}
  ST.batch.status=$('bzStatus').value; ST.batch.featMode=$('featMode')?$('featMode').value:(ST.batch.featMode||'pexels'); ST.batch.mode=$('bzMode').value; saveBatch();
  const reviewMode=ST.batch.mode==='review';
  batchRunning=true; batchPaused=false; batchStopped=false; runwareOut=false; stopReasonMsg=''; batchAbort=new AbortController();
  $('bzProgLbl').style.color=''; $('bzProgLbl').style.fontWeight='';
  $('bzRun').style.display='none'; $('bzPause').style.display='inline-flex'; $('bzPause').textContent='⏸ Pause';
  $('bzStop').style.display='inline-flex'; $('bzStop').textContent='⏹ Stop'; $('bzAdd').disabled=true;
  const todo=ST.batch.rows.filter(r=>r.kw.trim()&&r.status!=='done');
  let done=0;
  for(const r of todo){
    if(batchPaused) break;
    r.status='running'; r.error=''; renderBatch(); saveBatch();
    bzProg(Math.round(done/todo.length*100),`Article ${done+1}/${todo.length}: ${r.kw}`);
    try{
      if(r.refUrl && !r.styleBlock){ try{ r.styleBlock=await styleFromRefUrl(r.refUrl); saveBatch(); }catch(e){} }
      applyRowToFields(r);
      await applyFeatured(r.featKW||r.kw, !!r.featKW);
      let ok=false, lastErr='';
      for(let attempt=0;attempt<2 && !ok;attempt++){       // one auto-retry (bad JSON is often transient)
        try{
          await generateArticle();
          if(!ST.article) throw new Error('generation failed');
          if(batchStopped){
            // Runware ran out mid-images: SAVE the finished text to Review (don't waste the Claude tokens), then stop
            if(runwareOut && ST.article){ try{ await stageForReview(ST.batch.status); r.status='done'; r.link='(images pending — top up Runware, then regenerate in Review)'; }catch(e){ r.status=''; } }
            else { r.status=''; }
            renderBatch(); saveBatch(); break;
          }
          if(reviewMode){
            const rr=await stageForReview(ST.batch.status);
            if(rr&&rr.ok){ r.status='done'; r.link=''; ok=true; }
            else throw new Error('staging failed');
          } else {
            const res=await publish(ST.batch.status);
            if(res&&res.ok){ r.status='done'; r.link=res.link; ok=true; }
            else throw new Error(res&&res.error?res.error:'publish failed');
          }
        }catch(err){ lastErr=err.message; if(attempt===0){ bzProg(Math.round(done/todo.length*100),`Retrying ${done+1}/${todo.length}: ${r.kw}`); } }
      }
      if(!ok) throw new Error(lastErr||'failed');
    }catch(e){
      if(e.message==='__ABORT__'){ r.status=''; renderBatch(); saveBatch(); break; }   // manual Stop
      if(batchStopped){ break; }                                                        // balance stop already handled above
      const sys=systemicStop(e.message);
      if(sys){                                                                          // systemic → halt whole batch + banner
        stopReasonMsg=sys.reason; showStopBanner(sys.reason,sys.link);
        batchStopped=true; runwareOut=isBalanceError(e.message);
        if(ST.article){ try{ await stageForReview(ST.batch.status); r.status='done'; r.link='(images pending — fix the issue, then regenerate in Review)'; }catch(x){ r.status='error'; r.error=e.message; } }
        else { r.status='error'; r.error=e.message; }
        renderBatch(); saveBatch(); break;
      }
      r.status='error'; r.error=e.message;                                              // one-article error → keep going
    }
    done++; renderBatch(); saveBatch();
    if(batchStopped||batchPaused) break;
  }
  // if hard-stopped, put any still-running row back to queued
  if(batchStopped){ ST.batch.rows.forEach(r=>{ if(r.status==='running') r.status=''; }); saveBatch(); renderBatch(); }
  batchAbort=null;
  bzStatusBanner(stopReasonMsg?stopReasonMsg:(batchStopped?'⏹ Stopped — progress saved':(batchPaused?'⏸ Paused — press Resume to continue':(reviewMode?'✅ Batch staged — open Review':'✅ Batch finished'))), (batchStopped||stopReasonMsg)?'stop':(batchPaused?'pause':'done'));
  $('bzFill').style.width=batchStopped?'0%':'100%';
  batchRunning=false;
  $('bzRun').style.display='inline-flex'; $('bzRun').textContent=(batchPaused&&!batchStopped)?'▶️ Resume':'▶️ Start';
  $('bzPause').style.display='none'; $('bzStop').style.display='none'; $('bzAdd').disabled=false;
  toast(batchStopped?'Batch stopped — progress saved':(batchPaused?'Batch paused — progress saved':(reviewMode?'Batch staged — open 👀 Review to check & publish':'Batch finished')),'ok');
  updateReviewCount();
  if(reviewMode && !batchStopped && !batchPaused && ST.review.length) openReview();
}
