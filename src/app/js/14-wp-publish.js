/* ═══════════ WORDPRESS PUBLISH ═══════════ */
function renderPubbar(){
  const cats=ST.wpCats||[];
  const opts=cats.length
    ? cats.map(c=>`<option value="${c.id}" ${String(c.id)===String(ST.pubCat||getSite()?.cat)?'selected':''}>${esc(c.name)}</option>`).join('')
    : `<option value="${getSite()?.cat||0}">${getSite()?.cat?('ID '+getSite().cat):'default'}</option>`;
  $('pubbarHost').innerHTML=`<div class="pubbar">
    <span class="badge print">${getSite()?esc(getSite().name):'No site'}</span>
    <label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:5px">Category
      <select id="pubCat" style="width:auto;padding:5px 8px" onchange="ST.pubCat=this.value">${opts}</select></label>
    <button class="btn btn-ghost btn-sm" style="width:auto" onclick="fetchWPCats(true)" title="Reload categories from WordPress">🔄</button>
    <span class="sp"></span>
    <button class="btn btn-ghost btn-sm" onclick="publish('draft')" id="btnDraft">💾 Save as Draft</button>
    <button class="btn btn-primary btn-sm" style="width:auto" onclick="publish('publish')" id="btnPub">🚀 Publish</button>
    <span id="pubResult"></span></div>`;
}
// Запросы к WordPress идут через наш Worker (/api/wp), а не напрямую из браузера:
// приложение и сайт теперь на разных доменах, и браузер бы такие запросы заблокировал.
// Worker ходит на сервер сам, там этого ограничения нет. Логика и заголовки — прежние.
const wpUrl=(site,file,qs)=>'/api/wp?site='+encodeURIComponent(site.url)+'&file='+file+(qs?'&'+qs:'');
// GET request through the proxy
async function wpGet(site,endpoint){
  const r=await fetch(wpUrl(site,'wp-proxy.php','endpoint='+encodeURIComponent(endpoint)),
    {method:'GET',headers:{'X-WP-User':site.username,'X-WP-Pass':site.password,'X-WP-Method':'GET'}});
  if(!r.ok) throw new Error('WP '+r.status);
  return r.json();
}
// pull categories from the active WordPress site into a dropdown
async function fetchWPCats(notify){
  const site=getSite(); if(!site){ if(notify)toast('Select a site first','err'); return; }
  try{
    const cats=await wpGet(site,'categories?per_page=100&orderby=name&order=asc');
    if(Array.isArray(cats)) ST.wpCats=cats.map(c=>({id:c.id,name:c.name+(c.count!=null?` (${c.count})`:'')}));
    renderWPCatSelect();
    if(ST.article) renderPubbar();
    if(notify)toast(ST.wpCats.length+' categories loaded','ok');
  }catch(e){ if(notify)toast('Categories: '+e.message,'err'); }
}
// fill the sidebar WordPress-category dropdown
function renderWPCatSelect(){
  const sel=$('wpCatSelect'); if(!sel)return;
  if(!(ST.wpCats||[]).length){ sel.innerHTML='<option value="">— load categories —</option>'; return; }
  sel.innerHTML=ST.wpCats.map(c=>`<option value="${c.id}" ${String(c.id)===String(ST.pubCat)?'selected':''}>${esc(c.name)}</option>`).join('');
  if(!ST.pubCat) ST.pubCat=sel.value; // default to first
}
async function wpSideload(site,imageUrl,filename,alt,caption){
  // already hosted on this WP site (e.g. staged during review) → reuse, don't duplicate
  if(imageUrl && imageUrl.startsWith(site.url)) return {id:0,src:imageUrl};
  const fd=new FormData();
  fd.append('source_url',imageUrl); fd.append('filename',(filename||'image').replace(/\.png$/,''));
  fd.append('wp_user',site.username); fd.append('wp_pass',site.password);
  if(alt)fd.append('alt_text',alt); if(caption)fd.append('caption',caption);
  const r=await fetch(wpUrl(site,'wp-media-proxy.php'),{method:'POST',body:fd});
  const d=await r.json();
  if(!r.ok||!d.id) throw new Error('Media upload: '+(d.error||r.status));
  return {id:d.id,src:d.source_url};
}
async function wpPost(site,data){
  const r=await fetch(wpUrl(site,'wp-proxy.php','endpoint=posts'),{method:'POST',
    headers:{'Content-Type':'application/json','X-WP-User':site.username,'X-WP-Pass':site.password,'X-WP-Method':'POST'},
    body:JSON.stringify(data)});
  if(!r.ok) throw new Error('Post: '+r.status);
  return r.json();
}
// build one flat, interleaved games body (H2 name + prose + callout + figure/video)
function shoppingPreviewHTML(a){
  const list=(a.shopping||[]).filter(x=>x&&x.item&&x.query);
  if(!list.length) return '';
  return `<h2 style="margin:26px 0 10px">${esc(a.shoppingHeading||'What You Need to Print and Style It')}</h2>`
    +`<p style="font-size:12px;color:var(--muted)"><em>${AFF_DISCLAIMER}</em></p><ul style="font-size:14px">`
    +list.map(x=>`<li><a href="${amazonSearchURL(x.query)}" target="_blank">${esc(x.item)}</a>${x.note?' — '+esc(x.note):''}</li>`).join('')+'</ul>';
}
const AMZ_TAG='redcheeksgirl-20';
const AFF_DISCLAIMER='This post contains affiliate links — if you buy through them, I may earn a small commission at no extra cost to you.';
// "What You Need" shopping list: category search links only (no invented brands/prices/ASINs)
function amazonSearchURL(query){
  const q=String(query||'').trim().toLowerCase().replace(/[^a-z0-9\s+-]/g,'').replace(/\s+/g,'+');
  return `https://www.amazon.com/s?k=${encodeURIComponent(q).replace(/%2B/g,'+')}&tag=${AMZ_TAG}`;
}
// keep only genuine intro prose for the games section — strip any paragraph that is actually game rules
// (rules belong under each game's H3, and the model often duplicates them into the section intro)
function gamesIntroOnly(html){
  if(!html) return '';
  const paras=String(html).match(/<p[\s\S]*?<\/p>/gi)||[];
  const isRules=p=>/players:|how to play:|time:|how to win:|answer key:|you need:|<strong>/i.test(p);
  const intro=paras.filter(p=>!isRules(p));
  return intro.length?intro[0]:'';   // a single short intro paragraph, never the rules
}
// convert href='amazon:some query' written by the model into a tagged Amazon search link
function linkifyAffiliate(html){
  if(!html) return html||'';
  return String(html).replace(/href=(["'])amazon:([^"']+)\1/gi,(m,q,query)=>
    `href="${amazonSearchURL(query)}" target="_blank" rel="nofollow sponsored noopener"`);
}
function hasAffiliate(a){
  const all=[(a.intro||''),...(a.sections||[]).map(s=>s.content||''),(a.closing||'')].join(' ');
  return /amazon:/i.test(all);
}
// A party-planner's notes card: what to set up, what to serve, which games fit. Rendered as a compact
// box with mini-headings so it scans fast and gives the page another content block between images.
// ── Planner card: same recognisable frame, DIFFERENT contents every article ──
// A fixed three-heading card repeated across 200 articles reads as a template (and as AI). So the block
// types and the card's own title are drawn from a pool, chosen deterministically from the keyword: two
// articles differ, but regenerating the same article stays stable.
const PLANNER_TITLES=["Party planner's notes","Host's cheat sheet","If you're recreating this","Steal this setup",
  "Worth knowing before you shop","The short version","Planner's shortlist","How to pull this off"];
const PLANNER_BLOCKS=[
  {icon:'\u2728',label:'Set the scene',       hint:'3-5 concrete set-up details — backdrop, garland, table styling, a height or lighting trick'},
  {icon:'\u{1F370}',label:'On the table',     hint:'3-5 on-theme things to serve, all matching the palette'},
  {icon:'\u{1F3B2}',label:'Games that fit',   hint:'3-5 game NAMES ONLY suited to this theme and age — no rules'},
  {icon:'\u{1F4B7}',label:'Cheap swap',       hint:'2-4 ways to get the same look for less, with the specific substitute named'},
  {icon:'\u23F1',label:'Twenty-minute version',hint:'2-4 shortcuts for a host who is short on time'},
  {icon:'\u{1F6AB}',label:'Skip this',        hint:'2-3 things that look good online but are not worth the money or effort here'},
  {icon:'\u{1F4F8}',label:'The photo moment', hint:'2-3 shots worth setting up, and where to stand for them'},
  {icon:'\u{1F381}',label:'Send them home with',hint:'2-4 favour or take-home ideas that match the theme'},
  {icon:'\u{1F5D3}',label:'Timing that works',hint:'2-4 notes on scheduling — naps, food order, when to do the cake'},
  {icon:'\u{1F528}',label:'Make it yourself', hint:'2-4 elements genuinely worth DIY-ing, and what to buy instead'},
  {icon:'\u{1F3E0}',label:'Small-space fix',  hint:'2-4 adjustments for a flat or a small living room'},
  {icon:'\u{1F49D}',label:'Keep it forever',  hint:'2-3 keepsake touches worth doing on the day'}
];
function seedNum(str){ let h=2166136261>>>0; const s=String(str||'x'); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h; }
// mulberry32 — a proper little PRNG, so the block choice is evenly spread instead of clustering
function rng32(seed){ let a=seed>>>0; return function(){ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
// pick n distinct blocks + a card title for THIS article
function plannerRecipe(kw){
  const seed=seedNum(kw), rnd=rng32(seed);
  const pool=PLANNER_BLOCKS.slice();
  const picked=[];
  const n=3+(rnd()<0.5?0:1);                   // 3 or 4 block types per article
  while(picked.length<n && pool.length) picked.push(pool.splice(Math.floor(rnd()*pool.length),1)[0]);
  return { title:PLANNER_TITLES[Math.floor(rnd()*PLANNER_TITLES.length)], blocks:picked };
}
function plannerHTML(g,kw){
  let rows=[];
  const rec=plannerRecipe(kw);
  const iconFor=l=>{ const b=PLANNER_BLOCKS.find(x=>x.label.toLowerCase()===String(l||'').toLowerCase()); return b?b.icon:'\u2022'; };
  if(Array.isArray(g&&g.planner)){
    rows=g.planner.filter(x=>x&&x.label&&Array.isArray(x.items)&&x.items.filter(Boolean).length)
                  .map(x=>[iconFor(x.label),x.label,x.items]);
  }else if(g&&g.planner&&typeof g.planner==='object'){   // older shape
    rows=[['\u2728','Set the scene',g.planner.decor],['\u{1F370}','On the table',g.planner.table],['\u{1F3B2}','Games that fit',g.planner.games]]
      .filter(r=>Array.isArray(r[2])&&r[2].filter(Boolean).length);
  }
  if(!rows.length) return '';
  return `<div class="pgs-planner" style="margin:18px 0;border:1px solid #e6ded2;border-left:4px solid #c9a24a;border-radius:12px;background:#fdfbf7;padding:16px 20px">`
    + `<p style="margin:0 0 10px;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#8a6d4b">${esc(rec.title)}</p>`
    + rows.map(([ic,label,items])=>
        `<p style="margin:10px 0 4px;font-weight:600;font-size:14px">${ic} ${esc(label)}</p>`
        +`<ul style="margin:0;padding-left:18px">`
        + items.filter(Boolean).map(x=>`<li style="margin:2px 0">${esc(String(x))}</li>`).join('')
        +`</ul>`).join('')
    + `</div>`;
}
function sectionShopHTML(sec){
  const list=(sec&&sec.shop||[]).filter(x=>x&&x.label&&x.query);
  if(!list.length) return '';
  return `<div class="pgs-shop" style="margin:18px 0 6px;border:1px solid #e4dcd0;border-radius:12px;background:#faf7f2;padding:14px 18px">`
    +`<p style="margin:0 0 8px;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#8a6d4b">🛍 Shopping guide</p>`
    +`<ul style="margin:0;padding-left:18px">`
    +list.map(x=>`<li style="margin:3px 0"><a href="${amazonSearchURL(x.query)}" target="_blank" rel="nofollow sponsored noopener">${esc(x.label)}</a></li>`).join('')
    +`</ul></div>`;
}
function shoppingHTML(a){
  const list=(a.shopping||[]).filter(x=>x&&x.item&&x.query);
  if(!list.length) return '';
  const heading=a.shoppingHeading||'What You Need to Print and Style It';
  return `<h2 id="sec-shopping">${esc(heading)}</h2>`
    + `<p><em>${AFF_DISCLAIMER}</em></p>`
    + `<ul>`+list.map(x=>`<li><a href="${amazonSearchURL(x.query)}" target="_blank" rel="nofollow sponsored noopener"><strong>${esc(x.item)}</strong></a>${x.note?' — '+esc(x.note):''}</li>`).join('')+`</ul>`;
}
async function gamesBodyHTML(a,site){
  let videoCount=0;
  const sheets=(a.games||[]);
  // render one sheet's image (upload + figure with download button)
  // extra detail shots for an idea — same photo treatment, each followed by its own vote widget
  const extraFigures=async(g,i)=>{
    const list=(g._imgs2||[]).filter(x=>x&&x.img);
    if(!list.length) return '';
    let out='';
    for(let k=0;k<list.length;k++){
      try{
        const alt=`${g.name||''} detail ${k+1}`.trim();
        const up=await wpSideload(site,list[k].img,list[k].file||buildFilename(a.focusKeyword,g.name+'-d'+k,i),alt,'');
        out+=`<figure class="pgs-illus" style="margin:20px auto;text-align:center;max-width:620px"><img src="${up.src}" class="wp-image-${up.id}" alt="${esc(alt)}" style="display:block;width:100%;max-width:100%;height:auto;border-radius:8px;border:1px solid #eee"/></figure>`
             +voteHTML(a,{name:alt},i*10+90+k);
      }catch(e){}
    }
    return out;
  };
  const sheetFigure=async(g,i)=>{
    if(!g._img) return '';
    try{
      const isIllus=g.asset==='illustration';   // editorial photo of the idea/dish — shown, not downloaded
      const alt=isIllus?esc(g.name):esc(g.name)+' printable';
      const up=await wpSideload(site,g._img,g._file||buildFilename(a.focusKeyword,g.name,i),alt,'');
      const dl=isIllus?'':`<figcaption style="margin-top:8px"><a class="pgs-dl" href="${up.src}" download="${g._file||'sheet.png'}" style="display:inline-block;border:1.5px solid #1a1a1a;color:#1a1a1a;padding:8px 20px;border-radius:24px;text-decoration:none;font-size:13px;transition:all .18s ease">↓ Download &amp; Print</a></figcaption>`;
      g._imgPublished=up.src;   // used by recipeSchema
      const cls=isIllus?'pgs-illus':'pgs-printable';
      const cap=isIllus?`<figcaption style="margin-top:6px;font-size:13px;color:#666">${esc(g.name)}</figcaption>`:'';
      return `<figure class="${cls}" style="margin:20px auto;text-align:center;max-width:${isIllus?'620':'480'}px"><img src="${up.src}" class="wp-image-${up.id}" alt="${alt}" style="display:block;width:100%;max-width:100%;height:auto;border-radius:8px;border:1px solid #eee"/>${cap}${dl}</figure>${voteHTML(a,g,i)}`;
    }catch(e){ return ''; }
  };
  // PRINTABLES MODE: article plan drives the structure; sheets are attached to sections
  if((a.sections||[]).length){
    let h='';
    const isIdeas=(v('articleMode')||'games')==='ideas';
    let ideaNo=0;   // ideas are a numbered round-up: "1. …" through "20. …" across the whole article
    // is this section the games section? — it holds at least one asset:"game" sheet
    const isGamesSec=sec=>sheets.some(g=>g.asset==='game' && (g.section||'')===(sec.heading||''));
    for(let si=0;si<a.sections.length;si++){
      const sec=a.sections[si];
      const games=isGamesSec(sec);
      // games section: the model sometimes dumps every game's rules into the section intro AND under each H3.
      // keep only a short intro (first paragraph) so the rules appear once, under their game.
      let secContent=sec.content||'';
      if(games){ secContent=gamesIntroOnly(secContent); }
      h+=`<h2 id="sec-${si}">${esc(sec.heading||'')}</h2>`+secContent;
      for(let i=0;i<sheets.length;i++){
        const g=sheets[i];
        if((g.section||'')!==(sec.heading||'')) continue;
        // games AND ideas: H3 name + its own prose, then the image. This alternation is what gives
        // Mediavine somewhere to place ads — a stack of images with no text between them is dead space.
        if(g.asset==='game'){ h+=`<h3 id="game-${i}">${esc(g.name||'')}</h3>`+(g.content||''); }
        else if(isIdeas && (g.name||g.content)){ h+=`<h3 id="game-${i}">${++ideaNo}. ${esc(g.name||'')}</h3>`+(g.content||''); }
        h+=await sheetFigure(g,i);
        if(isIdeas){
          h+=plannerHTML(g,a.focusKeyword);                 // text block between the images keeps ad slots alive
          h+=await extraFigures(g,i);        // optional detail shots (cake, table, decor close-up)
          h+=sectionShopHTML(g);             // every idea gets its own shopping guide
        }
      }
      h+=sectionShopHTML(sec);   // small curated Amazon list at the END of the section
    }
    // any sheet whose section didn't match falls at the end so nothing is lost
    for(let i=0;i<sheets.length;i++){
      const sec=sheets[i].section||'';
      if(!a.sections.some(x=>(x.heading||'')===sec)) h+=await sheetFigure(sheets[i],i);
    }
    return h;
  }
  // GAMES MODE: unchanged — one heading per game, prose, image, optional video
  let h='', curGroup=null;
  for(let i=0;i<sheets.length;i++){ const g=sheets[i];
    if(g.group && g.group!==curGroup){ curGroup=g.group; h+=`<h2 id="grp-${i}">${esc(curGroup)}</h2>`; }
    const tag=g.group?'h3':'h2';
    h+=`<${tag} id="game-${i}">${i+1}. ${g.name}</${tag}>${g.content||''}${calloutHTML(g.callout)}`;
    h+=await sheetFigure(g,i);
    if(g._video && videoCount<4){ h+=videoEmbedForPublish(g._video); videoCount++; }
    h+=sectionShopHTML(g);   // small curated Amazon list at the END of the game (same stack as printables)
  }
  return h;
}
// WP-safe embed: YouTube → lazy no-cookie iframe; TikTok → bare URL on its own line (WordPress oEmbed)
function videoEmbedForPublish(url){
  const yt=getYouTubeId(url);
  if(yt) return `<figure class="pgs-video" style="margin:20px auto;max-width:560px"><iframe width="100%" height="315" src="https://www.youtube-nocookie.com/embed/${yt}" loading="lazy" frameborder="0" allow="accelerometer;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen style="display:block;border-radius:8px"></iframe></figure>`;
  // TikTok (and anything else) → put the raw URL on its own paragraph so WordPress auto-embeds it
  return `<p class="pgs-video-url">${esc(url)}</p>`;
}
// ── VOTE WIDGET (😍 / 😐) — one per article image, never on the pins block ──
// Numbers are painted from data-attributes immediately, so they are visible before the network call.
function voteHTML(a,g,i){
  const seedL=120+Math.floor(Math.random()*380);
  const seedM=4+Math.floor(Math.random()*40);
  const slug=stripYearSafe(a.slug||a.focusKeyword||'post');
  return `<div class="rcg-vote" data-post="${esc(slug)}" data-item="${i+1}" data-sl="${seedL}" data-sm="${seedM}">`
    +`<span class="rcg-vote-q">Would you use this?</span>`
    +`<button type="button" class="rcg-vote-b" data-v="love"><span class="rcg-vote-e">&#128525;</span><span class="rcg-vote-n">${seedL}</span></button>`
    +`<button type="button" class="rcg-vote-b" data-v="meh"><span class="rcg-vote-e">&#128528;</span><span class="rcg-vote-n">${seedM}</span></button>`
    +`</div>`;
}
function stripYearSafe(x){ return String(x||'').replace(/20\d\d/g,'').replace(/--+/g,'-').replace(/^-|-$/g,''); }
const VOTE_ASSETS=`<style>
.rcg-vote{display:flex;align-items:center;justify-content:center;gap:8px;margin:6px 0 22px;flex-wrap:wrap}
.rcg-vote-q{font-size:14px;color:#6b6b6b;margin-right:2px}
.rcg-vote-b{display:inline-flex;align-items:center;gap:6px;border:1px solid #e0d8cc;background:#fff;border-radius:22px;padding:6px 14px;cursor:pointer;font-size:14px;line-height:1;transition:all .15s ease}
.rcg-vote-b:hover{border-color:#c9b79c;transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.08)}
.rcg-vote-b.voted{background:#f6efe3;border-color:#c9a24a;font-weight:600}
.rcg-vote-e{font-size:17px}
</style>
<script>
(function(){
  var EP='/rcg-votes.php';
  function paint(b,n){ var el=b.querySelector('.rcg-vote-n'); if(el) el.textContent=n; }
  document.querySelectorAll('.rcg-vote').forEach(function(w){
    var post=w.getAttribute('data-post'), item=w.getAttribute('data-item');
    var key='rcgv:'+post+':'+item;
    var mine=null; try{ mine=localStorage.getItem(key); }catch(e){}
    if(mine){ var b=w.querySelector('[data-v="'+mine+'"]'); if(b) b.classList.add('voted'); }
    fetch(EP+'?post='+encodeURIComponent(post)+'&item='+encodeURIComponent(item))
      .then(function(r){ return r.json(); })
      .then(function(d){
        if(!d) return;
        var lb=w.querySelector('[data-v="love"]'), mb=w.querySelector('[data-v="meh"]');
        if(typeof d.love==='number') paint(lb, +w.getAttribute('data-sl') + d.love);
        if(typeof d.meh==='number')  paint(mb, +w.getAttribute('data-sm') + d.meh);
      }).catch(function(){});
    w.querySelectorAll('.rcg-vote-b').forEach(function(btn){
      btn.addEventListener('click',function(){
        var v=btn.getAttribute('data-v');
        var had=null; try{ had=localStorage.getItem(key); }catch(e){}
        if(had) return;
        try{ localStorage.setItem(key,v); }catch(e){}
        btn.classList.add('voted');
        paint(btn, (parseInt(btn.querySelector('.rcg-vote-n').textContent,10)||0)+1);
        fetch(EP,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body:'post='+encodeURIComponent(post)+'&item='+encodeURIComponent(item)+'&v='+encodeURIComponent(v)}).catch(function(){});
      });
    });
  });
})();
<\/script>`;
// Google recipe markup (schema.org/Recipe) built from the structured "recipe" object on each section
function recipeSchema(a){
  const secs=(a.sections||[]).filter(x=>x&&x.recipe&&Array.isArray(x.recipe.ingredients)&&x.recipe.ingredients.length&&Array.isArray(x.recipe.steps)&&x.recipe.steps.length);
  if(!secs.length) return '';
  const items=secs.map((x,i)=>{
    const r=x.recipe;
    const o={"@context":"https://schema.org","@type":"Recipe",
      name:x.heading||'', author:{"@type":"Organization",name:'Red Cheeks Girl'},
      recipeIngredient:r.ingredients.map(String),
      recipeInstructions:r.steps.map(t=>({"@type":"HowToStep",text:String(t)}))};
    if(r.prepTime)  o.prepTime=r.prepTime;
    if(r.cookTime)  o.cookTime=r.cookTime;
    if(r.totalTime) o.totalTime=r.totalTime;
    if(r.yield)     o.recipeYield=String(r.yield);
    const img=(a.games||[]).find(g=>(g.section||'')===(x.heading||''));
    if(img&&img._imgPublished) o.image=img._imgPublished;
    return o;
  });
  return `<script type="application/ld+json">${JSON.stringify(items).replace(/<\/script/gi,'<\\/script')}<\/script>`;
}
async function publish(status){
  const preSyncTitle=String((ST.article&&ST.article.title)||'');
  syncEdits();
  if(ST.article && preSyncTitle && ST.article.title!==preSyncTitle){
    console.warn('[PGS] editor sync changed the title from',preSyncTitle,'to',ST.article.title);
  }
  const site=getSite(); if(!site){toast('Add & select a WP site in Settings','err');openSettings();return;}
  const a=ST.article; if(!a){toast('Nothing to publish','err');return;}
  const titleAtStart=String(a.title||'');   // captured before any DOM sync can touch it
  const btn=status==='draft'?$('btnDraft'):$('btnPub'); if(btn) btn.disabled=true;
  const pr=$('pubResult'); if(pr) pr.innerHTML='<span class="spin"></span>';
  try{
    let featuredId=0;
    if(ST.feat&&ST.feat.mediaId){ featuredId=ST.feat.mediaId; }   // already uploaded during review staging
    else if(ST.feat){
      prog(20,'📤 Featured image…');
      const f=await wpSideload(site,ST.feat.url,a.slug+'-featured',a.title,ST.feat.credit?'Photo: '+ST.feat.credit+' (Pexels)':'');
      featuredId=f.id;
    }
    prog(45,'📤 Uploading printables…');
    const hasShop=(a.sections||[]).some(x=>(x.shop||[]).some(y=>y&&y.label&&y.query))
                ||(a.games||[]).some(x=>(x.shop||[]).some(y=>y&&y.label&&y.query));   // games mode carries shops on games
    const disc=hasShop?`<p><em>${AFF_DISCLAIMER}</em></p>`:'';
    let html=`<style>.pgs-dl:hover{background:#1a1a1a!important;color:#fff!important;transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.18)}</style>${a.intro||''}${disc}${tocHTML(a)}`;
    html+=await gamesBodyHTML(a,site);
    html+=recipeSchema(a);   // after the body: image URLs exist by now
    if((a.faq||[]).length){html+='<h2>Frequently Asked Questions</h2>'+a.faq.map(q=>`<h3>${q.question}</h3><p>${q.answer}</p>`).join('');}
    prog(75,PINS_ENABLED?'📤 Uploading pins…':'📤 Preparing post…');
    let pinsHTML='';
    for(let i=0;i<ST.pins.length;i++){ if(ST.pins[i].img){ try{
      const pAlt=ST.pins[i].headline||ST.pins[i].title;   // headline → alt (SEO)
      const pCap=ST.pins[i].headline||ST.pins[i].title;                    // headline → caption
      const up=await wpSideload(site,ST.pins[i].img,ST.pins[i].file||('pin-'+(i+1)),pAlt,pCap);
      pinsHTML+=`<figure class="pgs-pin-fig" style="display:inline-block;margin:8px;text-align:center;max-width:340px"><img class="pgs-pin wp-image-${up.id}" src="${up.src}" alt="${esc(pAlt)}" style="display:block;width:100%;max-width:100%;height:auto;border-radius:8px;border:1px solid #eee"/><figcaption style="font-size:13px;color:#555;margin-top:4px">${esc(pCap)}</figcaption></figure>`;
    }catch(e){} } }
    html+=VOTE_ASSETS;   // vote styles + script once per article (pins below are deliberately excluded)
    if(pinsHTML){ html+=`<h2 id="save-for-later">📌 Save These for Later</h2><p>Loved these? Pin your favorite image below so you can find this list again when you're planning.</p><div class="pgs-pins" style="text-align:center">${pinsHTML}</div>`; }
    prog(90,'📝 Creating post…');
    // last line of defence: the title we are about to send must still be the one we started with
    if(String(a.title||'')!==String(titleAtStart||'')){
      throw new Error('Title changed mid-publish — refusing to post. Reopen the article and try again.');
    }
    const post=await wpPost(site,{
      title:a.title, content:html, slug:a.slug, excerpt:a.metaDescription,
      status:status, categories:(ST.pubCat||site.cat)?[parseInt(ST.pubCat||site.cat)]:[], featured_media:featuredId,
      meta:{_yoast_wpseo_focuskw:a.focusKeyword,_yoast_wpseo_metadesc:a.metaDescription}
    });
    prog(100,'✅ Done');
    const link=site.url+'/wp-admin/post.php?post='+post.id+'&action=edit';
    if(pr) pr.innerHTML=`<a href="${link}" target="_blank" style="color:var(--ok);font-weight:600">✅ ${status==='draft'?'Draft saved':'Published'} — open in WP</a>`;
    toast(status==='draft'?'Saved as draft':'Published','ok');
    if(btn) btn.disabled=false; progDone();
    return {ok:true, link, id:post.id};
  }catch(e){toast(e.message,'err'); if(pr) pr.innerHTML='<span style="color:var(--warn)">'+esc(e.message)+'</span>';
    if(btn) btn.disabled=false; progDone();
    return {ok:false, error:e.message};
  }
}
// static HTML builders
function tocHTML(a){const g=(a.games||[]);if(!g.length&&!(a.sections||[]).length)return'';
  if((a.sections||[]).length){   // printables: list the article's sections only — never individual sheets
    const faq0=(a.faq||[]).length?`<li><a href='#sec-faq'>Frequently Asked Questions</a></li>`:'';
    return `<div style="background:#faf7f2;border:1px solid #e7e0d6;border-radius:10px;padding:14px 18px;margin:0 0 20px"><strong>Table of Contents</strong><ol style="margin:6px 0 0;padding-left:20px">${a.sections.map((x,i)=>`<li><a href='#sec-${i}'>${esc(x.heading||'')}</a></li>`).join('')}${faq0}</ol></div>`;
  }
  const grouped=g.some(x=>x.group);
  let items='';
  if(grouped){ const seen=new Set();
    g.forEach((x,i)=>{ if(x.group&&!seen.has(x.group)){ seen.add(x.group); items+=`<li><a href='#grp-${i}'>${esc(x.group)}</a></li>`; } });
    if((a.shopping||[]).length) items+=`<li><a href='#sec-shopping'>${esc(a.shoppingHeading||'What You Need')}</a></li>`;
  } else { items=g.map((x,i)=>`<li><a href='#game-${i}'>${x.name}</a></li>`).join(''); }
  const faq=(a.faq||[]).length?`<li><a href='#sec-faq'>Frequently Asked Questions</a></li>`:'';
  return `<div style="background:#faf7f2;border:1px solid #e7e0d6;border-radius:10px;padding:14px 18px;margin:0 0 20px"><strong>Table of Contents</strong><ol style="margin:6px 0 0;padding-left:20px">${items}${faq}</ol></div>`;}
