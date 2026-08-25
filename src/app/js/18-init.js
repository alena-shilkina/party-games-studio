/* ---------- NEW ARTICLE (reset) ---------- */
function newArticle(){
  ST.batchRow=null;   // back to single-article mode: don't inherit the last batch row's flags
  ST.refMode='';      // и не наследуем её режим работы с референсом
  ST.article=null; ST.pins=[]; ST.feat=null; ST.paa=[];
  ['mainKW','titleInput','context','pinKW','featKW'].forEach(id=>{if($(id))$(id).value='';});
  $('paaList').innerHTML=''; $('featPreview').innerHTML='';
  $('preview').innerHTML=''; $('pubbarHost').innerHTML='';
  $('emptyState').style.display='';
  clearRef();
  window.scrollTo(0,0);
  toast('Ready for a new article','ok');
}

/* ---------- INIT ---------- */
renderVibes();
renderWPCatSelect();
loadSettings();
loadServerKeys();
applyPinsSwitch();   // пины пока выключены — прячем их блок   // узнаём, какие ключи уже лежат на сервере
loadBatch();
loadReview();
if(getSite()) fetchWPCats(false);
openBatch();   // CSV/batch is the primary workflow — start here; "✎ Single" opens the one-off article view
