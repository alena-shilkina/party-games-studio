/* ═══════════ PREVIEW RENDER ═══════════ */
const CALLOUT_ICONS={"You'll need":'🧺',"How to play":'▶️',"Host tip":'💡',"Best for":'👥',"Make it easier":'✅',"Why it works":'✨'};
function calloutHTML(c){
  if(!c||!c.kind||!c.items||!c.items.length)return'';
  const ic=CALLOUT_ICONS[c.kind]||'📌';
  const inner=c.items.length>1
    ? `<ul style="margin:6px 0 0;padding-left:20px">${c.items.map(x=>`<li>${x}</li>`).join('')}</ul>`
    : `<p style="margin:4px 0 0">${c.items[0]}</p>`;
  return `<div style="background:#f7f2fb;border:1px solid #e6d7f2;border-radius:10px;padding:12px 16px;margin:14px 0"><strong style="color:#5b3a76">${ic} ${c.kind}</strong>${inner}</div>`;
}
function renderPreview(){
  const a=ST.article; if(!a)return;
  const feat=ST.feat?`<img class="pv-hero" src="${ST.feat.url}">`:`<div class="pv-hero" style="display:flex;align-items:center;justify-content:center;color:var(--muted)">No featured image</div>`;
  const toc=buildTOC(a);
  let gamesHTML='';
  if((a.sections||[]).length){
    const sheets=(a.games||[]);
    gamesHTML=a.sections.map(sec=>{
      const own=sheets.map((g,i)=>[g,i]).filter(([g])=>(g.section||'')===(sec.heading||''));
      const isGames=own.some(([g])=>g.asset==='game');
      let secC=sec.content||'';
      if(isGames){ secC=gamesIntroOnly(secC); }   // games intro only — rules live under each H3
      return `<h2 style="margin:26px 0 10px" class="editable" contenteditable>${esc(sec.heading||'')}</h2>`
        +`<div class="editable" contenteditable>${secC}</div>`
        +own.map(([g,i])=>{
          if(g.asset==='game') return `<h3 style="margin:18px 0 6px" class="editable" contenteditable>${esc(g.name||'')}</h3><div class="editable" contenteditable>${g.content||''}</div>`+gameCard(g,i);
          return gameCard(g,i);
        }).join('')
        +sectionShopHTML(sec);   // curated Amazon list at end of section
    }).join('');
    const orphans=sheets.map((g,i)=>[g,i]).filter(([g])=>!a.sections.some(x=>(x.heading||'')===(g.section||'')));
    gamesHTML+=orphans.map(([g,i])=>gameCard(g,i)).join('');
  } else {
    let curG=null;
    gamesHTML=(a.games||[]).map((g,i)=>{
      let head='';
      if(g.group && g.group!==curG){ curG=g.group; head=`<h2 style="margin:26px 0 10px">${esc(curG)}</h2>`; }
      return head+gameCard(g,i)+sectionShopHTML(g);   // Amazon stack at end of each game (games mode too)
    }).join('');
  }
  const faq=(a.faq||[]).length?`<h2 id="sec-faq">Frequently Asked Questions</h2>`+a.faq.map(q=>
    `<div class="faq-q editable" contenteditable>${esc(q.question)}</div><div class="faq-a editable" contenteditable>${q.answer||''}</div>`).join(''):'';

  $('preview').innerHTML=`<div class="pv">${feat}<div class="pv-body">
    <div class="seo-box">
      <div class="r"><span class="k">Title</span><input id="e_title" value="${esc(a.title)}"></div>
      <div class="r"><span class="k">Slug</span><input id="e_slug" value="${esc(a.slug)}"></div>
      <div class="r"><span class="k">Meta desc</span><textarea id="e_meta" rows="2">${esc(a.metaDescription)}</textarea></div>
      <div class="r"><span class="k">Focus KW</span><input id="e_fkw" value="${esc(a.focusKeyword)}"></div>
    </div>
    <h1 class="title editable" contenteditable data-f="titleH" data-article-id="${esc(articleStamp(a))}">${esc(a.title)}</h1>
    <div class="editable" contenteditable data-f="intro">${a.intro||''}</div>
    ${toc}
    ${gamesHTML}
    ${faq}
  </div></div>
  ${PINS_ENABLED?`<div class="pins-wrap"><h2 style="font-family:'Fraunces',serif">📌 Pinterest Pins</h2>
    <div class="pins-grid" id="pinsGrid"></div></div>`:''}`;
  renderPins();
  renderPubbar();
}
function buildTOC(a){
  const faqLink=(a.faq||[]).length?`<a href="#sec-faq">Frequently Asked Questions</a>`:'';
  // printables: list the article's SECTIONS (matching the H2s in the body), not individual sheets
  if((a.sections||[]).length){
    const links=a.sections.map((s,i)=>`<a href="#sec-${i}">${i+1}. ${esc(s.heading||'')}</a>`).join('');
    return `<div class="toc"><strong>Table of Contents</strong>${links}${faqLink}</div>`;
  }
  const g=(a.games||[]); if(!g.length)return'';
  const links=g.map((x,i)=>`<a href="#game-${i}">${i+1}. ${esc(x.name)}</a>`).join('');
  return `<div class="toc"><strong>Table of Contents</strong>${links}${faqLink}</div>`;
}
// One idea's FULL published shape, rendered live: numbered heading, the actual prose, the main
// image sitting right next to the paragraph it illustrates, every extra detail shot in the same
// spot they'll occupy on the site, the planner block, and the idea's own shopping list. This is
// what previously only existed at publish time — the live preview and Review skipped straight to
// a bare image, which is exactly how a mismatched or wrong detail shot went unnoticed until it
// was already live. regen/regenExtra let the caller wire this to either the working article
// (regenImg/regenExtraImg) or a Review-queue snapshot (reviewRegen/reviewRegenExtra).
// Промпт рядом с каждой кнопкой «Regenerate». Раньше его не показывали нигде, и
// перегенерировать приходилось вслепую: если лист вышел не тем, поправить формулировку
// было негде. Свёрнут по умолчанию, чтобы не загромождать превью.
// setter — готовое выражение вида "setGamePrompt(3,this.value)": оно решает, куда писать,
// в рабочую статью или в снимок очереди ревью.
function promptBox(text,setter,label){
  if(!setter) return '';
  return `<details class="pw"><summary>✎ ${esc(label||'Prompt')}</summary>
    <textarea spellcheck="false" onchange="${setter}" placeholder="image prompt for this sheet…">${esc(text||'')}</textarea>
    <small>Edits are saved as you type and apply the next time you press Regenerate.</small></details>`;
}
function setGamePrompt(i,val){ const g=ST.article&&ST.article.games&&ST.article.games[i]; if(g) g.imagePrompt=val; }
function setGameExtraPrompt(i,k,val){
  const g=ST.article&&ST.article.games&&ST.article.games[i]; if(!g) return;
  g.extraImagePrompts=g.extraImagePrompts||[]; g.extraImagePrompts[k]=val;
}
function ideaBlockHTML(g,i,opts){
  opts=opts||{};
  const editable=opts.editable!==false;
  const idAttr=opts.idPrefix?`${opts.idPrefix}-${i}`:`gc-${i}`;
  const wantsImg=!!g.imagePrompt||g.asset==='printable'||g.asset==='illustration';
  const heading=(opts.showHeading===false)?'':
    `<h3 ${editable?'class="editable" data-ed="name" contenteditable':''} style="margin:20px 0 6px">${opts.ideaNo?opts.ideaNo+'. ':''}${esc(g.name||'')}</h3>`;
  const content=(g.content||g.content==='')?`<div ${editable?'class="editable" data-ed="content" contenteditable':''}>${g.content||''}</div>`:'';
  const mainImg=g._img
    ?`<figure style="margin:16px auto;text-align:center;max-width:${g.asset==='illustration'?'620':'480'}px">
        <img src="${g._img}" style="display:block;width:100%;border-radius:8px;border:1px solid var(--line)">
        <figcaption style="margin-top:6px;display:flex;gap:8px;justify-content:center;align-items:center;font-size:12px">
          <button class="btn btn-ghost btn-sm" style="width:auto" onclick="${opts.regen}">🔄 Regenerate</button>
          <a class="btn btn-ghost btn-sm" style="width:auto" href="${g._img}" download="${g._file||'sheet.png'}" target="_blank">↓ Download</a>
          <span class="fn">${g._file||''}</span>
        </figcaption></figure>`
    :(wantsImg?`<div class="ph" id="ph-${i}" style="max-width:340px;margin:16px auto">${g._err?('⚠ '+esc(g._err)):'…'}</div>`:'');
  const promptMain=wantsImg?promptBox(g.imagePrompt,opts.setPrompt):'';
  const extras=(g._imgs2||[]).filter(x=>x&&x.img);
  const extraHTML=extras.map((x,k)=>`<figure style="margin:16px auto;text-align:center;max-width:480px">
      <img src="${x.img}" style="display:block;width:100%;border-radius:8px;border:1px solid var(--line)">
      <figcaption style="margin-top:6px;display:flex;gap:8px;justify-content:center;align-items:center;font-size:12px">
        <span style="color:var(--muted)">extra shot ${k+1}</span>
        <button class="btn btn-ghost btn-sm" style="width:auto" onclick="${opts.regenExtra?opts.regenExtra(k):''}">🔄 Regenerate</button>
        <a class="btn btn-ghost btn-sm" style="width:auto" href="${x.img}" download="${x.file||'detail.png'}" target="_blank">↓ Download</a>
      </figcaption>
      ${promptBox((g.extraImagePrompts||[])[k],opts.setExtraPrompt?opts.setExtraPrompt(k):'','Prompt — extra shot '+(k+1))}
      </figure>`).join('');
  const planner=opts.showPlanner!==false?plannerHTML(g,opts.kw||''):'';
  const shop=opts.showShop!==false?sectionShopHTML(g):'';
  return `<div class="game-card" id="${idAttr}">${heading}${content}${mainImg}${promptMain}${extraHTML}${planner}${shop}</div>`;
}
function gameCard(g,i){
  // printables mode: show the idea's real published shape — heading, prose, main image, every
  // extra detail shot, planner and shop — not just a bare image.
  if(['prompts','ideas','recipes'].includes(v('articleMode')||'games') && g.asset!=='game'){
    return ideaBlockHTML(g,i,{
      idPrefix:'gc', kw:(ST.article&&ST.article.focusKeyword)||'',
      ideaNo:0,   // внутри статьи идеи не нумеруются
      regen:`regenImg(${i})`, regenExtra:k=>`regenExtraImg(${i},${k})`,
      setPrompt:`setGamePrompt(${i},this.value)`, setExtraPrompt:k=>`setGameExtraPrompt(${i},${k},this.value)`,
    });
  }
  return gameCardFull(g,i);
}
function gameCardFull(g,i){
  const badgeMap={active:'active',printable:'print',quiet:'quiet'};
  const wantsImg=g.type==='printable'||!!g.imagePrompt;
  let imgBlock='';
  if(wantsImg){
    if(g._img) imgBlock=`<img class="gc-img" src="${g._img}">`;
    else if(g._err) imgBlock=`<div class="pin-ph" style="aspect-ratio:auto;min-height:80px;color:var(--warn);font-family:ui-monospace,monospace">⚠ ${esc(g._err)}</div>`;
    else imgBlock=`<div class="pin-ph" style="aspect-ratio:auto;min-height:80px"><span class="spin"></span></div>`;
  }
  const tools=wantsImg?`<div class="gc-tools">
    <button class="btn btn-ghost btn-sm" onclick="regenImg(${i})">🔄 Regenerate</button>
    ${g._img?`<a class="btn btn-ghost btn-sm" href="${g._img}" download="${g._file||'game.png'}" target="_blank">↓ Download</a>`:''}
    <span class="fn">${g._file||''}</span></div>
    ${promptBox(g.imagePrompt,`setGamePrompt(${i},this.value)`)}`:'';
  // active / non-printable games get an optional video-demo control instead of an infographic
  let videoTools='';
  if(!wantsImg){
    const q=encodeURIComponent(g.video_query || (g.name+' '+(v('category')||'')+' party game how to play'));
    const qtt=encodeURIComponent(g.name);   // TikTok: game name only (its search does better with short queries)
    videoTools=`<div class="gc-tools" style="flex-direction:column;align-items:stretch;gap:6px;border-top:1px dashed var(--line);padding-top:8px">
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <span style="font-size:11px;color:var(--muted)">🎬 optional demo video:</span>
        <a class="btn btn-ghost btn-sm" style="width:auto" href="https://www.youtube.com/results?search_query=${q}" target="_blank">▶️ YouTube</a>
        <a class="btn btn-ghost btn-sm" style="width:auto" href="https://www.tiktok.com/search?q=${qtt}" target="_blank">🎵 TikTok</a>
        <input id="gv-${i}" placeholder="paste a video URL…" value="${esc(g._video||'')}" onchange="setGameVideo(${i},this.value)" style="flex:1;min-width:150px;padding:6px 8px;font-size:12px;border-radius:8px">
      </div>
      <div id="gvp-${i}">${videoPreviewHTML(g._video)}</div>
    </div>`;
  }
  return `<div class="game-card" id="gc-${i}">
    <div class="gc-body">
      <h3 id="game-${i}" class="editable" data-ed="name" contenteditable>${(v('articleMode')||'games')==='ideas'||!SECTION_MODES.includes(v('articleMode')||'games')?(i+1)+'. ':''}${esc(g.name)} <span class="badge ${badgeMap[g.type]||'active'}">${g.type}</span></h3>
      <div class="editable" data-ed="content" contenteditable>${g.content||''}</div>
      ${calloutHTML(g.callout)}
      ${videoTools}
    </div>
    ${imgBlock}${tools}</div>`;
}
function getYouTubeId(url){ const m=(url||'').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/); return m?m[1]:null; }
function getTikTokId(url){ const m=(url||'').match(/video\/(\d+)/); return m?m[1]:null; }
function videoPreviewHTML(url){
  if(!url) return '';
  const yt=getYouTubeId(url);
  if(yt) return `<iframe width="100%" height="220" src="https://www.youtube-nocookie.com/embed/${yt}" loading="lazy" frameborder="0" allow="accelerometer;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen style="display:block;border-radius:8px"></iframe>`;
  const tt=getTikTokId(url);
  if(tt) return `<blockquote class="tiktok-embed" cite="${esc(url)}" data-video-id="${tt}" style="max-width:100%;min-width:280px;margin:0"><section></section></blockquote><script async src="https://www.tiktok.com/embed.js"><\/script>`;
  return `<span style="font-size:12px;color:var(--muted)">🔗 Link added (no preview)</span>`;
}
function setGameVideo(i,url){
  const g=ST.article.games[i]; g._video=(url||'').trim();
  const p=$('gvp-'+i); if(p) p.innerHTML=videoPreviewHTML(g._video);
}
function setGameImgState(i){ const g=ST.article.games[i]; g._img=null; g._err=null; rerenderGame(i); }
function rerenderGame(i){ const card=$('gc-'+i); if(card) card.outerHTML=gameCard(ST.article.games[i],i); }
async function regenImg(i){
  const g=ST.article.games[i]; if(!g.imagePrompt){toast('No image prompt for this game','err');return;}
  g._img=null; g._err=null; rerenderGame(i);
  try{ g._img=await runwareGen(withStyle(g.imagePrompt,g.asset),SIZE_PRINT.w,SIZE_PRINT.h,3,g.asset==='illustration'?null:sheetRef()); g._file=g._file||buildFilename(ST.article.focusKeyword,g.name,i); }
  catch(e){ g._err=e.message; }
  rerenderGame(i);
}
// regenerate ONE extra detail shot (g._imgs2[k]) without touching the main image or the other extras
async function regenExtraImg(i,k){
  const g=ST.article.games[i]; const extras=g._imgs2||[]; const prompt=(g.extraImagePrompts||[])[k];
  if(!prompt){toast('No prompt stored for this detail shot','err');return;}
  extras[k]={img:null,file:extras[k]&&extras[k].file}; g._imgs2=extras; rerenderGame(i);
  try{
    const u=await runwareGen(withStyle(prompt,g.asset),SIZE_PRINT.w,SIZE_PRINT.h,3,g.asset==='illustration'?null:sheetRef());
    extras[k]={img:u,file:extras[k].file||buildFilename(ST.article.focusKeyword,(g.name||'')+'-detail-'+(k+1),i)};
  }catch(e){ toast(e.message,'err'); }
  g._imgs2=extras; rerenderGame(i);
}
function renderPins(){
  const grid=$('pinsGrid'); if(!grid)return;
  grid.innerHTML=ST.pins.map((p,i)=>`<div class="pin">
    ${p.img?`<img src="${p.img}">`:`<div class="pin-ph">${p.err?'⚠ '+esc(p.err):'<span class=spin></span>'}</div>`}
    <div class="pin-t"><b style="color:var(--ink)">${esc(p.headline||p.title)}</b>
      ${p.img?`<a href="${p.img}" download="${p.file||'pin.png'}" target="_blank" style="float:right;color:var(--plum)">↓</a>
      <button onclick="regenPin(${i})" style="float:right;background:none;border:none;cursor:pointer;color:var(--muted);margin-right:6px">🔄</button>`:''}
      <br><span style="font-size:10px">kw: ${esc(p.title)}${p.mode?` · ${esc(p.mode)}`:''}${p.cta?` · CTA: ${esc(p.cta)}`:''}${p.layout?` · ${esc(p.layout)}`:''}</span></div>
  </div>`).join('');
}
async function regenPin(i){
  const prompt=ST.pins[i].prompt || buildPinPrompt(ST.pins[i].headline||ST.pins[i].title, themeBG(), PIN_LAYOUTS[i%PIN_LAYOUTS.length], currentVibeBlock(), ST.pins[i].cta, ST.pins[i].mode);
  ST.pins[i].img=null;ST.pins[i].err=null;renderPins();
  try{ST.pins[i].img=await runwareGen(prompt,SIZE_PIN.w,SIZE_PIN.h);ST.pins[i].file=buildFilename(ST.pins[i].headline||ST.pins[i].title,'pin',i);}catch(e){ST.pins[i].err=e.message;}
  renderPins();
}

/* ---------- collect edits from contenteditable back into ST.article ---------- */
// a cheap stable fingerprint of an article, used to tell whether the editor is showing THIS one
function articleStamp(a){ return a?String(a.slug||a.focusKeyword||a.title||'').slice(0,80):''; }
function syncEdits(){
  const a=ST.article; if(!a)return;
  // The editor fields belong to whichever article was last RENDERED. Publishing straight from the
  // review queue never re-renders them, so reading the DOM here used to overwrite the outgoing
  // article with the stale one on screen — that is how a whole batch went out under one title.
  // The preview is stamped with the article it shows; if it does not match, we leave the data alone.
  const stamp=document.querySelector('#preview [data-article-id]');
  const shown=stamp?stamp.getAttribute('data-article-id'):null;
  const mine=articleStamp(a);
  // Редактор может показывать ДРУГУЮ статью — или не показывать ничего. Второй случай
  // и был дырой: при публикации прямо из очереди ревью превью не отрисовано, полей
  // e_title / e_slug / e_meta в DOM нет, v() возвращает для них пустую строку — и мы
  // затирали заголовок, адрес и мета-описание. Статья уходила на сайт без заголовка.
  // Забирать правки не из чего — выходим, данные оставляем как есть.
  if(!shown){
    console.warn('[PGS] syncEdits skipped: editor is not showing anything');
    return;
  }
  if(mine && shown!==mine){
    console.warn('[PGS] syncEdits skipped: editor is showing a different article');
    return;
  }
  // Пустое поле не должно стирать то, что уже есть: чистить заголовок или адрес
  // намеренно незачем, а вот потерять их из-за пропавшего поля — легко.
  a.title=v('e_title')||a.title; a.slug=v('e_slug')||a.slug;
  a.metaDescription=v('e_meta')||a.metaDescription; a.focusKeyword=v('e_fkw')||a.focusKeyword;
  const q=s=>document.querySelector(s);
  a.intro=q('[data-f="intro"]')?.innerHTML||a.intro;
  a.closing=q('[data-f="closing"]')?.innerHTML||a.closing;
  a.title=q('[data-f="titleH"]')?.textContent||a.title;
  (a.games||[]).forEach((g,i)=>{
    const card=$('gc-'+i); if(!card)return;
    const nm=card.querySelector('[data-ed="name"]'), ct=card.querySelector('[data-ed="content"]');
    if(nm) g.name=nm.textContent.replace(/^\s*\d+\.\s*/,'').replace(/\s*(active|printable|quiet)\s*$/i,'').trim();
    if(ct) g.content=ct.innerHTML;
  });
  const fqs=document.querySelectorAll('.faq-q'); const fas=[...document.querySelectorAll('.faq-a')];   // own class: sibling-tag selectors broke when the markup changed
  if(fqs.length)a.faq=[...fqs].map((x,i)=>{
    const prev=(a.faq&&a.faq[i])||{};
    const ans=fas[i]?fas[i].innerHTML.trim():'';
    // never let a missing/empty node wipe an answer that already exists
    return {question:x.textContent||prev.question||'', answer:ans||prev.answer||''};
  });
}
