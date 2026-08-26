/* ---------- INTERNAL LINK SELECTION ----------
   The old code sent ST.csv.slice(0,20) — literally the same first 20 rows of the interlink file to
   every article, so the model kept reaching for the same few posts, and for the same one first.
   This builds a DIFFERENT shortlist per article: links whose titles overlap this article's keyword
   rank first, then a random sample of the rest for rotation, and the whole shortlist is shuffled so
   its order carries no "pick me first" signal. */
const LINK_STOP=new Set(['the','and','for','with','without','that','this','your','you','best','fun','ideas','idea','games','game','party','parties','printable','free','easy','good','great','top','play','playing','how','what','when','are','not','from','over','all','any','every','more','most','make','makes','need','will','can','who','why','into','out','up','about']);
function linkTokens(s){
  return (s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/)
    .filter(w=>w.length>2 && !LINK_STOP.has(w));
}
function shuffled(a){ const x=a.slice(); for(let i=x.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [x[i],x[j]]=[x[j],x[i]]; } return x; }
function pickInternalLinks(kw,title,limit=20){
  const pool=ST.csv||[]; if(!pool.length) return [];
  if(pool.length<=limit) return shuffled(pool);
  const want=new Set(linkTokens(kw+' '+(title||'')));
  const scored=pool.map(r=>{
    const t=linkTokens(r.title);
    let hit=0; t.forEach(w=>{ if(want.has(w)) hit++; });
    return {r, score:hit?hit/Math.sqrt(t.length||1):0};
  });
  const relevant=scored.filter(x=>x.score>0).sort((a,b)=>b.score-a.score)
                       .slice(0,Math.ceil(limit*0.6)).map(x=>x.r);
  const chosen=new Set(relevant);
  const rest=shuffled(pool.filter(r=>!chosen.has(r)));   // random filler → rotates between articles
  return shuffled(relevant.concat(rest.slice(0,Math.max(0,limit-relevant.length))));
}

async function generateArticle(){
  costReset();   // счёт стоимости — на каждую статью свой
  ST.article=null; ST.copyNotes=[];   // clear any previous article so a failure can't republish stale content
  const kw=v('mainKW'); if(!kw){toast('Enter a main keyword','err');return;}
  if(!keyReady('claude')){toast('Add your Claude key in Settings','err');openSettings();return;}
  const btn=$('genBtn'); btn.disabled=true;
  $('emptyState').style.display='none';
  try{
    prog(10,'✍️ Writing article…');
    const linkPool=pickInternalLinks(kw,v('titleInput'));
    const csvBlock=linkPool.length?`\n\nINTERNAL LINK CANDIDATES (pick 2-4 that genuinely fit THIS article; skip the rest):\n`+linkPool.map(r=>`${r.url} | ${r.title}`).join('\n'):'';
    const paaBlock=ST.paa.length?`\n\nFAQ MUST INCLUDE these PAA questions:\n`+ST.paa.map((q,i)=>`${i+1}. ${q}`).join('\n'):'';
    const rel=(v('relAnchor')&&v('relUrl'))?`\n\nRELATED CTA LINK (optional, include ONLY if it is genuinely relevant to this article's topic; if it is off-topic, leave it out entirely): <a href='${v('relUrl')}'>${v('relAnchor')}</a>`:'';
    // count comes from the number in the Title (fallback: random 11–17)
    const givenTitle=v('titleInput');
    // Бриф уходит в сообщение дословно и стоит ближе к задаче, чем весь системный промпт,
    // поэтому его лексика и пунктуация копируются в статью охотнее любых правил. Механику
    // чиним молча, штампы показываем: их правит человек, но знать о них надо до публикации.
    const brief=cleanCopyText(v('context')||'');
    const briefNotes=copyFindings({brief}).map(x=>({...x,label:'в брифе: '+x.label}));
    const mode=(v('articleMode')||'games');
    // games/printables use the small title number (5–30). prompts use a LARGE total, so parse up to 3 digits and don't cap at 30.
    const numMatch=givenTitle.match(mode==='prompts'?/\d{2,3}/:/\d{1,2}/);
    let target=numMatch?parseInt(numMatch[0]):0;
    if(mode==='prompts'){ if(!target||target<20||target>400) target=100+Math.floor(Math.random()*61); }   // 100–160 default
    else { if(!target||target<5||target>30) target=11+Math.floor(Math.random()*7); }
    const wantDl=ST.batchRow?!!ST.batchRow.downloadable:!!($('downloadable')&&$('downloadable').checked);
    const ideasBlock=`\n\nIDEAS ARTICLE: an editorial round-up for "${kw}" (${v('category')}, ${v('audience')}) with EXACTLY ${target} ideas. `
      + (brief?`The angle and must-include ideas: ${brief}. `:`Choose the angle and the ideas this topic actually needs. `)
      + `Group the ideas into 4-8 "section" CATEGORY blocks (heading = a searchable idea category, e.g. "Naked Cakes with Fresh Berries"), whose content is a SHORT 1-2 sentence lead only. `
      + `Then output ONE entry in "games" per idea, each with section = the EXACT category heading, its own "name" (the idea's title), its own "content" of 1-2 paragraphs of editorial prose about that single idea (why it works, what it takes, a practical tip), and its own imagePrompt. Each idea is rendered as its own H3 + prose + photo, so never bundle several ideas into one block of text and never leave an idea's content empty. `
      + (wantDl
          ? `THIS IS A PRINTABLES ARTICLE: EVERY entry is asset "printable", a full A4 / US-Letter portrait sheet the reader prints. Never a photograph, never a styled scene. Every sheet in the set must share the SAME page format and the SAME structure so the pack looks like one family: same margins, same heading position, same proportions. Where the host fills something in (name, date, time, address, RSVP) draw an empty underlined blank line with a small label, on EVERY sheet that needs one, never a filled-in example. `
          : `THIS IS A PHOTO IDEAS ARTICLE: EVERY entry is asset "illustration", a real editorial photograph of the idea itself styled in its setting (the cake on a dressed table, the balloon arch in a decorated room), never a printable sheet, never flat vector art, and with NO text rendered on the image. `)
      + `PLANNER CARD: for THIS article use ONLY these block labels, spelled exactly like this: ${plannerRecipe(kw).blocks.map(b=>`"${b.label}" (${b.hint})`).join('; ')}. Output it as "planner": [{"label":"<one of those labels>","items":["",""]}]. `
      + `MOST IDEAS GET NO CARD. "planner": [] is the normal answer, add a card only for an idea that has genuinely practical notes beyond its own paragraph, and expect FEWER THAN HALF the ideas to earn one. Ideas about wording, lettering, colour pairing or how something looks get no card at all. When one is warranted, use 2-3 of the available labels, pick whichever genuinely apply to THAT idea, and vary which ones you use so no two cards read the same. Never pad a card to fill the shape. `
      + `EVERY idea also carries its own "shop" list of 2-4 Amazon search phrases chosen for that idea. "extraImagePrompts" is always an empty array: one photo per idea, no detail shots or second angles. Do not put "shop" on the sections. Write it all like an editor who has actually tried these ideas and is showing them to a reader.`;
    const recipesBlock=`\n\nRECIPE ROUND-UP: a "${kw}" collection (${v('category')}, ${v('audience')}) with EXACTLY ${target} recipes. `
      + (brief?`The angle and must-include recipes: ${brief}. `:`Pick recipes people actually search for on this theme. `)
      + `Each recipe is ONE "section": heading = the recipe name; content = a short editorial intro paragraph (why it fits the occasion, how it tastes, make-ahead or swap tip) FOLLOWED BY the full recipe written as proper HTML: <p class="r-meta"> with prep time, total time and yield; then <h3>Ingredients</h3> and a <ul> with one <li> per ingredient INCLUDING exact quantities; then <h3>Instructions</h3> and an <ol> with one <li> per step. `
      + `Also fill the "recipe" object on that section: {"prepTime":"PT10M","cookTime":"PT0M","totalTime":"PT10M","yield":"1 cocktail","ingredients":["1.5 oz bourbon", ...],"steps":["Fill a shaker with ice.", ...]}, these MUST match the visible HTML exactly, they power the Google recipe markup. `
      + `WRITE EVERY RECIPE IN YOUR OWN WORDS. Never copy instruction wording from a source; quantities and ingredient lists are facts, but the method text must be original. `
      + `For EACH recipe output ONE entry in "games" with section = the EXACT recipe heading, asset "printable", name "<Recipe name> Recipe Card", and an imagePrompt for a SELF-CONTAINED printable recipe card: recipe name heading, appetising photo of the finished dish across the top third, a meta line (prep / total / yield), the full ingredients list with quantities, and a numbered method. The app rebuilds this card as a picture-led layout, so also fill the "card" object on each recipe with its short glanceable version (up to 6 short ingredients, 4-5 steps of max 11 words, difficulty). Never a photo-only card. `
      + `Put a "shop" list on 3-5 sections only (glassware, shaker, molds, garnish tools).`;
    const gameBlock=`\n\nGAMES: create EXACTLY ${target} distinct, on-theme games for "${kw}" (${v('category')}, ${v('audience')}). `
      + (brief?`Follow this brief for direction and any must-include games, then invent the rest to reach ${target}: ${brief}. `:`Invent ${target} varied games that clearly fit the theme. `)
      + `CRITICAL: games MUST be AUTHENTIC to the "${v('category')}" occasion, the way people actually play at that kind of event. Do NOT default to baby-shower formats (nursery rhyme quiz, predictions/time-capsule, wishes/advice cards, mommy-or-daddy, "would you rather", guess-the-belly, etc.) UNLESS the occasion literally is a baby shower. For a Halloween party, use real Halloween party games (e.g. mummy wrap relay, pumpkin toss, monster freeze dance, costume contest, candy guessing jar, eyeball spoon race, pin the face on the pumpkin, spooky charades, halloween scavenger hunt, doughnut-on-a-string). For other occasions, likewise use games native to THAT event. Renaming a baby-shower game with the theme word in front is NOT allowed. `
      + `Make EVERY game distinct (no two bingos, no duplicates, no near-repeats). Use a strong MIX of types with ENOUGH "printable" games, aim for at least 40% printable (printable ones become downloadable game-sheet infographics), plus "active" and "quiet" games interleaved. Each printable game needs a full imagePrompt per the rules.`;
    const promptsBlock=`\n\nPROMPTS + CARDS: this is a "${kw}" prompts article, ONE game mechanic plus a big organised bank of prompts. Produce ${target} prompts TOTAL, split across 5-8 on-theme SUB-THEMES chosen for the "${v('audience')}" audience. `
      + (brief?`Follow this brief for direction and any must-include sub-themes: ${brief}. `:`Pick sub-themes people actually search for this game and audience. `)
      + `Start with a "How to Play" section (one short rules paragraph, no cards, no shop). Then each sub-theme is a "section" (heading = searchable sub-theme name) whose content = one lead sentence + a numbered <ol> of prompts; the section counts MUST add up to ${target}. For EACH sub-theme output ONE printable card-deck sheet in "games" (asset "printable", content "", section = the EXACT sub-theme heading) with an imagePrompt for an A4 sheet of 6 cards in a 2x3 grid with cut lines, whose text is copied VERBATIM from the FIRST 6 items of that same sub-theme's numbered list (never invented, never from another sub-theme). Keep everything PG-13 and brand-safe per the safety rules. Put a "shop" list (card-making supplies) on only one or two card-making sections.`;
    const titleBlock=givenTitle?`\n\nUSE THIS EXACT TITLE (do not rewrite it), set it as "title": "${givenTitle}"`:'';
    const LABELS={prompts:'prompts-and-cards',ideas:'party-ideas',recipes:'recipe-round-up'};
    const label=LABELS[mode]||'party-games';
    const BLOCKS={prompts:promptsBlock,ideas:ideasBlock,recipes:recipesBlock};
    const modeBlock=BLOCKS[mode]||gameBlock;
    const noFiller=`\n\nNO FILLER OR PLACEHOLDERS: every entry must be a real, complete, distinct item. NEVER output a placeholder, dummy, "guard", "duplicate detection", TODO or "should not appear" entry, and never pad the list with filler just to reach the number in the title. If you genuinely cannot produce that many distinct items, produce fewer REAL ones and set the number in the title to match the real count.`;
    // a neutral pin_vibe must also keep the SHEET art season-free (imagePrompt is written here, by Claude)
    const seasonBlock=isNeutralVibe()?`\n\n${NO_SEASONAL} This applies to every imagePrompt and to the on-sheet decoration you describe.`:'';
    const msg=`Write a complete ${label} article.\n\nMain keyword: ${kw}\nCategory: ${v('category')}\nAudience: ${v('audience')}\nContext: ${brief||'(none)'}${titleBlock}${modeBlock}${csvBlock}${paaBlock}${rel}${noFiller}${seasonBlock}${voiceReminder()}\n\nReturn the JSON only.`;
    const bigModes=['recipes','ideas','prompts'].includes(mode);
    const txt=await callClaude(articleSystemPrompt(mode),msg,true,m=>prog(25,m),bigModes?64000:32000);
    prog(55,'📦 Parsing…');
    const art=extractJSON(txt);
    dropFiller(art);   // remove any padded placeholder/"guard" entry the model added to hit the title number
    syncCardsToText(art,mode);   // decks must reuse the article's own prompts/answers, not freshly invented ones
    syncRecipeCards(art,mode);   // recipe cards carry the real ingredients/steps/times from the same recipe object
    forceIdeasAssets(art,mode,wantDl);   // one article = one asset type, decided by the CSV flag
    redistributeIdeaProse(art,mode);     // guarantee H3 + prose + image per idea, never a text wall + photo stack
    applyInvitationSpec(art,mode,wantDl);   // invitations are forms: fixed field layout, warm copy, contrast floor
    assignShotTypes(art,mode);           // vary the camera: not 18 photos of the same dessert table
    art.focusKeyword=art.focusKeyword||kw;
    if(givenTitle) art.title=givenTitle;   // honor the user's exact title
    // normalize: printables-mode sheets carry "asset" instead of "type" — map it so rendering/publishing work unchanged
    const ASSET_TYPE={printable:'printable',game:'printable',recipe_card:'printable',image:'active',text:'quiet'};
    art.games=(art.games||[]).map(g=>{
      const type=g.type||ASSET_TYPE[g.asset]||'active';
      const imagePrompt=(g.asset==='text')?'':(g.imagePrompt||'');   // "text" sections never get an image
      return {...g,type,imagePrompt};
    });
    // механические правила голоса не обсуждаются с моделью: длинные тире, эмодзи и
    // фигурные кавычки убираются здесь, что бы модель ни прислала
    const fixed=cleanCopy(art);
    ST.copyNotes=briefNotes.concat(copyFindings(art));   // остальное показываем в ревью, правится руками
    if(fixed) console.log('вычищено строк: '+fixed);
    ST.article=art; ST.pins=[];
    renderPreview();
    prog(70,'🖼️ Printable infographics…');
    await generateImages();
    if(pinsOn()){ prog(88,'📌 Pinterest pins…'); await generatePins(); }
    else { ST.pins=[]; renderPins(); }
    prog(100,'✅ Done');
    toast('Article ready','ok');
  }catch(e){toast(e.message,'err');console.error(e);}
  btn.disabled=false; progDone();
}
