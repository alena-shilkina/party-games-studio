/* ---------- PAA RESEARCH ---------- */
async function researchPAA(){
  const kw=v('mainKW'); if(!kw){toast('Enter a keyword first','err');return;}
  const btn=$('paaBtn'); btn.disabled=true; btn.textContent='⏳ Searching…';
  try{
    const txt=await callClaude(
      'You research real user questions. Search Google People Also Ask, Reddit, Quora. Return ONLY raw JSON: {"questions":["q1","q2",...]} No preamble.',
      'Find 10-12 real People Also Ask questions for: "'+kw+'"', true, m=>{btn.textContent=m;});
    const d=extractJSON(txt); ST.paa=[];
    renderPAA(d.questions||[]);
  }catch(e){toast(e.message,'err');}
  btn.disabled=false; btn.textContent='🔍 Research PAA';
}
function renderPAA(qs){
  $('paaList').innerHTML=`<div class="chip-row">`+qs.map((q,i)=>
    `<span class="chip on" onclick="togglePAA(this,'${esc(q).replace(/'/g,"\\'")}')">${esc(q)}</span>`).join('')+`</div>`;
  ST.paa=qs.slice();
}
function togglePAA(el,q){
  el.classList.toggle('on');
  if(el.classList.contains('on')) ST.paa.push(q);
  else ST.paa=ST.paa.filter(x=>x!==q);
}

/* ---------- PEXELS ---------- */
async function fetchPexels(){
  const key=v('pexelsKey'); if(!keyReady('pexels')){toast('Add a Pexels key in Settings','err');return;}
  const q=v('featKW')||v('mainKW'); if(!q){toast('Enter a keyword','err');return;}
  try{
    const r=await fetch('/api/pexels?per_page=15&orientation=landscape&query='+encodeURIComponent(q),
      {headers:{Authorization:key}});
    if(!r.ok) throw new Error('Pexels '+r.status);
    const d=await r.json();
    if(!d.photos?.length){toast('No photos found','err');return;}
    const shuffled=[...d.photos].sort(()=>Math.random()-0.5);   // fresh options each click, not always the same top results
    $('featPreview').innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px">'+
      shuffled.map(p=>`<img src="${p.src.small}" style="width:100%;height:60px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid transparent"
        onclick="pickFeat('${p.src.large2x}','${esc(p.photographer)}',this)">`).join('')+'</div>';
  }catch(e){toast(e.message,'err');}
}
function pickFeat(url,who,el){
  ST.feat={url,credit:who};
  [...el.parentNode.children].forEach(c=>c.style.borderColor='transparent');
  el.style.borderColor='var(--coral)';
  toast('Featured image set','ok');
}
function clearFeat(){ST.feat=null;$('featPreview').innerHTML='';}
async function genFeaturedAINow(){
  if(!keyReady('runware')){toast('Add a Runware key in Settings','err');return;}
  const kw=v('featKW')||v('mainKW'); if(!kw){toast('Enter a keyword','err');return;}
  toast('Generating hero…');
  try{ await genFeaturedAI(kw); }catch(e){ toast(e.message||'Hero failed','err'); return; }
  if(ST.feat&&ST.feat.ai){ $('featPreview').innerHTML=`<img src="${ST.feat.url}" style="width:100%;border-radius:8px">`; if(typeof renderPreview==='function')renderPreview(); toast('AI hero set','ok'); }
  else toast('Could not generate hero','err');
}
