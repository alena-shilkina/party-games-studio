// ── MODE: prompts — ONE game mechanic + a big organised bank of prompts + printable card decks ──
function promptsSystemPrompt(){
  const tone=v('tone')||DEFAULT_TONE;
  return `You are an expert party-content writer creating an SEO article built around ONE game mechanic and a BIG bank of ready-to-use prompts (e.g. Would You Rather, Truth or Dare, This or That, Never Have I Ever, charades ideas). This is NOT a listicle of different games and NOT a printable pack, it is ONE game + a large, well-organised list of prompts + printable card decks. Published on a WordPress blog monetized with display ads and Pinterest traffic; the card decks double as a Pinterest/Etsy freebie.

TONE OF VOICE:
${tone}

${voiceRules()}

${YEAR_RULE}

CONTENT SAFETY: MANDATORY, keeps the article Mediavine- and Pinterest-safe:
- PG-13 MAXIMUM. NEVER explicit sexual content, nudity, graphic, fetish or shock material.
- Couples / date-night sub-themes: keep it flirty, romantic and sweet, suggestive at most, never explicit. Butterflies, not the bedroom.
- Teen or kids audiences: strictly age-appropriate. NO alcohol, drugs, sex, adult-dating themes, or anything unsafe. Wholesome and fun only.
- Truth-or-Dare and any dare-style prompts: every dare must be SAFE, doable indoors and harmless, no injury risk, no property damage, no humiliation, nothing illegal, nothing that pressures anyone. Never dares involving alcohol, heights, fire, strangers, or removing clothing.
- SAFE WORDING in the title and every heading: use "flirty" or "date night" (never "spicy"/"steamy"/"naughty"); "bold" or "for adults" (never "juicy"/"dirty"). Every heading must be brand-safe and ad-friendly. If a sub-theme cannot be made brand-safe, replace it with one that can.

ARTICLE STRUCTURE:
1. intro: 2-3 sentences, what the game is, who it's for, why it's great. Put the keyword in the first sentence.
2. FIRST section = HOW TO PLAY: heading "How to Play", content = ONE short paragraph of simple rules (how a round works, players, how to use the lists or cards). This section has NO card deck and NO shop list.
3. PROMPT-LIST sections, the CORE of the article and all its SEO length. Create 5-8 SUB-THEMES chosen for the "${v('audience')}" audience and this specific game (kids → food, animals, superpowers, school; couples → date night, how well do you know me, future & dreams; friends → funny, embarrassing, hypotheticals; and so on). Each sub-theme is a "section": heading = a searchable sub-theme name (e.g. "Funny Would You Rather Questions"), content = one short lead sentence then a NUMBERED <ol> of that sub-theme's prompts. The prompts ARE the value, write real, varied, genuinely fun ones. No filler, no near-duplicates, no repeats across sub-themes.
4. TITLE NUMBER = the TOTAL number of prompts across ALL sub-theme lists (e.g. "120 Would You Rather Questions"). The lists must actually add up to that number.

PRINTABLE CARD DECKS: the Pinterest/Etsy value:
- For EACH prompt-list sub-theme (NOT "How to Play"), output ONE card-deck sheet in the "games" array: {"name":"<Sub-theme> Cards","section":"<EXACT sub-theme heading>","asset":"printable","content":"","imagePrompt":"…"}.
- THE DECK MUST MATCH THE TEXT. A sheet's cards always reproduce the FIRST 6 items of its own sub-theme's numbered list, word for word, never freshly invented prompts, never items from another sub-theme. For trivia and quizzes this is critical: a card showing a different question or a different answer than the list above it makes the printable wrong. Write the exact card wording into the imagePrompt.
- TRIVIA ANSWERS: if a sub-theme is trivia/quiz style, write each list item in the article as "Question, Answer" so the pair stays together in the text. On the PRINTED sheets they must be separated: the question sheet shows ONLY the questions (never an answer, hint or solution anywhere on it), and a separate sheet named "<Sub-theme> Answer Key" carries the complete numbered answer list. Players hold the question cards, the host holds the key.
- The imagePrompt describes an A4 portrait card sheet: 6 DIFFERENT prompt cards (NOT identical copies) of equal size in a neat 2-columns-by-3-rows grid with thin cut lines and even margins; each card carries ONE SHORT prompt taken from that sub-theme plus a small deck label; perfectly spelled. Painted people, children and animals are allowed. Keep each card's text short so it renders cleanly.
- Do NOT specify colours, fonts, borders or decoration inside imagePrompt, the app applies ONE shared style contract so every deck in the set matches. Describe only the layout and the card text.
- Cards are shown as images only, never describe a card in the prose and never give a deck its own heading.

AMAZON: CARD-MAKING SUPPLIES:
- Mention the supplies naturally in ONE light, non-salesy sentence in the relevant prose (printed on cardstock, laminated to last, held with a binder ring, kept in a little box or jar), no links inside the sentence.
- Provide the actual clickable list via a "shop" array on that section: 2-4 items, e.g. [{"label":"white cardstock","query":"cardstock"},{"label":"laminator","query":"laminator"},{"label":"binder rings","query":"binder rings"}]. "label" = the plain phrase the reader sees; "query" = a plain lowercase Amazon search phrase. NEVER invent brand names, prices or ASINs.
- Put a "shop" list on only ONE or two sections where card-making is discussed, never on every section, never on "How to Play".

${BANNED_FORMATS}

${ANSWER_KEY_RULE}

AD-LAYOUT RULES (Mediavine):
- Keep HTML FLAT: only top-level <p>, <ol>/<ul>, <li>. No wrapper <div>s. (Headings and images are added by the app, not by you.)
- The numbered prompt lists carry the page, so make them substantial. Length comes from more real prompts, never from padding the prose around them.

SEO RULES:
- Title: keyword near the front WITH the total number, under 65 chars.
- slug: main keyword only, lowercase, dashes, no stop words.
- metaDescription: 150 to 155 characters, the benefit inside the first five words, keyword included.
- focusKeyword: the exact main keyword, used naturally a few times.

LINKS:
- Internal links: if a candidate list is provided, choose 2-4 that are genuinely relevant to THIS article and weave them in as <a href='URL'>anchor</a> (single quotes). Skip any candidate that does not fit the topic, a forced link reads as spam. Place them in DIFFERENT parts of the body, spread across separate sections; never put one in the introduction, never two inside the same section, and never park them all in the same spot you used last time. The anchor text must be a natural phrase from the sentence, not the raw post title.
- Related CTA link: only if the provided related anchor/url is genuinely on-topic for this article, mention it ONCE near the end. If it is unrelated to the subject, omit it completely rather than inventing a bridge to it.

FAQ & CLOSING:
- faq: use the provided PAA questions if any; else write 5-6 short practical answers (how to play, how many players, printing the cards, age-appropriateness).
- closing: 1 short paragraph + CTA (print the cards / pin this / play tonight), ending with the related link if provided.

CRITICAL JSON RULES:
- Output ONLY raw JSON, starting with { and ending with }. No preamble, no markdown fences.
- All HTML inside strings uses SINGLE quotes for attributes.
- Never use a raw double-quote inside a string value and never put a literal line break; keep each string on one line. Must be strictly valid JSON.parse-able JSON.
OUTPUT SHAPE:
{
 "title":"", "slug":"", "metaDescription":"", "focusKeyword":"",
 "intro":"<p>…</p>",
 "sections":[
   {"heading":"How to Play","content":"<p>…</p>"},
   {"heading":"","content":"<p>…</p><ol><li>…</li><li>…</li></ol>","shop":[{"label":"","query":""}]}
 ],
 "games":[
   {"name":"","section":"","asset":"printable","content":"","imagePrompt":""}
 ],
 "faq":[{"question":"","answer":""}],
 "closing":"<p>…</p>"
}

${VOICE_LAST}`;
}

// Strip LLM filler/placeholder entries. When the title asks for N items and the model runs out of
// genuinely distinct ideas, it sometimes pads the list with a dummy "guard" entry whose content is a
// note like "placeholder — this entry is a duplicate detection guard and should not appear". That
// renders as an empty paragraph with junk text, so we drop such entries before rendering/publishing.
const FILLER_RE=/placeholder\s*[—–:-]|\bplaceholder entry\b|should not (appear|be shown|be rendered|be included|be here)|duplicate[- ]detection|dedup\w* guard|guard (entry|item|row|game)|do not (render|include|display|show) this|intentionally (left )?blank|lorem ipsum/i;
function isFillerEntry(x){
  if(!x||typeof x!=='object') return false;
  const name=String(x.name||x.heading||'');
  const text=String(x.content||'').replace(/<[^>]+>/g,' ').trim();
  if(FILLER_RE.test(name)||FILLER_RE.test(text)) return true;
  // a wholly empty entry that is NOT a real image-only sheet (image sheets legitimately have empty content)
  const hasImg=!!(x.imagePrompt&&String(x.imagePrompt).trim());
  if(!hasImg && !name.trim() && !text) return true;
  return false;
}
function dropFiller(art){
  if(Array.isArray(art.games)) art.games=art.games.filter(g=>!isFillerEntry(g));
  if(Array.isArray(art.sections)){
    const dead=new Set();
    art.sections=art.sections.filter(s=>{ const bad=isFillerEntry(s); if(bad&&s.heading) dead.add(s.heading); return !bad; });
    if(dead.size&&Array.isArray(art.games)) art.games=art.games.filter(g=>!dead.has(g.section||''));   // drop sheets orphaned to a removed section
  }
  return art;
}

// ── Keep printable card decks IDENTICAL to the article text ──
// The model writes each sheet's imagePrompt separately from the prose, so a trivia deck used to end up
// with different questions (and different answers) than the numbered list above it. We therefore lift the
// exact <li> items out of the matching section and force them onto the sheet, verbatim.
function htmlToPlain(h){
  return String(h||'')
    .replace(/<br\s*\/?>/gi,' ')
    .replace(/<[^>]+>/g,'')
    .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/&quot;/gi,'"').replace(/&#0?39;|&apos;/gi,"'").replace(/&mdash;/gi,'—').replace(/&ndash;/gi,'–')
    .replace(/\s+/g,' ').trim();
}
function sectionListItems(sec){
  const html=String((sec&&sec.content)||'');
  const out=[];
  const re=/<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m; while((m=re.exec(html))!==null){ const t=htmlToPlain(m[1]); if(t) out.push(t); }
  return out;
}
const SECTION_MODES=['prompts','ideas','recipes'];   // sheets belong to a section, so they are NOT numbered like a listicle
const CARDS_PER_SHEET=6;
// Split "Question — Answer" into its two halves (the separator is the LAST dash on the line).
function splitQA(t){
  const raw=String(t||'').trim();
  // The answer follows the LAST spaced dash on the line. Answers themselves may contain hyphens
  // ("Hip-hop"), so we split on position, not on a character class.
  let cut=-1, len=0;
  [' — ',' – ',' - ','—','–'].forEach(sep=>{
    const i=raw.lastIndexOf(sep);
    if(i>0 && i>cut){ cut=i; len=sep.length; }
  });
  if(cut<0) return {q:raw, a:''};
  const q=raw.slice(0,cut).trim(), a=raw.slice(cut+len).trim();
  // a trailing fragment that is clearly not an answer (too long) means there was no Q/A split at all
  if(!a || a.length>90) return {q:raw, a:''};
  return {q, a};
}
// Only for prompts mode: every printable sheet must reuse the section's own text — ALL of it.
// Three sheet shapes, one source of truth (the section's numbered list):
//   • answer key  → the COMPLETE numbered answer list, 1..N
//   • Q&A sheet   → the COMPLETE numbered question list, 1..N, answers stripped
//   • prompt deck → 6 cards (would-you-rather / truth-or-dare style items, which have no answers)
// Numbering is positional, so question #N in the text, #N on the question sheet and answer #N in the
// key always describe the same item.
const LIST_SHEET_MAX=40;   // safety ceiling so a 120-prompt bank never becomes one unreadable sheet
function syncCardsToText(art,mode){
  if(mode!=='prompts') return art;
  const items={};
  (art.sections||[]).forEach(s=>{ const h=String(s.heading||'').trim(); if(h) items[h]=sectionListItems(s); });
  let synced=0;
  (art.games||[]).forEach(g=>{
    if(g.asset==='game'||g.asset==='text') return;
    const list=items[String(g.section||'').trim()];
    if(!list||!list.length) return;
    const qa=list.map(splitQA);
    const withAnswers=qa.filter(x=>x.a).length;
    // a trivia/quiz section is one where most items carry an answer
    const isQA=withAnswers>=Math.max(3,Math.ceil(qa.length*0.6));
    const isKey=/answer\s*key|answers?\s*sheet|answer\s*card/i.test(String(g.name||''))
             || /answer\s*key/i.test(String(g.imagePrompt||''));
    // strip the model's own invented copy (and any earlier sync) so only the real text remains
    let base=String(g.imagePrompt||'').replace(/\s*(VERBATIM CARD TEXT|VERBATIM ANSWER KEY|VERBATIM QUESTION LIST)[\s\S]*$/i,'');
    base=base.replace(/(?:\s*(?:Card|Q)\s*\d+\s*:\s*(?:"[^"]*"|'[^']*'|[^.]*?)(?=\s*(?:Card|Q)\s*\d+\s*:|\s*$))+/gi,' ');
    base=base.replace(/\s+/g,' ').trim();
    const clean=t=>String(t).replace(/["']/g,"'");

    if(isKey){
      if(!qa.some(x=>x.a)) return;
      // keep EVERY position so answer #N always lines up with question #N
      const answers=qa.slice(0,LIST_SHEET_MAX).map(x=>x.a||x.q);
      g.imagePrompt=base+` VERBATIM ANSWER KEY: print a COMPLETE answer key with all ${answers.length} numbered answers (1-${answers.length}), copied exactly as written, in this order, nothing added, skipped or reordered: `
        + answers.map((a,i)=>`${i+1}. ${clean(a)}`).join('  ')
        + ` Numbers run continuously 1-${answers.length} and each number must match the same-numbered question on the question sheet. This is an ANSWER sheet: print the answers only, never the questions. Use a clean two-column numbered list if that is needed to fit all ${answers.length} lines legibly.`;
    } else if(isQA){
      const qs=qa.slice(0,LIST_SHEET_MAX).map(x=>x.q);
      if(!qs.length) return;
      g.imagePrompt=base+` VERBATIM QUESTION LIST: this is a QUESTION SHEET laid out as ONE numbered list (not cards, no cut lines). Print all ${qs.length} questions (1-${qs.length}) exactly as written below, in this order, nothing added, skipped, reworded or reordered: `
        + qs.map((q,i)=>`${i+1}. ${clean(q)}`).join('  ')
        + ` CRITICAL: print the questions ONLY, never an answer, hint or solution anywhere on this sheet; the answers live on the separate answer key. Numbers run continuously 1-${qs.length}. Shrink the type or use two columns if needed so that every one of the ${qs.length} questions fits and stays readable.`;
    } else {
      const take=qa.slice(0,CARDS_PER_SHEET).map(x=>x.q).filter(Boolean);
      if(!take.length) return;
      g.imagePrompt=base+` VERBATIM CARD TEXT: this sheet has EXACTLY ${take.length} cards and they must show the following prompts word for word, in this order, copied exactly as written (do NOT rewrite, shorten, paraphrase, renumber or invent extras): `
        + take.map((t,i)=>`[Card ${i+1}] ${clean(t)}`).join('  ')
        + ` Render the text accurately and legibly; the article page shows these same prompts, so any difference is a mistake.`;
    }
    synced++;
  });
  if(synced) console.log('[PGS] sheets synced to article text:',synced);
  return art;
}

// Recipe cards must be cookable AND identical to the article text, so the ingredients, steps and
// timings are lifted verbatim from the same "recipe" object that feeds the Google recipe markup.
function isoToHuman(x){
  const m=String(x||'').match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
  if(!m) return String(x||'').trim();
  const h=+(m[1]||0), mi=+(m[2]||0);
  return [h?h+' hr':'', mi?mi+' min':''].filter(Boolean).join(' ')||'0 min';
}
// Shorten an ingredient line for the CARD only: the article keeps the full precise version.
// "115 g (1/2 cup) unsalted butter, softened (for browning)" -> "115 g butter"
function shortIngredient(t){
  let x=String(t||'').replace(/\([^)]*\)/g,' ');       // drop dual units and parentheticals
  x=x.split(',')[0];                                    // drop ", softened", ", finely diced"
  x=x.replace(/\b(unsalted|salted|granulated|pure|fine|large|medium|ripe|fresh|cold|whole|plain|all-purpose|light|dark|ground|freshly squeezed|extra)\b/gi,' ');
  return x.replace(/\s+/g,' ').trim();
}
// Compress a method step into a card-sized instruction (<= ~11 words), keeping the imperative.
function shortStep(t){
  let x=String(t||'').replace(/\([^)]*\)/g,' ').trim();
  x=x.split(/(?<=[.;])\s/)[0].replace(/[.;]\s*$/,'');   // first clause only
  const w=x.split(/\s+/);
  if(w.length>11) x=w.slice(0,11).join(' ');
  // never end on a dangling connector like "... brown sugar, cinnamon, and"
  x=x.replace(/[,;:]\s*$/,'');
  for(let i=0;i<4;i++) x=x.replace(/\s+(and|or|with|until|into|to|for|in|of|the|a|an|then)\s*$/i,'').replace(/[,;:]\s*$/,'');
  return x.replace(/\s+/g,' ').trim();
}
// store-cupboard items are not what makes a dish recognisable, so they yield their card slot
const PANTRY_RE=/\b(flour|sugar|salt|baking powder|baking soda|bicarbonate|vanilla|water|oil|pepper|cornstarch|cornflour|yeast|cooking spray)\b/i;
// choose the items that define the dish, then top up with basics if there is room
function pickCardIngredients(list,max){
  const shorts=list.map(shortIngredient).filter(Boolean);
  const hero=shorts.filter(x=>!PANTRY_RE.test(x));
  const basic=shorts.filter(x=>PANTRY_RE.test(x));
  const seen=new Set(); const out=[];
  [...hero,...basic].forEach(x=>{ const k=x.toLowerCase().replace(/^[\d\s\/.,-]+/,''); if(!seen.has(k)&&out.length<max){ seen.add(k); out.push(x); } });
  return out;
}
// Recipe cards must be cookable, glanceable AND identical to the article text. The full recipe lives in
// the article; the card carries a photo, a meta row, illustrated ingredients and a few icon steps.
function syncRecipeCards(art,mode){
  if(mode!=='recipes') return art;
  const byHeading={};
  (art.sections||[]).forEach(x=>{ const h=String(x.heading||'').trim(); if(h&&x.recipe) byHeading[h]=x.recipe; });
  let synced=0;
  (art.games||[]).forEach(g=>{
    const r=byHeading[String(g.section||'').trim()];
    if(!r) return;
    const ingAll=(r.ingredients||[]).map(String).filter(Boolean);
    const stepAll=(r.steps||[]).map(String).filter(Boolean);
    if(!ingAll.length||!stepAll.length) return;
    g.asset='printable';
    if(!/recipe card/i.test(String(g.name||''))) g.name=(g.section||g.name||'Recipe')+' Recipe Card';

    const card=(r.card&&typeof r.card==='object')?r.card:{};
    let ing=(Array.isArray(card.ingredients)&&card.ingredients.length?card.ingredients.slice(0,6):pickCardIngredients(ingAll,6));
    let steps=(Array.isArray(card.steps)&&card.steps.length?card.steps:stepAll.map(shortStep));
    const hidden=Math.max(0,ingAll.length-ing.length);
    steps=steps.slice(0,5);

    const meta=[r.totalTime?isoToHuman(r.totalTime):'', card.difficulty||'Easy', r.yield?String(r.yield):''].filter(Boolean);
    const clean=t=>String(t).replace(/["']/g,"'");
    let base=String(g.imagePrompt||'').replace(/\s*VISUAL RECIPE CARD[\s\S]*$/i,'').replace(/\s*VERBATIM RECIPE CARD[\s\S]*$/i,'').replace(/\s+/g,' ').trim();

    g.imagePrompt=base+` VISUAL RECIPE CARD: a portrait card a reader understands AT A GLANCE. It is a designed poster, not a form. Follow these zones top to bottom, with clear space between them and NO small or cramped type anywhere:
(0) THE CARD IS BUILT FROM FILLED PANELS ON A COLOURED GROUND, never black type floating on white. A full-bleed tinted or softly patterned background carries the whole card. Each block below sits inside its own rounded filled panel with a small label chip on its top edge, panels tinted in different strengths of the same palette so they read as one set. Decorative accents belong to THIS recipe's own subject and occasion, scattered in the margins and overlapping panel corners, never on top of any word. Leave no large dead area, but never shrink type to fill one.
PALETTE AND MOTIFS COME FROM THE THEME OF THIS RECIPE, or from the attached style reference when there is one. Do NOT default to one house palette, and do not carry a palette over from an unrelated theme. The saturation should be confident and cheerful rather than pale and washed out, and the type stays the dark anchor of whatever palette you choose.
(1) TITLE BLOCK at the very top: the recipe name set LARGE as a display headline, the biggest thing on the card by a wide margin, sitting on its own banner or ribbon, with a second weight or a second colour on one word so it has real typographic personality: "${clean(g.section||'')}". Under it one short tagline in small caps or a script face, drawn from the dish itself and never invented as a claim.
(2) HERO PHOTO directly under the title, inside a rounded frame with a decorative accent overlapping one of its corners: one appetising photograph of the finished dish, filling the full width, about a third of the card's height. No people, no hands, no brand labels. PHOTOREALISM, this must look like a real photograph taken by a food photographer, not a render. CAMERA: a 50mm at about f/4, from a natural eye-level or slight three-quarter angle, pulled back far enough that the dish sits in a real place: some of the table, the cloth, a glass or a serving spoon beside it. Not the dish cropped tight and filling the frame. Depth of field is gentle, the back softens but the setting still reads. LIGHT: bright daylight, and sunshine is welcome, a sun patch on the table or warm low afternoon sun from one side. It should look like a cheerful day, never grey or dim. IMPERFECTION IS THE POINT: hand-made food is never identical. Every piece differs in size, angle and placement, some lean, one sits slightly apart, garnish lands unevenly. Include honest small mess: a few crumbs, a smear on the board, an oil pool that is not symmetrical, a herb leaf out of place, one piece already eaten or a bite taken. Real props show light wear, a scratched board, a linen napkin with creases, a fingerprint on a glass. REAL SURFACES: matte where food is matte (cheese, bread, meat), shine only where fat or glaze genuinely sits. No plastic or waxy sheen, no rubbery highlights, no uniform glossy coating over everything. FORBIDDEN AI LOOK: no HDR glow, no halo or rim-light around every item, no over-saturated candy colours, no perfect radial symmetry, no identical repeated objects cloned across the frame, no impossibly clean surfaces, no floating ingredients, no smooth airbrushed texture. Slight natural grain and true-to-life colour, as if straight out of camera with minimal editing.
(3) BADGE ROW: three pill-shaped badges side by side, each a filled rounded pill in its own tint carrying a simple icon and a short label, a clock reading "${clean(meta[0]||'')}", a level icon reading "${clean(meta[1]||'')}", a servings icon reading "${clean(meta[2]||'')}". Nothing else goes in these badges.
(4) INGREDIENTS PANEL: a filled rounded panel with a label chip reading WHAT YOU NEED, holding the ingredients as SMALL HAND-PAINTED ILLUSTRATIONS (not a text list): each item drawn on its own, with its name and amount in small clean type underneath. Show EXACTLY these ${ing.length}, in this order, copied word for word: `
      + ing.map(x=>`[${clean(x)}]`).join(' ')
      + (hidden?` Then one final illustrated item labelled "+ pantry basics" standing in for the remaining store-cupboard ingredients.`:'')
      + ` (5) STEP PANEL: a filled rounded panel with a label chip reading STEP BY STEP, holding EXACTLY ${steps.length} steps in a clean row or grid. Each step is a SMALL ILLUSTRATED THUMBNAIL of that action, drawn in the card's own technique rather than photographed, sitting in a rounded tile with a filled circle carrying the step number on its corner, and the instruction in small clean type underneath, copied word for word: `
      + steps.map((x,i)=>`[${i+1}. ${clean(x)}]`).join(' ')
      + ` DENSITY: the finished card should look like a designed magazine page, layered and full, with every block sitting in its own coloured container and ornament filling the margins. What it must NEVER become is a wall of text: the words on this card are ONLY the ones listed above, and richness comes from colour, panels, illustration and ornament, never from adding sentences. Invent no extra headings, tips, notes, captions, ratings, hashtags, handles or calls to action.
CRITICAL: every word above must be rendered exactly as given, spelled correctly and large enough to read comfortably at arm's length. The article text carries the full precise recipe, so the card shows only what is listed here.`;
    synced++;
  });
  if(synced) console.log('[PGS] visual recipe cards built for',synced,'recipes');
  return art;
}

// In ideas mode the `downloadable` flag decides the asset type for the WHOLE article, so a set of
// invitations can never come back as 15 printable sheets plus 5 stray photographs.
function forceIdeasAssets(art,mode,wantDl){
  if(mode!=='ideas') return art;
  const want=wantDl?'printable':'illustration';
  let changed=0;
  (art.games||[]).forEach(g=>{
    if(g.asset==='game'||g.asset==='text') return;
    if(g.asset!==want){ g.asset=want; changed++; }
  });
  if(changed) console.log('[PGS] ideas assets normalised to',want,'—',changed,'fixed');
  return art;
}

// Ideas mode depends on each idea carrying its OWN prose. When the model ignores that and writes the
// whole category as one block, the page degenerates into a wall of text plus a stack of photos, so the
// section's paragraphs are split back out and handed to the ideas one by one.
function splitParas(html){
  const out=[]; const re=/<p\b[^>]*>([\s\S]*?)<\/p>/gi; let m;
  while((m=re.exec(String(html||'')))!==null){ if(htmlToPlain(m[1])) out.push(m[0]); }
  return out;
}
function redistributeIdeaProse(art,mode){
  if(mode!=='ideas') return art;
  let fixed=0;
  (art.sections||[]).forEach(sec=>{
    const head=String(sec.heading||'').trim();
    const ideas=(art.games||[]).filter(g=>String(g.section||'').trim()===head && g.asset!=='game' && g.asset!=='text');
    if(ideas.length<2) return;
    const haveProse=ideas.filter(g=>htmlToPlain(g.content||'')).length;
    if(haveProse>=ideas.length) return;
    const paras=splitParas(sec.content);
    if(paras.length<ideas.length) return;
    const extra=paras.length-ideas.length;
    const lead=paras.slice(0,extra), body=paras.slice(extra);
    ideas.forEach((g,i)=>{ if(!htmlToPlain(g.content||'')) g.content=body[i]||''; });
    sec.content=lead.join('');
    fixed+=ideas.length;
  });
  if(fixed) console.log('[PGS] ideas prose redistributed to',fixed,'ideas');
  return art;
}

// A printable invitation is a FORM first and a picture second: the layout, the field list and the
// contrast floor are pinned down here so the model cannot centre labels over the writing lines.
const INVITATION_SPEC=`INVITATION SHEET SPEC: follow this layout exactly; it overrides any conflicting layout wording above.
PAGE ZONES, top to bottom:
1. ARTWORK + HEADLINE: the themed illustration and the design's title phrase. The headline may be script or playful, but it must be DARK and clearly readable.
2. WARM INVITATION LINE: directly under the headline, before the fields, write 1-2 short warm sentences in real invitation language that match THIS design's theme and simply invite people to come and celebrate, for a bunny design something like "Hop on over and celebrate with us! Join us for cake, bubbles and a very happy afternoon." Warm, personal, the way a shop-bought invitation reads. Never a placeholder name, never a date, never "Lorem ipsum".
   NO AGE IN THIS LINE: do not write "turning one", "1st birthday", "is turning 2", a number of years or a birthday-candle number here. This is simply an invitation to come and celebrate. (The design's theme name in the headline above may keep its own wordplay, e.g. "Mr. ONEderful".)
3. FILL-IN BLOCK: exactly these five rows, in this order, and nothing else, Name, Date, Time, Address, RSVP.

FILL-IN BLOCK RULES (the most important part of the sheet):
- Every label is LEFT-ALIGNED, all five starting at the SAME left margin, stacked vertically.
- After each label comes ONE straight, unbroken, EMPTY writing line that runs to the right margin. The lines all start at the same x position (just past the longest label) so their left ends align in a clean column.
- The label NEVER sits on the line, over the line, or centred above it. Nothing is printed on a writing line, no dots, no ornament, no sample text, no shading.
- Generous vertical spacing between rows: each line needs about 1 cm of clear height so an adult can write on it by hand with a pen.
- NO pre-filled values anywhere: no invented names, dates, times, addresses or phone numbers.
- NO AGE AS A FIELD OR A STATED FACT: there is no "Age" label and no "Turning ONE" / "1st birthday" line anywhere in the copy. The five rows above are the only fillable rows.
- EXCEPTION: the design's own theme name may keep its wordplay: headlines like "Mr. ONEderful", "Winter ONEderland" or "Wild One" are the NAME of the design, not an age statement, and should be printed as given. What is forbidden is a separate age row, an age sentence in the invitation copy, or a number-shaped balloon, candle or badge used as an age badge.

NEVER ON THE SHEET: a "Download & Print" button or any other button, a download or printer icon, a QR code, a link or any web-page interface element. That button belongs to the article page, not to the printed invitation.

CONTRAST FLOOR (applies to every word on the sheet):
- All text, headline, warm line, labels, must be a deep, saturated, clearly readable tone against the background: charcoal, deep ink, or a dark shade of the theme colour.
- NEVER pale-on-pale: no pastel lavender on cream, no soft pink on blush, no light grey on white, no white text on a light background. If the palette is soft, the type must be the dark anchor of that palette.
- Writing lines are a clear dark hairline, not a faint tint.`;
function applyInvitationSpec(art,mode,wantDl){
  if(mode!=='ideas'||!wantDl) return art;
  const hay=`${art.title||''} ${art.focusKeyword||''}`.toLowerCase();
  if(!/invitation|invite/.test(hay)) return art;
  let n=0;
  (art.games||[]).forEach(g=>{
    if(g.asset!=='printable') return;
    g.imagePrompt=String(g.imagePrompt||'').replace(/\s*INVITATION SHEET SPEC[\s\S]*$/i,'').trim()+'\n\n'+INVITATION_SPEC;
    n++;
  });
  if(n) console.log('[PGS] invitation form spec applied to',n,'sheets');
  return art;
}

// Без подсказки модель снимает каждую идею одинаково: в лоб, по центру, с одного расстояния.
// Раньше здесь лежал список мест на празднике — десертный стол, шары, стульчик для кормления —
// и он навязывал СЮЖЕТ: статья про подарочные корзины получала фотографии чужой вечеринки.
// Теперь ротация задаёт только КАДР, а что в кадре — решает абзац этой идеи.
/* Диафрагма теперь стоит внутри каждого плана. Без неё общий план проигрывал: контракт
   жёстко задавал f/2.8 с размытым фоном, а на f/2.8 «весь предмет в своей обстановке»
   физически не снять, поэтому все кадры съезжали в крупный план. */
const SHOT_FRAMINGS=[
  'a WIDE ESTABLISHING SHOT at about f/8, the whole subject in its setting with the room around it readable and sharp, straight on, with room to breathe',
  'a three-quarter view from slightly above at about f/4, the front sharp and the background softening without dissolving',
  'a flat lay looking straight down at about f/5.6, the elements laid out across the surface and all of them sharp',
  'a tight detail crop at about f/2.8 of the part that matters most: texture, edge, fold, ribbon, surface',
  'a low, near eye-level angle at about f/4 so the subject stands against the space behind it',
  'the subject shown mid-use or mid-arrangement at about f/4, as if someone stepped away a moment ago',
  'an off-centre composition at about f/4 with the subject to one side and quiet negative space beside it',
  'a PULLED-BACK VIEW at about f/8 that includes the corner of the room the subject lives in, furniture, window and floor visible'
];
/* Света в контракте был ровно один: мягкий рассеянный из окна. Он и делал фотографии
   несолнечными и непраздничными. Теперь свет крутится вместе с планом. */
const SHOT_LIGHT=[
  'bright direct sunlight through a window, with real sun patches on the surface and clean defined shadow edges',
  'warm low afternoon sun raking across the scene from one side, long soft shadows, golden cast',
  'an airy high-key room full of bounced daylight, light walls, almost no heavy shadow',
  'clear midday daylight outdoors in open shade, colours clean and saturated, sky light from above',
  'soft even daylight from a large window on an overcast day',
  'sunlight dappled through leaves or a curtain, moving patches of light across the subject',
  'bright daylight with a strong sunbeam crossing the frame and lighting dust or steam in the air',
  'fresh morning light, cool-clean but bright, with crisp small highlights'
];
function assignShotTypes(art,mode){
  if(mode!=='ideas') return art;
  const rnd=rng32(seedNum(art.focusKeyword||art.title||'x'));
  const shuffle=a=>{ const p=a.slice(); for(let i=p.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [p[i],p[j]]=[p[j],p[i]]; } return p; };
  const pool=shuffle(SHOT_FRAMINGS);
  const lights=shuffle(SHOT_LIGHT);
  let n=0, assigned=0;
  (art.games||[]).forEach(g=>{
    if(g.asset!=='illustration'||!g.imagePrompt) return;
    const framing=pool[n%pool.length];
    const light=lights[n%lights.length];
    n++;
    g.imagePrompt=String(g.imagePrompt).replace(/\s*SHOT:[\s\S]*$/i,'').trim()
      +` SHOT: ${framing}. LIGHT: ${light}. The framing and the light above override any camera default stated earlier in this prompt. The subject is whatever THIS idea's own paragraph describes, only the framing rotates, the subject never turns into generic party scenery. No people.`;
    g.extraImagePrompts=[];   // одна фотография на идею: дополнительные кадры отменены
    assigned++;
  });
  if(assigned) console.log('[PGS] framings rotated across',assigned,'ideas');
  return art;
}
