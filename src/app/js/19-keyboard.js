/* ---------- КЛАВИАТУРА ----------
   Esc закрывает то, что лежит поверх страницы. Порядок сверху вниз: сначала верхний слой.
   Пакет (batchZone) намеренно не закрывается — это основной экран работы, а не всплывашка. */
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape') return;
  const layers=[['reviewZone',closeReview],['drawer',closeSettings]];
  for(const [id,close] of layers){
    const el=$(id);
    if(el&&el.classList.contains('on')){ close(); e.preventDefault(); return; }
  }
});
