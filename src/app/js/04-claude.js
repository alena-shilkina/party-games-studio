/* ---------- CLAUDE (plain + web_search loop, from fashion) ---------- */
function extractJSON(txt){
  let t=(txt||'').trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
  const a=t.indexOf('{');
  if(a>=0){
    // find the matching closing brace of the FIRST object (respect strings/escapes) → ignore any trailing text
    let depth=0,inStr=false,esc=false,end=-1;
    for(let i=a;i<t.length;i++){ const c=t[i];
      if(inStr){ if(esc)esc=false; else if(c==='\\')esc=true; else if(c==='"')inStr=false; }
      else { if(c==='"')inStr=true; else if(c==='{')depth++; else if(c==='}'){ depth--; if(depth===0){end=i;break;} } }
    }
    t = end>a ? t.slice(a,end+1) : t.slice(a);
  }
  try{ return JSON.parse(t); }
  catch(e1){
    // repair 1: escape raw control chars AND fix invalid escape sequences INSIDE string values
    const VALID_ESC='"\\/bfnrtu';
    const fixCtrl=s=>{ let o='',inStr=false,esc=false;
      for(let i=0;i<s.length;i++){ const c=s[i];
        if(inStr){
          if(esc){ o+= (VALID_ESC.indexOf(c)>=0? c : '\\'+c); esc=false; continue; }  // bad escape → keep the backslash literal
          if(c==='\\'){o+=c;esc=true;continue;}
          if(c==='"'){inStr=false;o+=c;continue;}
          if(c==='\n'){o+='\\n';continue;} if(c==='\r'){o+='\\r';continue;} if(c==='\t'){o+='\\t';continue;}
          o+=c;
        } else { if(c==='"'){inStr=true;} o+=c; }
      } return o; };
    // repair 2: strip trailing commas before } or ]
    let repaired=fixCtrl(t).replace(/,\s*([}\]])/g,'$1');
    try{ return JSON.parse(repaired); }
    catch(e2){ throw new Error('Response wasn\'t valid JSON (likely truncated — try a smaller article or fewer games). '+e2.message); }
  }
}
/* ---------- ВЫБОР МОДЕЛИ ДЛЯ ТЕКСТА ----------
   В списке 'claude' и идентификаторы моделей Runware. Список подтягивается из аккаунта,
   чтобы не вводить идентификаторы руками: они выглядят как openai:gpt@5.6-luna и на слух
   не запоминаются. Если список не отдаётся, остаётся известная модель плюс ручной ввод. */
const FALLBACK_LLMS=[{id:'openai:gpt@5.6-luna',label:'GPT-5.6 Luna'}];
// Как называется потолок ответа у выбранной модели. Новые модели ждут
// max_completion_tokens, старые — max_tokens. Определяется по первой же ошибке
// и запоминается, чтобы следующие статьи в пакете не спотыкались о то же самое.
let LAST_TOKEN_FIELD='max_completion_tokens';
function textModel(){
  const sel=v('textModel')||'claude';
  if(sel==='custom') return v('textModelId')||FALLBACK_LLMS[0].id;
  return sel;
}
function toggleCustomModel(){
  const row=$('textModelIdRow'); if(row) row.style.display=(v('textModel')==='custom')?'':'none';
}
async function loadTextModels(){
  const sel=$('textModel'); if(!sel) return;
  // Выбранное значение читаем из хранилища, а не из списка: loadSettings() отработал
  // раньше, когда в списке была только строка Claude, и браузер просто отбросил
  // сохранённый идентификатор как неизвестный.
  let chosen='claude';
  try{ chosen=(JSON.parse(localStorage.getItem('pgs_settings')||'{}').textModel)||'claude'; }catch(e){}
  let list=[];
  try{
    const r=await fetch('/api/llm/models');
    if(r.ok){
      const d=await r.json();
      const raw=Array.isArray(d)?d:(d.data||d.models||[]);
      list=raw.map(m=>{
        const id=typeof m==='string'?m:(m.id||m.model||m.air||m.airId||'');
        const label=(typeof m==='object'&&(m.name||m.displayName))||id;
        return {id,label};
      }).filter(m=>m.id);
    }
  }catch(e){ /* нет списка — обойдёмся запасным */ }
  if(!list.length) list=FALLBACK_LLMS;
  sel.innerHTML='<option value="claude">Claude</option>'
    +list.map(m=>`<option value="${esc(m.id)}">${esc(m.label)}</option>`).join('')
    +'<option value="custom">Other — type the id…</option>';
  // Вернуть то, что было выбрано. Проверяем наличие явно, а не полагаемся на то, что
  // <select> сам отбросит неизвестное значение. Если модели в списке больше нет —
  // переключаемся на ручной ввод и подставляем прежний идентификатор, чтобы выбор
  // не потерялся молча.
  const known=chosen==='claude'||chosen==='custom'||list.some(m=>m.id===chosen);
  sel.value=known?chosen:'custom';
  if(!known){ const inp=$('textModelId'); if(inp&&!inp.value) inp.value=chosen; }
  toggleCustomModel();
}

// GPT-5.6 Luna и другие текстовые модели Runware — через её OpenAI-совместимый эндпоинт.
// Отличий от Claude два, и оба существенные:
//   1) веб-поиска нет: там, где Claude ищет источники и вставляет живые ссылки,
//      эта модель пишет по своим знаниям, и ссылок в тексте не будет;
//   2) ответ приходит в формате OpenAI — choices[0].message.content вместо блоков.
// Наружу функция отдаёт то же самое, что callClaude: склеенный текст.
/* Настройки сэмплинга для моделей Runware. До этого не отправлялось ни одной, и модель
   работала на своём дефолте: текст выходил рубленый и ровный. Runware принимает
   temperature 0-2 (по умолчанию 1) и topP 0-1 (по умолчанию 0.95). */
const LUNA_TEMP=1.05, LUNA_TOP_P=0.95;
// Умеет ли выбранная модель ручки сэмплинга. Выясняется по первой же ошибке и
// запоминается на сессию, чтобы не платить за один и тот же отказ в каждой статье.
let LUNA_SAMPLING=true;
// Доступен ли веб-поиск через родной API. Первый отказ выключает его до перезагрузки:
// иначе каждая статья пакета платит одним и тем же неудачным запросом.
let LUNA_SEARCH_OK=true;

/* Что модель умеет, выясняется по её же отказу, и запоминается НАВСЕГДА, а не на сессию.
   Иначе после каждой перезагрузки первая статья снова упирается в тот же 400 и снова
   сыплет в консоль ошибку, которая выглядит как поломка, хотя это просто выяснение. */
function modelCan(what){
  try{ return localStorage.getItem('pgs_no_'+what+'_'+textModel())!=='1'; }catch(e){ return true; }
}
function modelCannot(what){
  try{ localStorage.setItem('pgs_no_'+what+'_'+textModel(),'1'); }catch(e){}
}

/* Веб-поиск у моделей Runware есть, но только в родном API: в OpenAI-совместимом
   эндпоинте tools не передать. Формат идентификатора там тоже другой, без ':' и '@'.
   Контракт родного API я знаю не целиком, поэтому этот путь всегда с откатом:
   любая осечка возвращает генерацию на проверенный OpenAI-совместимый путь. */
function nativeModelId(air){
  return String(air||'').replace(/[:@]/g,'-').replace(/\./g,'-').replace(/-+/g,'-');
}
async function lunaSearchOnce(model,system,content,maxTokens){
  const settings={maxTokens:maxTokens||16000};
  if(LUNA_SAMPLING&&modelCan('temp')){ settings.temperature=LUNA_TEMP; settings.topP=LUNA_TOP_P; }
  const task={taskType:'textInference',taskUUID:crypto.randomUUID(),model:nativeModelId(model),
    messages:[{role:'system',content:String(system||'')},{role:'user',content:String(content||'')}],
    settings, tools:[{type:'search'}], includeCost:true, deliveryMethod:'sync'};
  const r=await fetch('/api/llm/native',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify([task]),signal:batchAbort?.signal});
  const d=await r.json();
  if(!r.ok||d?.errors?.length||d?.error){
    // печатаем настоящую причину: контракт родного API задокументирован не целиком,
    // и без текста ошибки чинить его придётся вслепую
    const why=d?.errors?.[0]?.message||d?.error?.message||('HTTP '+r.status);
    console.warn('[PGS] веб-поиск недоступен:',why,d);
    throw new Error('native: '+why);
  }
  const item=(d&&Array.isArray(d.data))?d.data[0]:null;
  const text=item&&typeof item.text==='string'?item.text:'';
  // берём только целый ответ: обрезанный дешевле дописать на обычном пути, чем чинить здесь
  if(!text||item.finishReason!=='stop') throw new Error('native path returned nothing usable');
  costAddText(item.inputTokens,item.outputTokens,item.cost);
  return text;
}

async function callLuna(system,content,useSearch,onStatus,maxTokens){
  const model=textModel();   // идентификатор из выпадающего списка
  let messages=[{role:'system',content:String(system||'')},{role:'user',content:String(content||'')}];
  let overloadTries=0, netTries=0, contTries=0, acc='';
  // Потолок ответа у разных моделей называется по-разному: новые ждут
  // max_completion_tokens, older — max_tokens. Начинаем с нового имени и переключаемся,
  // если модель попросит другое: гадать заранее нельзя, а падать из-за названия поля глупо.
  let tokenField=LAST_TOKEN_FIELD;
  let sampling=LUNA_SAMPLING&&modelCan('temp');
  // Когда статье нужен поиск, сначала пробуем родной API с включённым поиском.
  // Не вышло — молча возвращаемся на обычный путь, статья от этого не страдает.
  // Один отказ на сессию: дальше не долбим родной эндпоинт в каждой статье пакета.
  if(useSearch && LUNA_SEARCH_OK && modelCan('search')){
    try{
      if(onStatus) onStatus('🔎 '+model+' ищет в вебе…');
      return await lunaSearchOnce(model,system,content,maxTokens);
    }catch(e){
      if(e.message==='__ABORT__'||batchStopped) throw e;
      LUNA_SEARCH_OK=false; modelCannot('search');
      if(onStatus) onStatus('ℹ️ '+model+' пишет без веб-поиска');
    }
  }
  for(let i=0;i<12;i++){
    if(batchStopped) throw new Error('__ABORT__');
    let r;
    try{
      // Ручки сэмплинга есть не у всех моделей: документация Runware описывает
      // temperature и topP для одних, а Luna принимает только дефолтную единицу и
      // отвечает 400. Поэтому шлём их, пока модель не скажет, что не умеет.
      const body={model,messages};
      if(sampling){ body.temperature=LUNA_TEMP; body.top_p=LUNA_TOP_P; }
      body[tokenField]=maxTokens||16000;
      r=await fetch('/api/llm',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body),signal:batchAbort?.signal});
    }catch(netErr){
      if(netErr.name==='AbortError'||batchStopped) throw new Error('__ABORT__');
      if(netTries<6){ netTries++;
        const wait=Math.min(60000,5000*netTries);
        if(onStatus)onStatus(`🌐 Network paused — retry ${netTries}/6 in ${Math.round(wait/1000)}s…`);
        await new Promise(res=>setTimeout(res,wait));
        continue;
      }
      throw new Error('Network error — check your connection.');
    }
    // тело читаем один раз: на медленном пути Worker отдаёт 200 с ошибкой внутри
    let d=null, err=null, status=r.status;
    try{ d=await r.json(); }catch(x){}
    if(!r.ok) err=d?.error||{message:''};
    else if(d&&d.error){ err=d.error; d=null; }
    if(err){
      const m=err.message||''; status=err.status||status;
      // модель прямо говорит, как называется её поле — переключаемся и повторяем
      const wants=/'?(max_completion_tokens|max_tokens)'?\s*(instead|is supported)/i.exec(m)
               || (/max_tokens.*not supported/i.test(m)?[null,'max_completion_tokens']:null)
               || (/max_completion_tokens.*not supported/i.test(m)?[null,'max_tokens']:null);
      if(wants&&wants[1]&&wants[1]!==tokenField){
        tokenField=wants[1]; LAST_TOKEN_FIELD=tokenField;   // запомним на следующие вызовы
        if(onStatus)onStatus('↻ '+model+' ждёт '+tokenField+' — повторяю');
        continue;
      }
      // «'temperature' does not support 1.05 ... Only the default (1) value is supported»
      // Модель не умеет ручки сэмплинга: убираем их и повторяем, а не роняем статью.
      if(sampling && /\b(temperature|top_p|topP)\b/i.test(m) && /does not support|not supported|unsupported|only the default/i.test(m)){
        sampling=false; LUNA_SAMPLING=false; modelCannot('temp');   // запомним навсегда
        if(onStatus)onStatus('↻ '+model+' не принимает temperature — повторяю без неё');
        continue;
      }
      if((status===429||status===529||status>=500) && overloadTries<5){
        overloadTries++;
        const wait=Math.min(60000,4000*Math.pow(2,overloadTries-1));
        if(onStatus)onStatus(`⏳ Model busy — retry ${overloadTries}/5 in ${Math.round(wait/1000)}s…`);
        await new Promise(res=>setTimeout(res,wait));
        continue;
      }
      throw new Error(m||(model+' '+status));
    }
    const choice=d&&d.choices&&d.choices[0];
    if(!choice) throw new Error(model+' returned an empty response');
    // Runware кладёт точную стоимость в usage.cost, а не на верхний уровень. Читали
    // только d.cost, поэтому точная цена никогда не подхватывалась и стоимость текста
    // всегда считалась приблизительно, по ценникам из настроек.
    const u=d.usage||{};
    costAddText(u.prompt_tokens, u.completion_tokens, (u.cost!=null?u.cost:d.cost));
    const txt=String((choice.message&&choice.message.content)||'');
    // упёрлись в потолок ответа — просим продолжить с того же места, как у Claude
    if(choice.finish_reason==='length' && contTries<3){
      contTries++; acc+=txt;
      if(onStatus)onStatus(`✍️ Long article — continuing (${contTries}/3)…`);
      messages.push({role:'assistant',content:txt});
      messages.push({role:'user',content:'Continue the JSON from exactly where you stopped. Do not repeat anything already sent, do not restart, do not add commentary or code fences — output only the remaining raw JSON so the two parts concatenate into one valid document.'});
      continue;
    }
    return acc+txt;
  }
  throw new Error(model+': too many continuations');
}
async function callClaude(system,content,useSearch,onStatus,maxTokens){
  if(textModel()!=='claude') return callLuna(system,content,useSearch,onStatus,maxTokens);
  const key=v('claudeKey'); if(!keyReady('claude')) throw new Error('Claude key missing in Settings');
  let messages=[{role:'user',content}];
  let overloadTries=0, netTries=0, contTries=0, acc='';
  for(let i=0;i<30;i++){
    if(batchStopped) throw new Error('__ABORT__');
    const body={model:'claude-sonnet-4-6',max_tokens:maxTokens||16000,system,messages};
    if(useSearch) body.tools=[{type:'web_search_20250305',name:'web_search'}];
    let r;
    try{
      r=await fetch('/api/claude',{method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify(body),signal:batchAbort?.signal});
    }catch(netErr){
      if(netErr.name==='AbortError'||batchStopped) throw new Error('__ABORT__');
      // network dropped (computer sleep, ERR_NETWORK_IO_SUSPENDED, connection lost) → wait and retry
      if(netTries<6){ netTries++;
        const wait=Math.min(60000, 5000*netTries);
        if(onStatus)onStatus(`🌐 Network paused — retry ${netTries}/6 in ${Math.round(wait/1000)}s…`);
        await new Promise(res=>setTimeout(res,wait));
        continue;
      }
      throw new Error('Network error — check your connection (the computer may have gone to sleep during the batch).');
    }
    // Тело читаем один раз: и успешный ответ, и ошибка приходят одинаково — в JSON.
    // Долгий запрос Worker отдаёт кодом 200, а ошибку кладёт внутрь тела: держать
    // соединение открытым дольше 100 секунд иначе нельзя, а код ответа к тому моменту
    // уже отправлен. Поэтому настоящий статус ищем и в теле тоже.
    let d=null, err=null, status=r.status;
    try{ d=await r.json(); }catch(x){}
    if(!r.ok) err=d?.error||{message:''};
    else if(d&&d.error){ err=d.error; d=null; }
    if(err){
      const m=err.message||'';
      status=err.status||status;
      if(status===400 && /content filtering|blocked|policy/i.test(m)) throw new Error('Blocked by content filter — rephrase the keyword/audience (e.g. avoid "teen"+Adults)');
      // API overloaded (529) or rate-limited (429) → wait and retry a few times before giving up
      if((status===529||status===429) && overloadTries<5){
        overloadTries++;
        const wait=Math.min(60000, 4000*Math.pow(2,overloadTries-1)); // 4s,8s,16s,32s,60s
        if(onStatus)onStatus(`⏳ API overloaded — retry ${overloadTries}/5 in ${Math.round(wait/1000)}s…`);
        await new Promise(res=>setTimeout(res,wait));
        continue;
      }
      throw new Error(m||('Claude '+status));
    }
    if(!d||!d.content) throw new Error('Claude returned an empty response');
    costAddText(d.usage&&d.usage.input_tokens, d.usage&&d.usage.output_tokens);
    messages.push({role:'assistant',content:d.content});
    if(d.stop_reason==='tool_use'){
      const trs=d.content.filter(b=>b.type==='tool_use').map(b=>{
        if(onStatus&&b.input?.query)onStatus('🔍 '+b.input.query);
        return {type:'tool_result',tool_use_id:b.id,content:''};});
      messages.push({role:'user',content:trs});
      continue;
    }
    const txt=d.content.filter(b=>b.type==='text').map(b=>b.text).join('');
    // Long articles (15 recipes, 25 games) can hit the output ceiling — with web search on, the search
    // results are returned inside the answer and eat the same budget. A truncated reply is invalid JSON,
    // so ask the model to carry on from exactly where it stopped and stitch the pieces together.
    if(d.stop_reason==='max_tokens' && contTries<3){
      contTries++;
      acc+=txt;
      if(onStatus)onStatus(`✍️ Long article — continuing (${contTries}/3)…`);
      messages.push({role:'user',content:'Continue the JSON from exactly where you stopped. Do not repeat anything already sent, do not restart, do not add commentary or code fences — output only the remaining raw JSON so the two parts concatenate into one valid document.'});
      continue;
    }
    return acc+txt;
  }
  throw new Error('Claude: too many search iterations');
}
