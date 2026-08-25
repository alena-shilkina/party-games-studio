/* ---------- REVIEW QUEUE ---------- */
function loadReview(){ try{ ST.review=JSON.parse(localStorage.getItem('pgs_review')||'[]')||[]; }catch(e){ ST.review=[]; } updateReviewCount(); }
function saveReview(){
  try{ localStorage.setItem('pgs_review',JSON.stringify(ST.review)); }
  catch(e){
    // storage full — usually a heavy hand-uploaded data-URI reference. Keep light remote CSV refs, drop only bulky data: URIs, retry.
    try{
      const slim=ST.review.map(s=>(s&&s.styleRef&&/^data:/i.test(s.styleRef))?Object.assign({},s,{styleRef:null}):s);
      localStorage.setItem('pgs_review',JSON.stringify(slim));
      ST.review=slim;
      toast('Review saved — a bulky uploaded reference was dropped to fit storage (CSV ref_urls are kept)','err');
    }catch(e2){ toast('Could not save review queue: browser storage is full','err'); }
  }
  updateReviewCount();
}
function updateReviewCount(){ const el=$('bzReviewCount'); if(el)el.textContent=(ST.review||[]).length; }
// upload this article's images to WP media (get light URLs) but DON'T create the post; push a snapshot to the review queue
async function stageForReview(status){
  syncEdits();
  const site=getSite(); const a=ST.article; if(!a) throw new Error('nothing to stage');
  let feat=null;
  if(ST.feat){ try{ const f=await wpSideload(site,ST.feat.url,a.slug+'-featured',a.title,ST.feat.credit?'Photo: '+ST.feat.credit+' (Pexels)':''); feat={url:f.src,credit:ST.feat.credit,mediaId:f.id}; }catch(e){} }
  for(let i=0;i<(a.games||[]).length;i++){ const g=a.games[i];
    if(g._img && !String(g._img).startsWith(site.url)){
      try{ const up=await wpSideload(site,g._img,g._file||buildFilename(a.focusKeyword,g.name,i),g.name+' printable game sheet',''); g._img=up.src; }catch(e){}
    } }
  for(let i=0;i<ST.pins.length;i++){ const p=ST.pins[i];
    if(p.img && !String(p.img).startsWith(site.url)){
      try{ const up=await wpSideload(site,p.img,p.file||('pin-'+(i+1)),p.headline||p.title,p.headline||p.title); p.img=up.src; }catch(e){}
    } }
  const snap={ id:crypto.randomUUID(), title:a.title, status, when:Date.now(),
    article:JSON.parse(JSON.stringify(a)), pins:JSON.parse(JSON.stringify(ST.pins)),
    feat, pubCat:ST.pubCat||null,
    styleBlock:styleText(), styleRef:sheetRef()||null, refMode:refModeNow(), siteDomain:siteDomain(), category:v('category'), audience:v('audience'),
    mode:(v('articleMode')||'games') };   // the renderer reads the mode, so it must travel WITH the snapshot   // styleRef pins the reference IMAGE so every regen stays in the set's look
  ST.review.push(snap); saveReview();
  return {ok:true};
}
function openReview(){ renderReview(); $('reviewZone').classList.add('on'); }
function closeReview(){ $('reviewZone').classList.remove('on'); }
// The review queue is an image-QA grid, so the prose never appeared there and the text was only visible
// after publishing. This renders a lightweight, collapsible read-through of the snapshot's own text.
function reviewTextPreview(s){
  const a=s.article||{}; if(!a) return '';
  const plain=h=>String(h||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const words=(plain(a.intro)+' '+(a.sections||[]).map(x=>plain(x.content)).join(' ')+' '
              +(a.games||[]).map(g=>plain(g.content)).join(' ')).split(/\s+/).filter(Boolean).length;
  const st={p:'margin:4px 0;font-size:12px;line-height:1.5;color:var(--ink)'};
  let h=`<p style="${st.p};font-style:italic;color:var(--muted)">${esc(plain(a.metaDescription||''))}</p>`;
  h+=`<div style="${st.p}">${a.intro||''}</div>`;
  const secs=a.sections||[], games=a.games||[];
  if(secs.length){
    secs.forEach(sec=>{
      h+=`<p style="margin:12px 0 2px;font-weight:700;font-size:13px">${esc(sec.heading||'')}</p>`;
      if(plain(sec.content)) h+=`<div style="${st.p};color:var(--muted)">${sec.content}</div>`;
      games.filter(g=>String(g.section||'')===String(sec.heading||'')).forEach(g=>{
        h+=`<p style="margin:8px 0 2px;font-weight:600;font-size:12px">▸ ${esc(g.name||'')}</p>`;
        if(plain(g.content)) h+=`<div style="${st.p}">${g.content}</div>`;
        const pl=Array.isArray(g.planner)?g.planner:[];
        pl.forEach(b=>{ if(b&&b.label&&(b.items||[]).filter(Boolean).length)
          h+=`<p style="${st.p};color:var(--muted)"><b>${esc(b.label)}:</b> ${esc(b.items.filter(Boolean).join(' · '))}</p>`; });
        const sh=(g.shop||[]).filter(x=>x&&x.label);
        if(sh.length) h+=`<p style="${st.p};color:var(--muted)">🛍 ${esc(sh.map(x=>x.label).join(' · '))}</p>`;
      });
    });
  }else{
    games.forEach((g,i)=>{
      h+=`<p style="margin:8px 0 2px;font-weight:600;font-size:12px">${i+1}. ${esc(g.name||'')}</p>`;
      if(plain(g.content)) h+=`<div style="${st.p}">${g.content}</div>`;
    });
  }
  if((a.faq||[]).length) h+=`<p style="margin:12px 0 2px;font-weight:700;font-size:13px">FAQ (${a.faq.length})</p>`
    +a.faq.map(q=>`<p style="${st.p}"><b>${esc(q.question||'')}</b> ${esc(plain(q.answer))}</p>`).join('');
  return `<details style="margin:8px 0"><summary style="cursor:pointer;font-size:11px;color:var(--muted)">📄 Read the text (${words} words) — this is what will be published</summary>
    <div style="max-height:340px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin-top:6px;background:var(--paper)">${h}</div></details>`;
}
// Builds ONE snapshot's body in the exact order it will actually appear on the site: section
// heading, then each idea's own numbered heading + prose sitting right above its own main image,
// every extra detail shot in its real spot, planner and shop — the same assembly gamesBodyHTML
// does at publish time, just with local images instead of uploaded ones. This replaced a bare
// end-of-card thumbnail grid that showed only main images with no relation to the text, which is
// exactly how a mismatched detail image went unnoticed until it was already live.
function reviewArticleBodyHTML(s){
  const a=s.article||{}; const games=a.games||[]; const secs=a.sections||[];
  const mode=s.mode||inferMode(a)||'games';
  const opts=(g,i)=>({idPrefix:'rv-'+s.id+'-gc', kw:a.focusKeyword||'', editable:false,
    ideaNo:mode==='ideas'?0:0,   // numbering assigned by the caller below when it applies
    regen:`reviewRegen('${s.id}',${i})`, regenExtra:k=>`reviewRegenExtra('${s.id}',${i},${k})`,
    setPrompt:`reviewEditPrompt('${s.id}',${i},this.value)`,
    setExtraPrompt:k=>`reviewEditExtraPrompt('${s.id}',${i},${k},this.value)`});
  let h=`<p style="font-style:italic;color:var(--muted);font-size:12px;margin:0 0 10px">${esc(a.metaDescription||'')}</p>`;
  h+=`<div style="font-size:13px;line-height:1.6;margin-bottom:14px">${a.intro||''}</div>`;
  if(secs.length){
    secs.forEach(sec=>{
      h+=`<h2 style="margin:22px 0 8px;font-size:16px">${esc(sec.heading||'')}</h2>`;
      const isGamesSec=games.some(g=>g.asset==='game'&&(g.section||'')===(sec.heading||''));
      if(!isGamesSec && sec.content) h+=`<div style="font-size:13px;color:var(--muted);margin-bottom:6px">${sec.content}</div>`;
      games.forEach((g,i)=>{
        if((g.section||'')!==(sec.heading||'')) return;
        if(g.asset==='game'){ h+=`<h3 style="margin:16px 0 4px;font-size:14px">${esc(g.name||'')}</h3><div style="font-size:13px">${g.content||''}</div>`+ideaBlockHTML(g,i,Object.assign(opts(g,i),{showHeading:false,showPlanner:false,showShop:false})); }
        else { h+=ideaBlockHTML(g,i,opts(g,i)); }   // без нумерации, как в статье
      });
    });
    games.forEach((g,i)=>{ if(!secs.some(x=>(x.heading||'')===(g.section||''))) h+=ideaBlockHTML(g,i,opts(g,i)); });
  }else{
    games.forEach((g,i)=>{ h+=ideaBlockHTML(g,i,opts(g,i)); });
  }
  if((a.faq||[]).length){
    h+=`<h2 style="margin:22px 0 8px;font-size:16px">FAQ</h2>`
      +a.faq.map(q=>`<p style="font-size:13px;margin:8px 0 2px"><b>${esc(q.question||'')}</b><br>${esc((q.answer||'').replace(/<[^>]+>/g,''))}</p>`).join('');
  }
  return h;
}
function renderReview(){
  const list=ST.review||[];
  $('rvCount').textContent=`(${list.length})`;
  if(!list.length){ $('rvBody').innerHTML='<p style="text-align:center;color:var(--muted);padding:40px">No articles waiting for review. Run a batch in "Review first" mode.</p>'; return; }
  $('rvBody').innerHTML=list.map(s=>{
    const games=s.article.games||[];
    const pinThumbs=(s.pins||[]).filter(p=>p.img).map(p=>`<img src="${p.img}" style="width:60px;height:90px;object-fit:cover;border-radius:6px;border:1px solid var(--line);margin:3px">`).join('');
    return `<div class="brow" id="rv-${s.id}">
      <div class="brow-head"><span style="flex:1;font-weight:600;font-size:14px">${esc(s.title)}</span>
        <span style="font-size:11px;color:var(--muted)">${games.filter(g=>g._img).length} infographics · ${(s.pins||[]).filter(p=>p.img).length} pins</span></div>
      <div style="max-height:520px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:14px 18px;margin:10px 0;background:var(--paper)" id="rv-body-${s.id}">${reviewArticleBodyHTML(s)}</div>
      <div style="font-size:11px;color:var(--muted);margin:8px 0 4px">Pins:</div><div>${pinThumbs||'<span style="color:var(--muted);font-size:12px">none</span>'}</div>
      <div style="display:flex;gap:8px;margin-top:12px;align-items:center">
        <button class="btn btn-ghost btn-sm" style="width:auto" onclick="reviewOpenEditor('${s.id}')">✏️ Open in editor</button>
        <span class="sp"></span>
        <button class="brow-x" onclick="reviewDiscard('${s.id}')" title="Discard">🗑</button>
        <button class="btn btn-ghost btn-sm" style="width:auto" onclick="reviewPublish('${s.id}','draft')">💾 Draft</button>
        <button class="btn btn-primary btn-sm" style="width:auto" onclick="reviewPublish('${s.id}','publish')">🚀 Publish</button>
        <span id="rvres-${s.id}" style="font-size:12px"></span>
      </div></div>`;
  }).join('');
}
function rerenderReviewBody(id){ const s=ST.review.find(x=>x.id===id); const el=$('rv-body-'+id); if(s&&el) el.innerHTML=reviewArticleBodyHTML(s); }
// regenerate ONE extra detail shot on a review-queue snapshot (does not touch the main image)
async function reviewRegenExtra(id,gi,k){
  const s=ST.review.find(x=>x.id===id); if(!s)return; const g=s.article.games[gi]; if(!g)return;
  ST.refMode=s.refMode||'';
  const extras=g._imgs2||[]; const prompt=(g.extraImagePrompts||[])[k];
  if(!prompt){toast('No prompt stored for this detail shot','err');return;}
  extras[k]={img:null,file:extras[k]&&extras[k].file}; g._imgs2=extras; rerenderReviewBody(id);
  try{
    const u=await runwareGen(withStyle(prompt,g.asset),SIZE_PRINT.w,SIZE_PRINT.h,3,g.asset==='illustration'?null:s.styleRef);
    extras[k]={img:u,file:extras[k].file||buildFilename(s.article.focusKeyword,(g.name||'')+'-detail-'+(k+1),gi)};
  }catch(e){ toast(e.message,'err'); }
  g._imgs2=extras; saveReview(); rerenderReviewBody(id);
}
function loadSnapIntoState(s){
  ST.article=JSON.parse(JSON.stringify(s.article));
  ST.pins=JSON.parse(JSON.stringify(s.pins||[]));
  ST.feat=s.feat?{url:s.feat.url,credit:s.feat.credit,mediaId:s.feat.mediaId}:null;
  ST.pubCat=s.pubCat||null;
  // restore the exact style so regeneration in the editor keeps THIS article's look (fixes random/childish restyles)
  ST.styleBlock=s.styleBlock||'';
  ST.refDataUri=s.styleRef||null;
  ST.refMode=s.refMode||'';   // регенерация в редакторе идёт в том же режиме, что и генерация   // restore the reference IMAGE too, so regenerating a single sheet in the editor stays in the set's look (not just the text style)
  const sb=$('styleBlock'); if(sb) sb.value=s.styleBlock||'';
  if(s.category && $('category')) $('category').value=s.category;
  if(s.audience && $('audience')) $('audience').value=s.audience;
  // the renderer decides the layout from the article mode, so restore it too — otherwise an ideas
  // article published later from the review queue was laid out as a plain listicle (images stacked).
  if($('articleMode')) $('articleMode').value=s.mode||inferMode(s.article)||'games';
}
// older snapshots predate the stored mode — work it out from the article's own shape
function inferMode(a){
  if(!a) return '';
  if((a.sections||[]).some(x=>x&&x.recipe)) return 'recipes';
  const hasSheets=(a.games||[]).some(g=>g&&g.asset&&g.asset!=='game');
  if((a.sections||[]).length && hasSheets){
    const ideaProse=(a.games||[]).filter(g=>g&&g.content&&String(g.content).trim()).length;
    return ideaProse?'ideas':'prompts';
  }
  return 'games';
}
// Правка промпта прямо в очереди ревью. Функция была написана давно, но к интерфейсу
// её никто не подключил — промпт нигде не показывался, и перегенерация шла вслепую.
function reviewEditPrompt(id,gi,val){
  const s=ST.review.find(x=>x.id===id); if(!s||!s.article.games[gi])return;
  s.article.games[gi].imagePrompt=val; saveReview();
}
function reviewEditExtraPrompt(id,gi,k,val){
  const s=ST.review.find(x=>x.id===id); const g=s&&s.article.games[gi]; if(!g)return;
  g.extraImagePrompts=g.extraImagePrompts||[]; g.extraImagePrompts[k]=val; saveReview();
}
// regenerate one infographic inside a staged article, re-upload, update the snapshot
async function reviewRegen(id,gi){
  const s=ST.review.find(x=>x.id===id); if(!s)return; const g=s.article.games[gi]; if(!g)return;
  ST.refMode=s.refMode||'';   // перерисовываем в том же режиме, в котором рисовали
  const site=getSite(); toast('Regenerating…','ok');
  try{
    // build the prompt straight from THIS snapshot — do NOT touch ST.article (the background batch may be mid-generation)
    // photographs and printable sheets need completely different prompts, here too
    const isIllus=g.asset==='illustration';
    const footer=(!isIllus&&s.siteDomain)?`\n\nAt the very bottom center, add a small, subtle footer text reading "${s.siteDomain}" in a tiny unobtrusive font.`:'';
    // Та же сборка, что и при обычной генерации: стилевой блок ВПЕРЕДИ, описание листа
    // как содержимое, замок стиля в конце. Раньше здесь был свой порядок — стиль ПОСЛЕ
    // описания и без замка в конце, — и перерисованный лист уезжал от остального набора.
    const prompt=withStyle(g.imagePrompt||('printable '+g.name), g.asset, s.styleBlock, footer);
    const img=await runwareGen(prompt,SIZE_PRINT.w,SIZE_PRINT.h,3,isIllus?null:(s.styleRef||null));   // sheets reuse the SET's reference; photos must not inherit a sheet reference
    const up=await wpSideload(site,img,buildFilename(s.article.focusKeyword,g.name,gi),g.name+(isIllus?'':' printable game sheet'),'');
    g._img=up.src; saveReview(); renderReview(); toast('Infographic redone','ok');
  }catch(e){ toast('Regen: '+e.message,'err'); }
}
function reviewOpenEditor(id){
  if(batchRunning){ toast('Wait for the batch to finish before opening in the editor','err'); return; }
  const s=ST.review.find(x=>x.id===id); if(!s)return;
  loadSnapIntoState(s);
  renderPreview(); renderPins(); renderPubbar();
  $('emptyState').style.display='none';
  closeReview(); closeBatch();
  toast('Loaded — regenerate images if needed, then Publish. It stays in Review until you publish.','ok');
}
// Publishing loads the snapshot into the SHARED ST state and then awaits the network. If a second
// article was started before the first finished, the second load overwrote ST mid-flight and BOTH
// posts went out with the later article's content. Everything below is serialised through one queue,
// and each job re-verifies that the state still belongs to it right before it publishes.
let publishChain=Promise.resolve(), publishBusy=0;
async function reviewPublish(id,status){
  if(batchRunning){ toast('Wait for the batch to finish before publishing from review','err'); return; }
  const s=ST.review.find(x=>x.id===id); if(!s)return;
  const res=$('rvres-'+id);
  publishBusy++;
  if(res)res.innerHTML=publishBusy>1?'<span style="color:var(--muted)">queued…</span>':'<span class="spin"></span>';
  // chain onto the previous job: only ever ONE publish is in flight
  publishChain=publishChain.then(async()=>{
    if(!ST.review.find(x=>x.id===id)) return;              // discarded while it waited
    if(res)res.innerHTML='<span class="spin"></span>';
    loadSnapIntoState(s);
    // guard: the state must be the one we just loaded, or we refuse rather than publish the wrong post
    const want=String(s.article&&s.article.title||'');
    const got=String(ST.article&&ST.article.title||'');
    if(want && got && want!==got){
      if(res)res.innerHTML='<span style="color:var(--warn)">state mismatch — not published</span>';
      console.error('[PGS] refused to publish: expected',want,'but state held',got);
      return;
    }
    let r;
    try{ r=await publish(status); }
    catch(e){ r={ok:false,error:e.message||'failed'}; }
    if(r&&r.ok){ ST.review=ST.review.filter(x=>x.id!==id); saveReview(); renderReview(); toast('Published from review','ok'); }
    else if(res){ res.innerHTML='<span style="color:var(--warn)">'+esc(r&&r.error||'failed')+'</span>'; }
  }).finally(()=>{ publishBusy=Math.max(0,publishBusy-1); });
  return publishChain;
}
function reviewDiscard(id){
  if(!confirm('Discard this article from review? (images already in WP media library stay there)'))return;
  ST.review=ST.review.filter(x=>x.id!==id); saveReview(); renderReview();
}

/* ---------- CSV → BATCH ROWS ---------- */
// proper CSV reader: walks the whole text, so a line break INSIDE a quoted cell stays in that cell
function parseCSV(text){
  const rows=[]; let row=[], cur='', q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){
      if(c==='"'){ if(text[i+1]==='"'){ cur+='"'; i++; } else q=false; }
      else cur+=c;                                    // newlines inside quotes are kept
    } else {
      if(c==='"') q=true;
      else if(c===','){ row.push(cur); cur=''; }
      else if(c==='\r'){ /* skip */ }
      else if(c==='\n'){ row.push(cur); rows.push(row); row=[]; cur=''; }
      else cur+=c;
    }
  }
  if(cur!==''||row.length){ row.push(cur); rows.push(row); }
  return rows.filter(r=>r.join('').trim()!=='').map(r=>r.map(s=>s.trim()));
}
function importBatchCSV(e){
  const f=e.target.files[0]; if(!f)return;
  const rd=new FileReader();
  rd.onload=()=>{
    let text=rd.result.replace(/^\uFEFF/,'');
    const table=parseCSV(text);
    if(!table.length){ toast('Empty CSV','err'); return; }
    const header=table[0].map(h=>h.toLowerCase().replace(/\s+/g,'_'));
    const col=name=>header.indexOf(name);
    const idx={ title:col('title'), kw:col('keyword'), pins:col('pin_headlines'), ctx:col('extra_info'),
      aud:col('audience'), cat:col('wp_category'), info:col('infographic_style'), vibe:col('pin_vibe'), dl:col('downloadable'),
      feat:col('featured_keyword'), ref:col('ref_url'), refmode:col('ref_mode'), mode:col('article_mode') };
    if(idx.kw<0 && idx.title<0){ toast('CSV needs at least a "title" or "keyword" column','err'); return; }
    const rows=[];
    for(let i=1;i<table.length;i++){
      const c=table[i];
      const get=k=>idx[k]>=0?(c[idx[k]]||'').trim():'';
      const r=blankRow();
      r.title=get('title'); r.kw=get('kw')||get('title'); r.context=get('ctx');
      r.pinKW=get('pins');   // pin headlines already use | — same separator as the app fields
      const aud=get('aud').toLowerCase(); r.aud=['adult','kids','mixed'].includes(aud)?aud:'adult';
      const info=(get('info')||'').trim().toLowerCase();
      const hit=INFO_STYLES.find(x=>x.id===info)||INFO_STYLES.find(x=>x.label.toLowerCase()===info)
             || INFO_STYLES.find(x=>info&&x.id.startsWith(info.split(/[\s-]/)[0]));
      r.infoStyle=hit?hit.id:'auto';   // CSV wins over any auto-style guess
      const vibe=get('vibe'); r.vibe=normVibe(vibe)||'Auto';   // case-insensitive: "neutral" → "Neutral"
      r.downloadable=/^(y|yes|true|1|да)$/i.test(get('dl')||'');   // ideas mode: does this article include printable sheets?
      r.featKW=get('feat');
      r.refUrl=get('ref');   // remote reference image URL (fetched at run time)
      // ref_mode задаёт, как использовать этот референс: style (только манера),
      // motifs (плюс персонажи), text (не отправлять картинку). Пусто — берётся
      // значение из панели пакета. Синонимы приняты, чтобы не спотыкаться о формулировку.
      const rm=get('refmode').toLowerCase().replace(/[^a-z]/g,'');
      r.refMode = /motif|character|bear/.test(rm) ? 'motifs' : /style|image/.test(rm) ? 'image' : '';
      const md=get('mode').toLowerCase(); r.mode=['games','prompts','ideas','recipes'].includes(md)?md:'games';   // blank → games (old files keep working)
      // wp category: accept ID or name
      const cat=get('cat');
      if(cat){ if(/^\d+$/.test(cat)) r.wpCat=cat;
        else { const hit=(ST.wpCats||[]).find(x=>String(x.name).replace(/\s*\(\d+\)\s*$/,'').toLowerCase()===cat.toLowerCase()); if(hit)r.wpCat=String(hit.id); } }
      rows.push(r);
    }
    if(!rows.length){ toast('No rows found in CSV','err'); return; }
    ST.batch.rows=rows; saveBatch(); renderBatch();
    toast('Imported '+rows.length+' articles from CSV','ok');
  };
  rd.readAsText(f); e.target.value='';
}
