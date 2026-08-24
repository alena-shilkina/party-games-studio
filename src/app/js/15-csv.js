/* ---------- CSV ---------- */
function loadCSV(e){
  const f=e.target.files[0]; if(!f)return;
  const rd=new FileReader();
  rd.onload=()=>{
    let text=rd.result.replace(/^\uFEFF/,'');                 // strip BOM
    const lines=text.split(/\r?\n/).filter(l=>l.trim());
    if(!lines.length){ ST.csv=[]; $('csvInfo').textContent='0 internal links loaded.'; return; }
    // minimal CSV row parser (handles "quoted, fields")
    const parse=line=>{ const out=[]; let cur='',q=false;
      for(let i=0;i<line.length;i++){ const c=line[i];
        if(q){ if(c==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
        else { if(c==='"')q=true; else if(c===','){out.push(cur);cur='';} else cur+=c; } }
      out.push(cur); return out.map(s=>s.trim()); };
    const header=parse(lines[0]).map(h=>h.toLowerCase());
    // find the URL column and the title column from the header
    let urlIdx=header.findIndex(h=>/url|permalink|link|href/.test(h));
    let titleIdx=header.findIndex(h=>/title|name|post|anchor/.test(h));
    const hasHeader=urlIdx>=0||titleIdx>=0;
    const rows=[];
    for(let i=hasHeader?1:0;i<lines.length;i++){
      const cells=parse(lines[i]); if(!cells.length)continue;
      // if no header matched, auto-detect: URL = the cell starting with http, title = longest non-url cell
      let url = urlIdx>=0 ? cells[urlIdx] : (cells.find(c=>/^https?:\/\//i.test(c))||'');
      let title = titleIdx>=0 ? cells[titleIdx] : (cells.filter(c=>!/^https?:\/\//i.test(c)).sort((a,b)=>b.length-a.length)[0]||'');
      if(url&&/^https?:\/\//i.test(url)) rows.push({url:url.trim(),title:(title||url).trim()});
    }
    ST.csv=rows; $('csvInfo').textContent=rows.length+' internal links loaded.'; saveSettings();
  };
  rd.readAsText(f);
}
