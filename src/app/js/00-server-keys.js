/* ---------- КЛЮЧИ НА СЕРВЕРЕ ----------
   Ключи Claude / Runware / Pexels и логин WordPress лежат в секретах Worker'а
   и в браузер не попадают. Запросы идут через /api/*, ключ подставляет Worker.

   Если какой-то секрет не задан, Worker берёт ключ из поля в Настройках, как раньше.
   Поэтому переключение постепенное: задала секрет — поле стало ненужным, не задала —
   всё работает по-старому.                                                          */
const SERVER_KEYS={claude:false,runware:false,pexels:false,wp:false};

async function loadServerKeys(){
  try{
    const r=await fetch('/api/keys');
    if(r.ok) Object.assign(SERVER_KEYS,await r.json());
  }catch(e){ /* не достучались — значит работаем на ключах из Настроек */ }
  applyServerKeys();
}

// Всё, что уже лежит на сервере, вычищаем из браузера: поле в Настройках гасим,
// а старое значение стираем из localStorage — иначе ключ так и остался бы лежать там
// с прошлых запусков, хотя больше нигде не нужен.
function applyServerKeys(){
  let changed=false;

  const fields={claude:'claudeKey',runware:'runwareKey',pexels:'pexelsKey'};
  for(const name in fields){
    const el=$(fields[name]); if(!el||!SERVER_KEYS[name]) continue;
    if(el.value) changed=true;
    el.value=''; el.disabled=true; el.placeholder='хранится на сервере';
  }

  // логин WordPress тоже подставляет Worker — в карточках сайтов он больше не нужен
  if(SERVER_KEYS.wp){
    (ST.sites||[]).forEach(s=>{
      if(s.username||s.password){ s.username=''; s.password=''; changed=true; }
    });
  }

  if(changed){ saveSettings(); renderSites(); }
}

// есть ли рабочий ключ — на сервере или введённый вручную
const keyReady=name=>SERVER_KEYS[name]||!!v(name+'Key');
