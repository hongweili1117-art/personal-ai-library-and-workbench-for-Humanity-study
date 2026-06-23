const $=s=>document.querySelector(s);
let pdfDoc=null,book=null,page=1,total=1,scale=1.35,lastSel='';
let bookLabels=[];function plabel(i){return (bookLabels&&bookLabels[i-1])||String(i);}
let settings=JSON.parse(localStorage.getItem('rw_settings')||'{}');
settings.engine=settings.engine||'DeepSeek';settings.target=settings.target||'简体中文';
settings.nbFont=settings.nbFont||'Spectral';settings.nbSize=settings.nbSize||16;
settings.keys=settings.keys||{};settings.dsModel=settings.dsModel||'deepseek-v4-flash';
settings.oaModel=settings.oaModel||'gpt-5.4-mini';settings.oaEffort=settings.oaEffort||'medium';
settings.claudeModel=settings.claudeModel||'claude-sonnet-4-6';settings.claudeEffort=settings.claudeEffort||'high';
settings.zaiModel=settings.zaiModel||'glm-5.2';settings.qwenModel=settings.qwenModel||'qwen3.7-plus';settings.kimiModel=settings.kimiModel||'kimi-k2.6';settings.customBase=settings.customBase||'';settings.customModel=settings.customModel||'';
settings.glossary=settings.glossary||'';
settings.viewMode=settings.viewMode||'paged';settings.aiThink=settings.aiThink||false;
/* 阅读模式拆成两组互相独立的开关：滚动方式(连续/固定) × 版式(单页/双页)，可自由组合成 4 种。
   旧的单一 viewMode 自动迁移：scroll→连续单页，double→固定双页，paged→固定单页。 */
if(settings.scrollMode===undefined||settings.pageLayout===undefined){
  const _vm=settings.viewMode||'paged';
  settings.scrollMode=(_vm==='scroll')?'continuous':'fixed';
  settings.pageLayout=(_vm==='double')?'double':'single';
}
settings.hlColor=settings.hlColor||'yellow';settings.toolMode=settings.toolMode||'select';
settings.readerBg=settings.readerBg||'sepia';settings.readerBgCustom=settings.readerBgCustom||'#F4EEE2';
settings.barLocked=(settings.barLocked!==false);   // 顶栏默认锁定（常驻）；解锁后才会在阅读时自动隐藏
settings.fitMode=settings.fitMode||'width';   // 自动适配模式：width=适配宽度 / page=整页 / off=自由缩放（#7）
if(settings.lockBar===undefined)settings.lockBar=true;   // 顶栏默认锁定常驻（#5）
function saveSettings(){localStorage.setItem('rw_settings',JSON.stringify(settings));}
function getKey(){return settings.keys[settings.engine]||'';}
function aiURL(p){return p;}
function curModel(){if(settings.engine==='DeepSeek')return settings.dsModel;if(settings.engine==='OpenAI')return settings.oaModel;if(settings.engine==='Claude')return settings.claudeModel;if(settings.engine==='ZAI')return settings.zaiModel;if(settings.engine==='Qwen')return settings.qwenModel;if(settings.engine==='Kimi')return settings.kimiModel;if(settings.engine==='CustomOpenAI')return settings.customModel;return null;}
function curEffort(){if(settings.engine==='OpenAI')return settings.oaEffort;if(settings.engine==='Claude')return settings.claudeEffort;return null;}
function curBaseURL(){return settings.engine==='CustomOpenAI'?settings.customBase:'';}
function esc(s){return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
let toastT;function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toastT);toastT=setTimeout(()=>t.style.display='none',3200);}
async function api(path,opts){const r=await fetch(path,opts);const ct=r.headers.get('content-type')||'';const d=ct.includes('json')?await r.json():await r.text();if(!r.ok)throw new Error((d&&d.error)||('HTTP '+r.status));return d;}
function jpost(path,obj,signal){return api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj),signal});}
function aipost(path,obj,signal){return api(aiURL(path),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj),signal});}
function selText(){return (window.getSelection&&window.getSelection().toString().trim())||'';}
function fontStack(f){return f==='Spectral'?"'Spectral',Georgia,serif":f==='Inter'?"'Inter',system-ui,sans-serif":f==='Mono'?"'Consolas','Courier New',monospace":f;}
function colorCss(c){return ({yellow:'#fff064',green:'#71ff71',red:'#ff7373',blue:'#7096ff'}[c]||'#fff064');}
function applyReaderBg(){
  const root=document.documentElement;let bg=settings.readerBgCustom||'#F4EEE2';
  if(settings.readerBg==='sepia')bg='#F4EEE2';if(settings.readerBg==='white')bg='#FFFFFF';if(settings.readerBg==='black')bg='#111111';if(settings.readerBg==='gray')bg='#ECECEC';
  root.style.setProperty('--paper',bg);
  if(settings.readerBg==='black'){root.style.setProperty('--panel','#1E1E1E');root.style.setProperty('--ink','#F1F1F1');root.style.setProperty('--muted','#B8B8B8');root.style.setProperty('--line','rgba(255,255,255,.16)');root.style.setProperty('--accent-soft','rgba(255,255,255,.10)');}
  else{root.style.setProperty('--panel','#FBF7EE');root.style.setProperty('--ink','#2C2A24');root.style.setProperty('--muted','#8B8576');root.style.setProperty('--line','rgba(44,42,36,.13)');root.style.setProperty('--accent-soft','rgba(154,95,58,.10)');}
}
function setToolMode(mode){settings.toolMode=mode;saveSettings();document.body.classList.toggle('tool-eraser',mode==='eraser');$('#hl-tool')&&$('#hl-tool').classList.toggle('on',mode==='highlight');$('#eraser-tool')&&$('#eraser-tool').classList.toggle('on',mode==='eraser');}

/* ===== 清除 AI 输出里的 Markdown 记号（### ** * ` > 列表等），只留干净文字 ===== */
function cleanAI(t){
  if(!t)return '';
  let s=String(t);
  s=s.replace(/```[a-zA-Z0-9]*\n?/g,'').replace(/```/g,'');   // 代码围栏标记
  s=s.replace(/`([^`]*)`/g,'$1');                              // 行内代码
  s=s.replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm,'');                 // 标题 ###
  s=s.replace(/^[ \t]{0,3}>[ \t]?/gm,'');                      // 引用 >
  s=s.replace(/^([ \t]*)[-*+][ \t]+/gm,'$1• ');                // 无序列表 -> •
  s=s.replace(/\*\*([^*]+)\*\*/g,'$1');                        // 加粗 **
  s=s.replace(/__([^_]+)__/g,'$1');                            // 加粗 __
  s=s.replace(/\*([^*\n]+)\*/g,'$1');                          // 斜体 *
  s=s.replace(/\*/g,'');                                       // 残余 *
  s=s.replace(/^[ \t]*\|.*\|[ \t]*$/gm, m=>m.replace(/\|/g,' ').replace(/\s{2,}/g,'  ').trim()); // 表格竖线
  s=s.replace(/^[ \t]*[:\-\s|]{5,}[ \t]*$/gm,'');              // 表格分隔行
  return s;
}
/* ===== 流式输出渲染：节流 + 增量，避免长篇生成时整页频繁重排导致卡顿（#1） =====
   原理：每帧最多刷新一次（requestAnimationFrame 合并多个网络小块）；
   已完成的整行"冻结"为只读文本节点不再重排，只有最后一行随生成滚动更新。
   这样长文从「每个小块都重排整块」O(n²) 降为「每帧只动一行」，几万字也不卡。 */
const _sinks=new WeakMap();
function _ensureSink(el){
  let s=_sinks.get(el);
  if(s&&el.__sinkRoot===s.root&&el.contains(s.root))return s;
  el.textContent='';
  const root=document.createElement('span');
  const frozen=document.createElement('span');
  const live=document.createElement('span');
  root.appendChild(frozen);root.appendChild(live);
  el.appendChild(root);el.__sinkRoot=root;
  s={root,frozen,live,frozenRawLen:0,pendingRaw:'',scheduled:false};
  _sinks.set(el,s);return s;
}
function _flushSink(el,s){
  const raw=s.pendingRaw;
  const stableEnd=raw.lastIndexOf('\n')+1;     // 完整行（含换行）的右边界
  if(stableEnd>s.frozenRawLen){
    const slice=raw.slice(s.frozenRawLen,stableEnd);
    s.frozen.appendChild(document.createTextNode(cleanAI(slice)));
    s.frozenRawLen=stableEnd;
  }
  s.live.textContent=cleanAI(raw.slice(s.frozenRawLen));   // 只重排最后未完成的一行
}
function setOut(el,raw){
  if(!el)return;
  raw=String(raw==null?'':raw);
  const s=_ensureSink(el);
  s.pendingRaw=raw;
  if(!s.scheduled){
    s.scheduled=true;
    requestAnimationFrame(()=>{s.scheduled=false;_flushSink(el,s);});
  }
}

/* ===== 可中止的 AI 调用：每个功能一个 key，对应窗口里的「停止」按钮 ===== */
let aiControllers={};
function aiStart(key){
  if(aiControllers[key]){try{aiControllers[key].abort();}catch(e){}}
  const c=new AbortController();aiControllers[key]=c;
  const b=$('#'+key+'-stop');if(b)b.disabled=false;
  return c;
}
function aiEnd(key){const b=$('#'+key+'-stop');if(b)b.disabled=true;aiControllers[key]=null;}
function stopAI(key){if(aiControllers[key]){try{aiControllers[key].abort();}catch(e){}}}
function isAbort(e){return e&&(e.name==='AbortError'||/aborted|abort/i.test(e.message||''));}

/* ===== AI 内容集合：保存 / 读取 / 查看 / 修改 / 删除 ===== */
let aicData=[],aicSel=null,aicCollapsed={};
async function saveToCollection(category,title,content){
  const c=(content||'').trim();
  if(!c){toast('没有可保存的内容');return;}
  try{
    await jpost('/api/ai_collection/save',{category:category||'其他',title:title||'',content:c,book:book?book.name:''});
    toast('已保存到 AI 内容集合');
    await loadAIC();
  }catch(e){toast('保存失败：'+e.message);}
}
async function loadAIC(){
  try{aicData=await api('/api/ai_collection');}catch(e){aicData=[];}
  const cnt=$('#aic-fab-count');if(cnt)cnt.textContent=aicData.length;
  renderAIC();
}
function renderAIC(){
  const box=$('#aic-list');if(!box)return;box.innerHTML='';
  if(!aicData.length){box.innerHTML='<div class="hint">还没有保存的内容。在任意 AI 功能生成后点「保存」即可收集到这里。</div>';return;}
  const groups={};aicData.forEach(it=>{const k=it.category||'其他';(groups[k]=groups[k]||[]).push(it);});
  Object.keys(groups).forEach(cat=>{
    const wrap=document.createElement('div');wrap.className='aic-cat'+(aicCollapsed[cat]?' collapsed':'');
    const head=document.createElement('div');head.className='aic-cat-head';
    head.innerHTML='<span class="aic-caret">▾</span>'+esc(cat)+'（'+groups[cat].length+'）';
    head.onclick=()=>{aicCollapsed[cat]=!aicCollapsed[cat];renderAIC();};
    const items=document.createElement('div');items.className='aic-items';
    groups[cat].forEach(it=>{const row=document.createElement('div');row.className='aic-item'+(aicSel&&aicSel.id===it.id?' active':'');
      row.innerHTML='<span class="aic-t"></span><span class="aic-time">'+esc(it.time||'')+'</span>';
      row.querySelector('.aic-t').textContent=it.title||'(无标题)';
      row.onclick=()=>openAICItem(it.id);items.appendChild(row);});
    wrap.appendChild(head);wrap.appendChild(items);box.appendChild(wrap);
  });
}
function openAICItem(id){
  aicSel=aicData.find(x=>x.id===id)||null;if(!aicSel)return;
  $('#aic-viewer').style.display='flex';
  $('#aic-title').value=aicSel.title||'';
  $('#aic-content').value=aicSel.content||'';
  renderAIC();
}
async function aicSaveEdit(){
  if(!aicSel)return;
  try{const d=await jpost('/api/ai_collection/update',{id:aicSel.id,title:$('#aic-title').value,content:$('#aic-content').value});
    aicSel=d;await loadAIC();toast('已保存修改');}catch(e){toast('保存失败：'+e.message);}
}
async function aicDelete(){
  if(!aicSel)return;
  try{await jpost('/api/ai_collection/delete',{id:aicSel.id});aicSel=null;$('#aic-viewer').style.display='none';await loadAIC();toast('已删除');}
  catch(e){toast('删除失败：'+e.message);}
}

/* ===== 术语库：外语 + 中文 双输入 ===== */
function parseTerms(){
  return (settings.glossary||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{
    const i=l.indexOf('=');if(i<0)return {a:l,b:''};
    return {a:l.slice(0,i).trim(),b:l.slice(i+1).trim()};
  }).filter(t=>t.a);
}
function writeTerms(arr){settings.glossary=arr.map(t=>t.b?(t.a+' = '+t.b):t.a).join('\n');saveSettings();}
function renderTerms(){
  const box=$('#set-term-list');if(!box)return;box.innerHTML='';
  const arr=parseTerms();
  if(!arr.length){box.innerHTML='<div class="hint">还没有术语。填入「外语」和「中文」后点「确认」即可添加。</div>';return;}
  arr.forEach((t,i)=>{const row=document.createElement('div');row.className='term-item';
    const p=document.createElement('span');p.className='tm-pair';p.textContent=t.a+'  →  '+(t.b||'');
    const del=document.createElement('span');del.className='tm-del';del.textContent='×';del.title='删除';
    del.onclick=()=>{const a=parseTerms();a.splice(i,1);writeTerms(a);renderTerms();};
    row.appendChild(p);row.appendChild(del);box.appendChild(row);});
}
function addTerm(){
  const a=$('#set-term-foreign').value.trim(),b=$('#set-term-zh').value.trim();
  if(!a){toast('请填写外语 / 原文术语');return;}
  const arr=parseTerms();arr.push({a,b});writeTerms(arr);renderTerms();
  $('#set-term-foreign').value='';$('#set-term-zh').value='';$('#set-term-foreign').focus();
  toast('已添加术语');
}

function groupsCollapsed(){try{return JSON.parse(localStorage.getItem('rw_groups_collapsed')||'{}');}catch(e){return {};}}
function setGroupCollapsed(name,val){const g=groupsCollapsed();if(val)g[name]=1;else delete g[name];localStorage.setItem('rw_groups_collapsed',JSON.stringify(g));}
/* ===== 通用确认/输入弹窗（返回 Promise；不依赖原生 confirm/prompt） ===== */
let _umResolve=null;
function _umClose(val){const m=$('#ui-modal');m.classList.remove('open');const r=_umResolve;_umResolve=null;if(r)r(val);}
function uiConfirm(msg,{okText='确定',danger=false}={}){
  return new Promise(res=>{_umResolve=res;
    $('#um-msg').textContent=msg;$('#um-input').style.display='none';
    const ok=$('#um-ok');ok.textContent=okText;ok.className=danger?'danger':'primary';
    $('#ui-modal').classList.add('open');setTimeout(()=>ok.focus(),0);});
}
function uiPrompt(msg,defVal='',{okText='确定'}={}){
  return new Promise(res=>{_umResolve=res;
    $('#um-msg').textContent=msg;const inp=$('#um-input');inp.style.display='block';inp.value=defVal||'';
    const ok=$('#um-ok');ok.textContent=okText;ok.className='primary';
    $('#ui-modal').classList.add('open');setTimeout(()=>{inp.focus();inp.select();},0);});
}
function wireUiModal(){
  $('#um-ok').onclick=()=>{const inp=$('#um-input');_umClose(inp.style.display==='none'?true:inp.value);};
  $('#um-cancel').onclick=()=>_umClose(null);
  $('#ui-modal').addEventListener('click',e=>{if(e.target.id==='ui-modal')_umClose(null);});
  $('#um-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();_umClose($('#um-input').value);}else if(e.key==='Escape'){e.preventDefault();_umClose(null);}});
}

/* ===== 右键菜单（文件 / 分组通用） ===== */
let _ctxMenu=null;
function closeCtxMenu(){if(_ctxMenu){_ctxMenu.remove();_ctxMenu=null;document.removeEventListener('mousedown',_ctxOutside,true);}}
function _ctxOutside(e){if(_ctxMenu&&!_ctxMenu.contains(e.target))closeCtxMenu();}
function showCtxMenu(x,y,items){
  closeCtxMenu();if(typeof closeFolderPop==='function')closeFolderPop();
  const m=document.createElement('div');m.className='ctx-menu';_ctxMenu=m;
  items.forEach(it=>{
    if(it.sep){const s=document.createElement('div');s.className='ctx-sep';m.appendChild(s);return;}
    const b=document.createElement('button');b.className='ctx-item'+(it.danger?' danger':'');b.textContent=it.label;
    b.onclick=()=>{closeCtxMenu();if(it.onClick)it.onClick();};m.appendChild(b);
  });
  document.body.appendChild(m);
  const w=m.offsetWidth||176,h=m.offsetHeight||10;
  m.style.left=Math.min(x,window.innerWidth-w-8)+'px';
  m.style.top=Math.min(y,window.innerHeight-h-8)+'px';
  setTimeout(()=>document.addEventListener('mousedown',_ctxOutside,true),0);
}

async function deleteBook(b){
  if(!b)return;closeCtxMenu();
  const ok=await uiConfirm('确定删除「'+(b.name||'该文件')+'」吗？\n\n这会从书库移除它，并删除它的 PDF 文件、相关高亮、笔记与索引。\n此操作不可撤销。',{okText:'删除',danger:true});
  if(!ok)return;
  try{
    await jpost('/api/lib/delete',{id:b.id});
    if(book&&book.id===b.id){book=null;try{$('#doc-title').textContent='未打开任何文件';}catch(e){}}
    await loadLibrary();toast('已删除');
  }catch(e){toast('删除失败：'+e.message);}
}
async function renameGroup(name){
  closeCtxMenu();
  const nn=await uiPrompt('把分组「'+name+'」重命名为：',name,{okText:'重命名'});
  if(nn==null)return;const v=(''+nn).trim();if(!v||v===name)return;
  try{await jpost('/api/lib/rename_group',{old:name,'new':v});await loadLibrary();toast('已重命名分组');}
  catch(e){toast('失败：'+e.message);}
}
async function deleteGroup(name){
  closeCtxMenu();
  const ok=await uiConfirm('解散分组「'+name+'」吗？\n\n分组里的文件不会被删除，会移动到「未分类」。',{okText:'解散分组',danger:true});
  if(!ok)return;
  try{await jpost('/api/lib/delete_group',{name:name});await loadLibrary();toast('已解散分组');}
  catch(e){toast('失败：'+e.message);}
}

function bookCardHTML(b){const pct=Math.round(((b.current_page+1)/Math.max(1,b.total_pages))*100);
  return '<div class="book-name-row"><div class="book-name">'+esc(b.name)+'</div>'+
    '<button class="book-folder" title="移动到分组 / 二级书架">📁</button></div>'+
    '<div class="bar"><span style="width:'+pct+'%"></span></div>'+
    '<div class="book-meta">'+(b.current_page+1)+'/'+b.total_pages+' 页 · '+pct+'%</div>';}
function makeBookCard(b,allGroups){
  const el=document.createElement('div');el.className='book'+(book&&book.id===b.id?' active':'');
  el.innerHTML=bookCardHTML(b);
  el.onclick=()=>openBook(b);
  const fb=el.querySelector('.book-folder');
  fb.onclick=(ev)=>{ev.stopPropagation();openFolderPopover(fb,b,allGroups);};
  el.oncontextmenu=(ev)=>{ev.preventDefault();ev.stopPropagation();showCtxMenu(ev.clientX,ev.clientY,[
    {label:'📖 打开',onClick:()=>openBook(b)},
    {label:'📁 移动到分组…',onClick:()=>openFolderPopover(fb,b,allGroups)},
    {sep:true},
    {label:'🗑 删除文件',danger:true,onClick:()=>deleteBook(b)},
  ]);};
  return el;}
async function loadLibrary(){
  const lib=await api('/api/library');const box=$('#book-list');box.innerHTML='';
  // 收集分组（二级书架），保持出现顺序；"未分类"始终放最后
  const order=[];const groups={};
  lib.forEach(b=>{const g=(b.group||'').trim()||'未分类';if(!groups[g]){groups[g]=[];order.push(g);}groups[g].push(b);});
  const named=order.filter(g=>g!=='未分类');
  const allGroups=named.slice();
  if(!named.length){
    // 还没有任何分组：平铺显示（保持简洁），但每本书仍可通过 📁 归入新分组
    lib.forEach(b=>box.appendChild(makeBookCard(b,allGroups)));
    return lib;
  }
  const seq=named.concat(groups['未分类']?['未分类']:[]);
  const collapsed=groupsCollapsed();
  seq.forEach(gname=>{
    const wrap=document.createElement('div');wrap.className='shelf-group'+(collapsed[gname]?' collapsed':'');
    const head=document.createElement('div');head.className='group-head';
    head.innerHTML='<span class="group-caret">▾</span><span class="group-title"></span><span class="group-count">'+groups[gname].length+'</span>';
    head.querySelector('.group-title').textContent=(gname==='未分类'?'📂 未分类':'📁 '+gname);
    head.onclick=()=>{const now=!wrap.classList.contains('collapsed');wrap.classList.toggle('collapsed',now);setGroupCollapsed(gname,now);};
    if(gname!=='未分类'){
      head.title='点击展开/收起 · 右键可重命名/解散分组';
      head.oncontextmenu=(ev)=>{ev.preventDefault();ev.stopPropagation();showCtxMenu(ev.clientX,ev.clientY,[
        {label:'✏️ 重命名分组',onClick:()=>renameGroup(gname)},
        {sep:true},
        {label:'🗑 解散分组（文件移到未分类）',danger:true,onClick:()=>deleteGroup(gname)},
      ]);};
    }
    wrap.appendChild(head);
    const body=document.createElement('div');body.className='group-body';
    groups[gname].forEach(b=>body.appendChild(makeBookCard(b,allGroups)));
    wrap.appendChild(body);box.appendChild(wrap);
  });
  return lib;
}
let _folderPop=null;
function closeFolderPop(){if(_folderPop){_folderPop.remove();_folderPop=null;document.removeEventListener('mousedown',_folderPopOutside,true);}}
function _folderPopOutside(e){if(_folderPop&&!_folderPop.contains(e.target))closeFolderPop();}
async function moveBookToGroup(b,group){closeFolderPop();
  try{await jpost('/api/lib/set_group',{id:b.id,group:group||''});await loadLibrary();toast(group?('已移动到「'+group+'」'):'已移出分组');}
  catch(e){toast('移动失败：'+e.message);}}
function openFolderPopover(anchor,b,allGroups){
  closeFolderPop();
  const pop=document.createElement('div');pop.className='folder-pop';_folderPop=pop;
  const cur=(b.group||'').trim();
  let html='<div class="fp-title">移动「'+esc((b.name||'').slice(0,18))+'」到：</div>';
  pop.innerHTML=html;
  allGroups.forEach(g=>{const btn=document.createElement('button');btn.textContent=(g===cur?'✓ ':'📁 ')+g;btn.onclick=()=>moveBookToGroup(b,g);pop.appendChild(btn);});
  if(cur){const out=document.createElement('button');out.textContent='↩ 移出分组（未分类）';out.onclick=()=>moveBookToGroup(b,'');pop.appendChild(out);}
  const nw=document.createElement('div');nw.className='fp-new';
  const inp=document.createElement('input');inp.placeholder='＋ 新建分组名…';
  const ok=document.createElement('button');ok.className='mini primary';ok.textContent='建';ok.style.flex='0 0 auto';
  const go=()=>{const v=inp.value.trim();if(v)moveBookToGroup(b,v);};
  ok.onclick=go;inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go();}});
  nw.appendChild(inp);nw.appendChild(ok);pop.appendChild(nw);
  const dz=document.createElement('div');dz.className='fp-del';
  const db=document.createElement('button');db.textContent='🗑 删除此文件';db.onclick=()=>{closeFolderPop();deleteBook(b);};
  dz.appendChild(db);pop.appendChild(dz);
  document.body.appendChild(pop);
  const r=anchor.getBoundingClientRect();
  pop.style.left=Math.min(r.left,window.innerWidth-210)+'px';
  pop.style.top=Math.min(r.bottom+4,window.innerHeight-60)+'px';
  setTimeout(()=>{document.addEventListener('mousedown',_folderPopOutside,true);inp.focus();},0);
}
async function openBook(b){
  book=b;localStorage.setItem('rw_lastbook',b.id);$('#doc-title').textContent=b.name;$('#shelf').classList.remove('open');
  bookLabels=[];api('/api/page_labels/'+encodeURIComponent(b.id)).then(r=>{bookLabels=r.labels||[];refreshPageBadges();}).catch(()=>{});
  if(typeof pdfjsLib==='undefined'){toast('PDF 引擎(PDF.js)未加载成功。请确认程序目录下的 lib/pdf.min.js 与 lib/pdf.worker.min.js 存在，然后刷新页面。');return;}
  try{pdfDoc=await pdfjsLib.getDocument('/api/pdf/'+encodeURIComponent(b.id)).promise;
    total=pdfDoc.numPages;page=Math.min(Math.max(1,(b.current_page||0)+1),total);
    estH=0;if(settings.fitMode!=='off'){try{scale=await computeFitScale();}catch(e){}}await buildPages();updateFitBtn();loadLibrary();loadHighlights();loadNotes();
  }catch(e){
    const m=(e&&e.message)||String(e);
    if(/fetch|worker|dynamically imported/i.test(m)){
      toast('打开失败：PDF 渲染组件未能就位。请确认 lib 文件夹内有 pdf.min.js 和 pdf.worker.min.js 后刷新页面重试。');
    }else{
      toast('打开失败：'+m);
    }
  }
}
let renderTok=0, pageEls={}, io=null, estH=0;
function clearPages(){renderTok++;if(io){io.disconnect();io=null;}pageEls={};$('#pages').innerHTML='';}
async function setPageOffset(readingNum){
  if(!book){toast('请先打开一本书');return;}
  const ans=await uiPrompt('这一页（阅读第 '+readingNum+' 页）在书里印的页码是第几页？只填数字（填 1 表示正文第 1 页）',String(plabel(readingNum)));
  if(ans===null||ans===undefined)return;
  const printed=parseInt(String(ans).replace(/[^0-9-]/g,''),10);
  if(isNaN(printed)){toast('请填一个数字');return;}
  try{const r=await jpost('/api/page_offset',{id:book.id,offset:readingNum-printed});bookLabels=r.labels||bookLabels;refreshPageBadges();loadHighlights();toast('已对齐：本页为书内第 '+printed+' 页');}
  catch(e){toast('设置失败：'+e.message);}
}
function refreshPageBadges(){Object.keys(pageEls).forEach(k=>{const pe=pageEls[k];if(!pe||!pe.wrap)return;const bd=pe.wrap.querySelector('.pg-badge');if(bd)bd.title='阅读第 '+k+' 页 · 印刷页码 '+plabel(+k)+'（点击对齐书内页码）';});}
function makePageEl(num){
  const wrap=document.createElement('div');wrap.className='page-wrap';wrap.dataset.page=num;
  if(estH)wrap.style.minHeight=estH+'px';
  const canvas=document.createElement('canvas');
  const ann=document.createElement('div');ann.className='anno-layer';
  const tl=document.createElement('div');tl.className='textLayer';
  const ocr=document.createElement('div');ocr.className='ocr-layer'+(ocrMode?' on':'');
  wrap.appendChild(canvas);wrap.appendChild(ann);wrap.appendChild(tl);wrap.appendChild(ocr);
  const badge=document.createElement('div');badge.className='pg-badge';badge.textContent=num;badge.title='阅读第 '+num+' 页 · 印刷页码 '+plabel(num)+'（点击对齐书内页码）';badge.onclick=ev=>{ev.stopPropagation();setPageOffset(num);};wrap.appendChild(badge);
  attachOcr(ocr,canvas,num);
  pageEls[num]={wrap,canvas,ann,tl,rendered:false};
  return wrap;
}
async function renderPageEl(num){
  const pe=pageEls[num];if(!pe||pe.rendered||!pdfDoc)return;
  const myTok=renderTok;let pg;try{pg=await pdfDoc.getPage(num);}catch(e){return;}
  if(myTok!==renderTok)return;
  const vp=pg.getViewport({scale}),ratio=window.devicePixelRatio||1,cv=pe.canvas,ctx=cv.getContext('2d');
  // 渲染前测量：若该页在当前视口上方，改变其高度时补偿 scrollTop，避免阅读时画面被突然拉动
  const vEl=$('#viewer');const aboveFold=(isContinuous())&&(pe.wrap.getBoundingClientRect().bottom<=vEl.getBoundingClientRect().top+1);const h0=pe.wrap.offsetHeight;
  cv.width=vp.width*ratio;cv.height=vp.height*ratio;cv.style.width=vp.width+'px';cv.style.height=vp.height+'px';
  ctx.setTransform(ratio,0,0,ratio,0,0);
  pe.wrap.style.minHeight='';pe.wrap.style.width=vp.width+'px';if(!estH)estH=vp.height;
  if(aboveFold){const h1=pe.wrap.offsetHeight;if(h1!==h0)vEl.scrollTop+=(h1-h0);}
  pe.rendered=true;
  try{await pg.render({canvasContext:ctx,viewport:vp}).promise;}catch(e){if(e&&e.name==='RenderingCancelledException'){pe.rendered=false;return;}}
  if(myTok!==renderTok)return;
  pe.tl.innerHTML='';pe.tl.style.width=vp.width+'px';pe.tl.style.height=vp.height+'px';pe.tl.style.setProperty('--scale-factor',vp.scale);
  try{const tc=await pg.getTextContent();if(myTok===renderTok){await pdfjsLib.renderTextLayer({textContent:tc,container:pe.tl,viewport:vp,textDivs:[]}).promise;
    pe.tl.querySelectorAll('span').forEach(sp=>{if(!(sp.textContent||'').trim()){sp.style.userSelect='none';sp.style.webkitUserSelect='none';}});
    enhanceTextSelection(pe.tl);}}catch(e){}
  renderAnnotations();
}
// 复刻 PDF.js TextLayerBuilder 的「endOfContent」选择机制：renderTextLayer 本身不带，
// 缺了它划词就会不顺、并把页面边上的空白一起选中。补上后选择平滑且止于文字。
function enhanceTextSelection(tl){
  if(tl._selEnhanced)return;tl._selEnhanced=true;
  let end=tl.querySelector('.endOfContent');
  if(!end){end=document.createElement('div');end.className='endOfContent';tl.appendChild(end);}
  tl.addEventListener('mousedown',e=>{
    if(e.target!==tl){const b=tl.getBoundingClientRect();const r=Math.max(0,Math.min(1,(e.clientY-b.top)/(b.height||1)));end.style.top=(r*100).toFixed(2)+'%';}
    end.classList.add('active');});
  tl.addEventListener('mouseup',()=>{end.style.top='';end.classList.remove('active');});
}
function isContinuous(){return settings.scrollMode==='continuous';}
function isDouble(){return settings.pageLayout==='double';}
async function buildPages(){
  if(!pdfDoc)return;clearPages();$('#empty-hint').style.display='none';
  if(!estH){try{estH=(await pdfDoc.getPage(page)).getViewport({scale}).height;}catch(e){estH=800;}}
  const box=$('#pages');const cont=isContinuous(),dbl=isDouble();
  if(cont){
    if(dbl){
      // 连续 + 双页：整本按「两页一对」纵向排开，可上下滚动；可见的对才渲染
      for(let i=1;i<=total;i+=2){const sp=document.createElement('div');sp.className='spread';
        sp.appendChild(makePageEl(i));if(i+1<=total)sp.appendChild(makePageEl(i+1));box.appendChild(sp);}
    }else{
      for(let i=1;i<=total;i++)box.appendChild(makePageEl(i));
    }
    io=new IntersectionObserver(es=>{es.forEach(en=>{if(en.isIntersecting)renderPageEl(+en.target.dataset.page);});},{root:$('#viewer'),rootMargin:'700px 0px'});
    Object.values(pageEls).forEach(pe=>io.observe(pe.wrap));
    updatePageInfo();renderAnnotations();setTimeout(()=>scrollToPage(page,false),60);
  }else if(dbl){
    // 固定 + 双页：一次显示一对（左=当前页，右=下一页）
    const left=page,right=page+1;
    const spread=document.createElement('div');spread.className='spread';
    spread.appendChild(makePageEl(left));
    if(right<=total)spread.appendChild(makePageEl(right));
    box.appendChild(spread);
    await renderPageEl(left);if(right<=total)await renderPageEl(right);
    $('#viewer').scrollTop=0;updatePageInfo();renderAnnotations();
  }else{
    // 固定 + 单页
    box.appendChild(makePageEl(page));await renderPageEl(page);$('#viewer').scrollTop=0;updatePageInfo();renderAnnotations();
  }
}
function scrollToPage(p,smooth){const pe=pageEls[p];if(pe)pe.wrap.scrollIntoView({behavior:smooth?'smooth':'auto',block:'start'});}
function updatePageInfo(){
  let label=page+' / '+total;
  if(isDouble()){const r=Math.min(page+1,total);label=(r>page?(page+'–'+r):(''+page))+' / '+total;}
  $('#pageinfo').textContent=label;$('#progbar').style.width=Math.round((page/total)*100)+'%';$('#jump').value=page;saveProgress();}
function pageStep(){return isDouble()?2:1;}
function gotoPage(p){if(p<1)p=1;if(p>total)p=total;page=p;
  if(isContinuous()){scrollToPage(p,false);renderPageEl(p);updatePageInfo();}
  else{buildPages();}}
async function rerender(){estH=0;await buildPages();}

/* ===== 自动适配页面 + 触摸板缩放（#7） =====
   · 适配宽度：整页横向铺满阅读区，上下滚动看——字号最稳，默认。
   · 整页：整页完整塞进窗口；若会小到看不清，自动退回适配宽度，保证可读。
   · 触摸板双指捏合 / Ctrl+滚轮：自由缩放（自动切到「自由」模式）。
   · 窗口大小、显示屏变化时，自动重新适配，保证每页都完整且字不过小。 */
let _fitT=null,_zoomT=null;
function fitLabel(){const m=settings.fitMode;return m==='page'?'⤢ 整页':m==='width'?'⤢ 适配宽':'⤢ 自由';}
function updateFitBtn(){const b=$('#fit-btn');if(!b)return;b.textContent=fitLabel();
  b.classList.toggle('on',settings.fitMode!=='off');
  b.title=settings.fitMode==='off'?'当前为自由缩放——点此自动适配（Ctrl 0 或 F）':'自动适配中——点此切换 适配宽度 / 整页 / 自由（Ctrl 0 或 F）';}
function viewerUsable(){const v=$('#viewer');if(!v)return{w:800,h:600};
  const cs=getComputedStyle(v);
  const padX=(parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0);
  const padY=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0);
  return{w:Math.max(120,v.clientWidth-padX-2),h:Math.max(120,v.clientHeight-padY-2)};}
async function computeFitScale(){
  if(!pdfDoc)return scale;
  let vp1;try{vp1=(await pdfDoc.getPage(page)).getViewport({scale:1});}catch(e){return scale;}
  const u=viewerUsable();let availW=u.w;
  if(isDouble())availW=(u.w-24)/2;     // 两页并排 + 间距
  let s=availW/vp1.width;
  if(settings.fitMode==='page'){
    s=Math.min(s,u.h/vp1.height);
    if(s<0.62)s=availW/vp1.width;   // 整页会太小看不清时退回适配宽度，优先保证字号
  }
  return Math.max(0.5,Math.min(4,s));
}
async function applyFit(force){
  if(!pdfDoc)return;
  if(settings.fitMode==='off'&&!force)return;
  if(settings.fitMode==='off'){updateFitBtn();return;}
  const s=await computeFitScale();
  if(Math.abs(s-scale)>0.004){scale=s;await rerender();}
  updateFitBtn();
}
function setScaleManual(v){
  scale=Math.max(0.4,Math.min(6,v));
  settings.fitMode='off';saveSettings();updateFitBtn();
  clearTimeout(_zoomT);_zoomT=setTimeout(()=>{rerender();},140);   // 连续缩放合并为一次重排
}
function cycleFit(){
  const order=['width','page','off'];
  settings.fitMode=order[(order.indexOf(settings.fitMode)+1)%order.length];
  saveSettings();updateFitBtn();
  if(settings.fitMode!=='off')applyFit(true);
}
function scheduleFitOnResize(){if(settings.fitMode==='off')return;clearTimeout(_fitT);_fitT=setTimeout(()=>applyFit(true),160);}
function onViewerScroll(){
  if(!isContinuous()||!pdfDoc)return;
  const vt=$('#viewer').getBoundingClientRect().top;let best=page,bd=1e9;
  Object.keys(pageEls).forEach(k=>{const r=pageEls[k].wrap.getBoundingClientRect();const d=Math.abs(r.top-vt-60);if(r.bottom>vt+40&&d<bd){bd=d;best=+k;}});
  if(best!==page){page=best;updatePageInfo();}
}
let progT;function saveProgress(){if(!book)return;clearTimeout(progT);progT=setTimeout(()=>{jpost('/api/progress',{id:book.id,page:page-1}).then(loadLibrary).catch(()=>{});},700);}

function aiPayload(extra){return Object.assign({provider:settings.engine,api_key:getKey(),model:curModel(),effort:curEffort(),base_url:curBaseURL(),glossary:settings.glossary},extra||{});}
async function runTranslate(){const text=$('#tr-input').value.trim();if(!text){toast('没有文本');return;}$('#tr-out').textContent='翻译中…';
  const c=aiStart('tr');
  try{const d=await aipost('/api/translate',aiPayload({text,target:settings.target}),c.signal);setOut($('#tr-out'),d.result);}
  catch(e){$('#tr-out').textContent=isAbort(e)?'已停止。':'出错：'+e.message;}
  finally{aiEnd('tr');}}
function aiThinkEffort(){return settings.aiThink?'high':'none';}
function aiScope(){return ($('#ai-scope')&&$('#ai-scope').value)||'around';}
async function runExplainInChat(){
  const text=(qaCtx||'').trim();if(!text){toast('没有要解释的文字');return;}
  if(settings.engine==='免费'){toast('解释需要一个 AI 引擎（DeepSeek / OpenAI / Claude / Z.ai）');return;}
  const wait=document.createElement('div');wait.className='bubble a';wait.textContent='';$('#qa-log').appendChild(wait);$('#qa-log').scrollTop=$('#qa-log').scrollHeight;
  let ans='';const c=aiStart('qa');
  try{await streamPost('/api/explain_stream',aiPayload({text,book_id:book?book.id:null,page:page,ctx_scope:aiScope(),page_range:($('#ai-range')?$('#ai-range').value.trim():''),effort:aiThinkEffort()}),d=>{ans+=d;setOut(wait,ans);$('#qa-log').scrollTop=$('#qa-log').scrollHeight;},c.signal);qaHist.push({role:'assistant',content:ans});renderQA();}
  catch(e){if(isAbort(e)){if(ans)qaHist.push({role:'assistant',content:ans});renderQA();toast('已停止');}else{wait.textContent='出错：'+e.message;}}
  finally{aiEnd('qa');}}

let highlightsCache=[];
let lastSelectionInfo={page:1,rects:[]};
function selectionHighlightInfo(){
  const sel=window.getSelection();if(!sel||!sel.rangeCount)return {page:page,rects:[]};
  const range=sel.getRangeAt(0);let node=sel.anchorNode;
  const el=(node&&node.nodeType===3)?node.parentElement:node;
  let pw=el&&el.closest?el.closest('.page-wrap'):null;
  if(!pw){pw=document.elementFromPoint(range.getBoundingClientRect().left,range.getBoundingClientRect().top)?.closest?.('.page-wrap');}
  if(!pw)return {page:page,rects:[]};
  const pr=pw.getBoundingClientRect();const rects=[];
  Array.from(range.getClientRects()).forEach(r=>{
    const ix=Math.max(r.left,pr.left),iy=Math.max(r.top,pr.top),ax=Math.min(r.right,pr.right),ay=Math.min(r.bottom,pr.bottom);
    if(ax-ix>2&&ay-iy>2){rects.push([(ix-pr.left)/pr.width,(iy-pr.top)/pr.height,(ax-ix)/pr.width,(ay-iy)/pr.height]);}
  });
  return {page:+pw.dataset.page,rects};
}
async function addHighlight(){const current=selText();const s=current||lastSel;if(!s){toast('请先在 PDF 或“原文”窗口选中文字');return;}if(!book){toast('请先打开一本书');return;}
  let info=current?selectionHighlightInfo():lastSelectionInfo;
  if(!info||!info.rects)info={page:page,rects:[]};
  const pg=info.page||page;
  await jpost('/api/highlights',{book_id:book.id,page:pg,text:s,color:settings.hlColor,rects:info.rects});
  await loadHighlights();toast('已添加'+(info.rects&&info.rects.length?'荧光标注':'文字重点')+'（第 '+plabel(pg)+' 页）');}
async function deleteHighlight(h){if(!h)return;await jpost('/api/highlights/delete',{id:h.id,book_id:book.id,text:h.text,time:h.time});await loadHighlights();toast('已删除标注');}
function renderAnnotations(){
  document.querySelectorAll('.anno-layer').forEach(l=>l.innerHTML='');
  if(!book||!highlightsCache.length)return;
  highlightsCache.forEach(h=>{if(!h.rects||!h.rects.length)return;const pe=pageEls[h.page];if(!pe||!pe.ann)return;
    h.rects.forEach(r=>{if(!r||r.length<4)return;const d=document.createElement('div');d.className='hl-rect';d.style.left=(r[0]*100)+'%';d.style.top=(r[1]*100)+'%';d.style.width=(r[2]*100)+'%';d.style.height=(r[3]*100)+'%';d.style.background=colorCss(h.color||'yellow');d.title='点击删除：'+(h.text||'标注').slice(0,80);d.onclick=e=>{if(settings.toolMode==='eraser'){e.stopPropagation();deleteHighlight(h);}};pe.ann.appendChild(d);});
  });
}
async function loadHighlights(){if(!book)return;const hs=await api('/api/highlights/'+encodeURIComponent(book.id));hs.sort((a,b)=>a.page-b.page);
  highlightsCache=hs;renderAnnotations();
  const box=$('#nb-hls');box.innerHTML='';if(!hs.length)box.innerHTML='<div class="hint">还没有重点。</div>';
  hs.forEach(h=>{const el=document.createElement('div');el.className='hl';
    const color='<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:'+colorCss(h.color||'yellow')+';margin-right:5px"></span>';
    el.innerHTML='<div class="hl-meta">'+color+'📌 第 '+plabel(h.page)+' 页 · '+(h.time||'')+(h.rects&&h.rects.length?' · 页面荧光':' · 文字重点')+'</div><div class="hl-text"></div><div class="hl-acts"><button class="mini tiny goto">跳转</button><button class="mini tiny ask">问 AI</button><button class="mini tiny del">删除</button></div>';
    el.querySelector('.hl-text').textContent=h.text;
    el.querySelector('.goto').onclick=()=>gotoPage(h.page);
    el.querySelector('.ask').onclick=()=>openQA(h.text);
    el.querySelector('.del').onclick=async()=>deleteHighlight(h);
    box.appendChild(el);});
  applyNbFont();}

let notesData=[],selNote=null,nbExpanded=new Set();
async function loadNotes(){if(!book)return;notesData=await api('/api/notes/'+encodeURIComponent(book.id));renderNotes();}
function updateCollapseAllBtn(){const b=$('#nb-collapse-all');if(!b)return;
  const anyOpen=notesData.some(n=>nbExpanded.has(n.id));
  b.textContent=anyOpen?'全部收起':'全部展开';
  b.onclick=()=>{if(anyOpen)nbExpanded.clear();else notesData.forEach(n=>nbExpanded.add(n.id));renderNotes();};}
function renderNotes(){
  const box=$('#nb-notes');if(!box)return;box.innerHTML='';
  if(!notesData.length){box.innerHTML='<div class="hint">还没有笔记，点"＋ 新建"。每条笔记都能单独收起 / 展开。</div>';updateCollapseAllBtn();return;}
  notesData.forEach(n=>{
    const open=nbExpanded.has(n.id);
    const card=document.createElement('div');card.className='note-card'+(open?' open':'');
    const head=document.createElement('div');head.className='nc-head';
    const caret=document.createElement('span');caret.className='nc-caret';caret.textContent='▶';
    const title=document.createElement('span');title.className='nc-title';title.textContent=n.title||'未命名';
    head.appendChild(caret);head.appendChild(title);
    if(!open){const pv=document.createElement('span');pv.className='nc-preview';pv.textContent=(n.body||'').replace(/\s+/g,' ').trim().slice(0,80)||'（空）';head.appendChild(pv);}
    head.onclick=()=>{if(nbExpanded.has(n.id))nbExpanded.delete(n.id);else nbExpanded.add(n.id);renderNotes();};
    card.appendChild(head);
    const body=document.createElement('div');body.className='nc-body';
    const ti=document.createElement('input');ti.value=n.title||'';ti.placeholder='笔记标题';
    const ta=document.createElement('textarea');ta.value=n.body||'';ta.placeholder='写下这条笔记的内容…';
    const acts=document.createElement('div');acts.className='win-row';
    const save=document.createElement('button');save.className='mini primary';save.textContent='保存';
    const ask=document.createElement('button');ask.className='mini';ask.textContent='问 AI';
    const del=document.createElement('button');del.className='mini';del.textContent='删除';
    const saved=document.createElement('span');saved.className='nc-saved';
    save.onclick=async()=>{if(!book)return;n.title=ti.value.trim()||'未命名';n.body=ta.value;
      title.textContent=n.title;
      try{await jpost('/api/notes/save',{book_id:book.id,note:n});saved.textContent='已保存 '+new Date().toLocaleTimeString().slice(0,5);}catch(e){saved.textContent='保存失败';}};
    ask.onclick=()=>{openQA(((ti.value||'')+'\n'+(ta.value||'')).trim());};
    del.onclick=async()=>{if(!book)return;await jpost('/api/notes/delete',{book_id:book.id,id:n.id});nbExpanded.delete(n.id);await loadNotes();toast('已删除');};
    acts.appendChild(save);acts.appendChild(ask);acts.appendChild(del);acts.appendChild(saved);
    body.appendChild(ti);body.appendChild(ta);body.appendChild(acts);
    card.appendChild(body);box.appendChild(card);
  });
  applyNbFont();updateCollapseAllBtn();
}
async function newNote(){if(!book){toast('请先打开一本书');return;}
  const n={id:'n'+Date.now(),title:'笔记 '+(notesData.length+1),body:''};
  try{await jpost('/api/notes/save',{book_id:book.id,note:n});}catch(e){}
  nbExpanded.add(n.id);await loadNotes();
  const cards=$('#nb-notes').querySelectorAll('.note-card');const last=cards[cards.length-1];
  if(last){const inp=last.querySelector('input');if(inp){inp.focus();inp.select();}}
}
function applyNbFont(){const fs=fontStack(settings.nbFont),sz=settings.nbSize+'px';
  ['#nb-hls','#nb-notes'].forEach(s=>{const el=$(s);if(el){el.style.fontFamily=fs;el.style.fontSize=sz;}});
  document.querySelectorAll('#nb-notes textarea,#nb-notes .nc-title,#nb-notes .nc-preview').forEach(el=>{el.style.fontFamily=fs;el.style.fontSize=sz;});}

let qaCtx='',qaHist=[];
function openQA(ctx){qaCtx=ctx||'';qaHist=[];$('#qa-ctx').textContent=qaCtx||'（没有上下文，可直接提问）';renderQA();openWin('qa');}
function renderQA(){const box=$('#qa-log');box.innerHTML='';qaHist.forEach(m=>{const b=document.createElement('div');b.className='bubble '+(m.role==='user'?'u':'a');b.textContent=(m.role==='user'?m.content:cleanAI(m.content));box.appendChild(b);});box.scrollTop=box.scrollHeight;}
async function streamPost(path,payload,onDelta,signal){
  const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
  const ct=r.headers.get('content-type')||'';
  if(!r.ok){let msg='HTTP '+r.status;try{const j=ct.includes('json')?await r.json():null;if(j&&j.error)msg=j.error;}catch(e){}throw new Error(msg);}
  const reader=r.body.getReader();const decoder=new TextDecoder();let buf='';
  while(true){const {value,done}=await reader.read();if(done)break;buf+=decoder.decode(value,{stream:true});
    const parts=buf.split('\n\n');buf=parts.pop();
    for(const part of parts){const line=part.split('\n').find(x=>x.startsWith('data: '));if(!line)continue;const j=JSON.parse(line.slice(6));if(j.error)throw new Error(j.error);if(j.delta)onDelta(j.delta);}
  }
}
async function sendQA(){const q=$('#qa-input').value.trim();if(!q){return;}
  if(settings.engine==='免费'){toast('问答需要 AI 引擎，请切换到 DeepSeek、OpenAI、Claude 或 Z.ai');return;}
  qaHist.push({role:'user',content:q});renderQA();$('#qa-input').value='';
  const wait=document.createElement('div');wait.className='bubble a';wait.textContent='';$('#qa-log').appendChild(wait);
  const useRag=(aiScope()==='all');let ans='';const c=aiStart('qa');
  try{await streamPost('/api/ask_stream',aiPayload({context:qaCtx,history:qaHist.slice(0,-1),question:q,book_id:book?book.id:null,use_rag:useRag,effort:aiThinkEffort()}),d=>{ans+=d;setOut(wait,ans);$('#qa-log').scrollTop=$('#qa-log').scrollHeight;},c.signal);
    qaHist.push({role:'assistant',content:ans});renderQA();}
  catch(e){if(isAbort(e)){if(ans)qaHist.push({role:'assistant',content:ans});renderQA();toast('已停止');}else{wait.textContent='出错：'+e.message;}}
  finally{aiEnd('qa');}}

/* ===================== 人文社科精读 / 双视野 / 粘贴导入 ===================== */
async function fillBookPicker(sel,preferId){
  try{const lib=await api('/api/library');sel.innerHTML='';
    if(!lib.length){const o=document.createElement('option');o.value='';o.textContent='（文献库为空）';sel.appendChild(o);return;}
    const cur=preferId||(book?book.id:null);
    lib.forEach(b=>{const o=document.createElement('option');o.value=b.id;
      const tag=b.kind==='snippet'?'　·片段':b.kind==='text'?'　·文本':'';
      o.textContent=b.name+tag;if(b.id===cur)o.selected=true;sel.appendChild(o);});
  }catch(e){sel.innerHTML='<option value="">读取失败</option>';}
}
function humScope(){const r=document.querySelector('input[name="hum-scope"]:checked');return r?r.value:'all';}
function humTarget(){const v=$('#hum-target').value;return v||(book?book.id:null);}
function humBase(){return aiPayload({book_id:humTarget(),scope:humScope(),page:page,page_range:$('#hum-range').value.trim(),perspective:$('#hum-persp').value.trim()});}

let _humWired=false;
async function humInit(){
  await fillBookPicker($('#hum-target'));
  if(_humWired)return;_humWired=true;
  $('#win-hum').querySelectorAll('.hum-tab').forEach(t=>t.onclick=()=>{
    $('#win-hum').querySelectorAll('.hum-tab').forEach(x=>x.classList.remove('on'));
    $('#win-hum').querySelectorAll('.hum-panel').forEach(x=>x.classList.remove('on'));
    t.classList.add('on');const p=$('#win-hum').querySelector('.hum-panel[data-panel="'+t.dataset.tab+'"]');if(p)p.classList.add('on');
  });
  $('#hum-run-framework').onclick=()=>runHum('framework');
  $('#hum-run-critique').onclick=()=>runHum('critique');
  $('#hum-run-dual').onclick=()=>runHum('dual');
  $('#lnk-notes').onclick=runLnkNotes;
  $('#lnk-evid').onclick=runLnkEvid;
}
async function runHum(kind){
  if(!humTarget()){toast('请先在上方选择一篇文献/文本');return;}
  if(settings.engine==='免费'){toast('该功能需要一个 AI 引擎（DeepSeek / OpenAI / Claude / Z.ai）');return;}
  const ep=kind==='framework'?'/api/hum/framework_stream':kind==='critique'?'/api/hum/critique_stream':'/api/hum/dual_horizon_stream';
  const out=$('#hum-out'),st=$('#hum-status');out.textContent='';out.classList.toggle('dual-mode',kind==='dual');
  st.textContent=kind==='critique'?'正在做深度阅读（思辨整篇）……长文较慢，请稍候。':kind==='dual'?'正在做视野对照（中文／外文）……':'正在做客观分析……';
  const c=aiStart('hum');let acc='';
  try{await streamPost(ep,humBase(),d=>{acc+=d;if(kind==='dual')renderDualOut(out,acc);else setOut(out,acc);},c.signal);st.textContent='完成。';}
  catch(e){if(isAbort(e)){st.textContent='已停止。';if(kind==='dual')renderDualOut(out,acc);else out.textContent=cleanAI(acc)||'已停止。';}else{st.textContent='出错：'+e.message;}}
  finally{aiEnd('hum');}
}
async function runLnkNotes(){
  if(!humTarget()){toast('请先选择当前阅读对象');return;}
  if(settings.engine==='免费'){toast('该功能需要一个 AI 引擎');return;}
  const out=$('#lnk-out'),st=$('#lnk-status');out.textContent='';st.textContent='正在按当前阅读检索你的笔记……';
  const c=aiStart('lnk');let acc='';
  try{await streamPost('/api/links/notes_from_reading_stream',aiPayload({book_id:humTarget(),scope:humScope(),page:page,page_range:$('#hum-range').value.trim()}),d=>{acc+=d;setOut(out,acc);},c.signal);st.textContent='完成。';}
  catch(e){if(isAbort(e)){st.textContent='已停止。';out.textContent=cleanAI(acc)||'已停止。';}else{st.textContent='出错：'+e.message;}}
  finally{aiEnd('lnk');}
}
async function runLnkEvid(){
  if(settings.engine==='免费'){toast('该功能需要一个 AI 引擎');return;}
  const out=$('#lnk-out'),st=$('#lnk-status');out.textContent='';st.textContent='正在按你的笔记检索文献库证据……';
  const c=aiStart('lnk');let acc='';
  try{await streamPost('/api/links/evidence_from_notes_stream',aiPayload({}),d=>{acc+=d;setOut(out,acc);},c.signal);st.textContent='完成。';}
  catch(e){if(isAbort(e)){st.textContent='已停止。';out.textContent=cleanAI(acc)||'已停止。';}else{st.textContent='出错：'+e.message;}}
  finally{aiEnd('lnk');}
}

/* —— 视野对照：中文 ｜ 外文 两栏 + 对照小结（解析后端 ## 小标题渲染）—— */
function renderDualOut(out,acc){
  const txt=cleanAI(acc);const HZ='## 中文视野',HF='## 外文视野',HS='## 对照小结';
  const iZ=txt.indexOf(HZ),iF=txt.indexOf(HF),iS=txt.indexOf(HS);
  if(iZ<0&&iF<0&&iS<0){out.textContent=txt;return;}
  const cut=(a,alen,b)=>txt.slice(a+alen,(b>=0?b:txt.length)).trim();
  const zh=iZ>=0?cut(iZ,HZ.length,(iF>=0?iF:iS)):'';
  const fo=iF>=0?cut(iF,HF.length,iS):'';
  const su=iS>=0?txt.slice(iS+HS.length).trim():'';
  const mk=(title,body)=>{const col=document.createElement('div');col.className='dual-col';const h=document.createElement('div');h.className='dual-h';h.textContent=title;const t=document.createElement('div');t.className='dual-t';t.textContent=body;col.appendChild(h);col.appendChild(t);return col;};
  out.innerHTML='';const row=document.createElement('div');row.className='dual-cols';
  row.appendChild(mk('中文视野',zh));row.appendChild(mk('外文视野（英·德·法）',fo));out.appendChild(row);
  if(su){const sm=mk('对照小结',su);sm.className='dual-sum';out.appendChild(sm);}
}

/* —— 书架·粘贴导入观点/文本 —— */
async function savePaste(){
  const text=$('#paste-text').value.trim();if(!text){toast('请先粘贴文字');return;}
  const name=$('#paste-name').value.trim();const kind=$('#paste-snippet').checked?'snippet':'text';
  toast('正在存入文献库…');
  try{const b=await jpost('/api/lib/add_text',{name,text,kind});await loadLibrary();
    $('#paste-text').value='';$('#paste-name').value='';$('#paste-snippet').checked=false;$('#paste-box').open=false;
    toast('已存入文献库：'+b.name);}
  catch(e){toast('保存失败：'+e.message);}
}



async function buildRagIndex(){if(!book){toast('请先打开一篇 PDF');return;}const st=$('#sum-status');if(st)st.textContent='正在构建语义索引…长 PDF 可能需要一会儿';
  const c=aiStart('sum');
  try{const d=await jpost('/api/build_rag_index',aiPayload({book_id:book.id}),c.signal);const msg='语义索引完成：'+d.count+' 段，方式：'+(d.meta&&d.meta.kind==='remote'?'远程 embeddings':'本地轻量向量')+'，时间：'+d.built;if(st)st.textContent=msg;toast(msg);}catch(e){if(isAbort(e)){if(st)st.textContent='已停止。';}else{if(st)st.textContent='索引失败：'+e.message;toast('索引失败：'+e.message);}}finally{aiEnd('sum');}}

// ----- 框选 OCR -----
let ocrMode=false;
function setOcr(on){ocrMode=on;$('#open-ocr').classList.toggle('on',on);document.querySelectorAll('.ocr-layer').forEach(l=>l.classList.toggle('on',on));}
function attachOcr(ocr,canvas,num){
  ocr.addEventListener('mousedown',e=>{e.preventDefault();const r=ocr.getBoundingClientRect();
    const sx=e.clientX-r.left,sy=e.clientY-r.top;
    const box=document.createElement('div');box.className='ocr-box';box.style.left=sx+'px';box.style.top=sy+'px';ocr.appendChild(box);
    function mv(ev){const x=ev.clientX-r.left,y=ev.clientY-r.top;box.style.left=Math.min(sx,x)+'px';box.style.top=Math.min(sy,y)+'px';box.style.width=Math.abs(x-sx)+'px';box.style.height=Math.abs(y-sy)+'px';}
    function up(ev){document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);
      const x=ev.clientX-r.left,y=ev.clientY-r.top;const bx=Math.min(sx,x),by=Math.min(sy,y),bw=Math.abs(x-sx),bh=Math.abs(y-sy);
      box.remove();setOcr(false);if(bw>8&&bh>8){page=num;updatePageInfo();captureOCR(canvas,bx,by,bw,bh);}}
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);});
}
let lastOcrImage=null;
async function captureOCR(cv,bx,by,bw,bh){
  const ratio=window.devicePixelRatio||1;
  const tmp=document.createElement('canvas');tmp.width=Math.round(bw*ratio);tmp.height=Math.round(bh*ratio);
  tmp.getContext('2d').drawImage(cv,Math.round(bx*ratio),Math.round(by*ratio),Math.round(bw*ratio),Math.round(bh*ratio),0,0,Math.round(bw*ratio),Math.round(bh*ratio));
  let dataURL;try{dataURL=tmp.toDataURL('image/png');}catch(e){toast('截图失败');return;}
  lastOcrImage=dataURL;
  openWin('ocr');
  await runOcrTask();
}
async function runOcrTask(){
  if(!lastOcrImage){toast('请先在页面上框选一块区域');return;}
  const task=($('#ocr-task')&&$('#ocr-task').value)||'text';
  $('#ocr-text').value='识别中…（首次可能较慢）';
  const c=aiStart('ocr');
  try{const d=await aipost('/api/ocr',aiPayload({image:lastOcrImage,task:task}),c.signal);$('#ocr-text').value=d.result;lastSel=d.result;}
  catch(e){$('#ocr-text').value=isAbort(e)?'已停止。':'出错：'+e.message;}
  finally{aiEnd('ocr');}
}

// ----- 数据图表 -----

async function exportDoc(fmt){if(!book){toast('请先打开一本书');return;}toast('正在生成…');
  try{const r=await fetch('/api/export/'+encodeURIComponent(book.id)+'?fmt='+fmt);const ct=r.headers.get('content-type')||'';
    if(ct.includes('json')){const j=await r.json();toast(j.error||'导出失败');return;}
    const blob=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=book.name+(fmt==='docx'?'.docx':'.pdf');a.click();}catch(e){toast('导出失败：'+e.message);}}

async function exportAnnotatedPDF(){if(!book){toast('请先打开一本书');return;}toast('正在生成带标注 PDF…');
  try{const r=await fetch('/api/highlights/export_pdf/'+encodeURIComponent(book.id));const ct=r.headers.get('content-type')||'';
    if(ct.includes('json')){const j=await r.json();toast(j.error||'导出失败');return;}
    const blob=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=book.name.replace(/\.pdf$/i,'')+'_annotated.pdf';a.click();}
  catch(e){toast('导出失败：'+e.message);}}

let zc=40;function bringFront(w){w.style.zIndex=(++zc);}
function updateDock(){
  const t=$('#win-translate'),q=$('#win-qa');
  const tv=!!(t&&t.style.display!=='none'),qv=!!(q&&q.style.display!=='none');
  const on=tv||qv;
  document.body.classList.toggle('dock-on',on);
  document.body.classList.toggle('dock-split-on',tv&&qv);  // 两个都开时才显示中间的可拖分隔条
  if(!on)document.body.classList.remove('dock-collapsed');
  scheduleFitOnResize();
}
function setupDock(){
  if(window.innerWidth<820)return;            // 窄屏不启用工具坞，翻译/AI解读仍为浮窗
  const dock=$('#dock');if(!dock)return;
  const tw=$('#win-translate'),qw=$('#win-qa');
  // 顺序：翻译 → 分隔条 → AI解读
  if(tw){tw.classList.add('docked');tw.style.cssText='display:none';dock.appendChild(tw);}
  const sp=document.createElement('div');sp.id='dock-split';sp.title='上下拖动可自由调节两个面板的高度';dock.appendChild(sp);
  if(qw){qw.classList.add('docked');qw.style.cssText='display:none';dock.appendChild(qw);}
  const dw=parseFloat(localStorage.getItem('rw_dockw')||'');
  if(dw)document.documentElement.style.setProperty('--dock-w',dw+'px');
  const toph=localStorage.getItem('rw_docktoph');
  if(toph)document.documentElement.style.setProperty('--dock-top-h',toph);
  const rz=$('#dock-resize');
  if(rz)rz.addEventListener('mousedown',e=>{e.preventDefault();const sx=e.clientX,sw=dock.offsetWidth;
    function mv(ev){let w=sw-(ev.clientX-sx);w=Math.max(240,Math.min(w,Math.round(window.innerWidth*0.6)));document.documentElement.style.setProperty('--dock-w',w+'px');}
    function up(){document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);localStorage.setItem('rw_dockw',dock.offsetWidth);scheduleFitOnResize();}
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);});
  // 中间分隔条：上下拖动改变上面板（翻译）的高度，下面板（AI解读）自动占其余
  sp.addEventListener('mousedown',e=>{e.preventDefault();
    const dr=dock.getBoundingClientRect();const barH=($('#dock-bar')?$('#dock-bar').offsetHeight:0);const avail=dr.height-barH;
    function mv(ev){let top=ev.clientY-dr.top-barH;top=Math.max(110,Math.min(top,avail-110));document.documentElement.style.setProperty('--dock-top-h',top+'px');}
    function up(){document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);
      const v=getComputedStyle(document.documentElement).getPropertyValue('--dock-top-h').trim();if(v)localStorage.setItem('rw_docktoph',v);}
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);});
  const cb=$('#dock-collapse'),ro=$('#dock-reopen');
  if(cb)cb.onclick=()=>{document.body.classList.add('dock-collapsed');scheduleFitOnResize();};
  if(ro)ro.onclick=()=>{document.body.classList.remove('dock-collapsed');scheduleFitOnResize();};
}
function openWin(id){const w=$('#win-'+id);
  if(w.classList.contains('docked')){w.style.display='flex';document.body.classList.remove('dock-collapsed');updateDock();return;}
  restoreGeom(id);w.style.display='flex';bringFront(w);clampWin(w);if(id==='notebook'){loadHighlights();loadNotes();applyNbFont();}if(id==='aicollection'){loadAIC();}if(id==='hum'){humInit();}}
function closeWin(id){const w=$('#win-'+id);w.style.display='none';if(w.classList.contains('docked'))updateDock();}
function winVisible(id){const w=$('#win-'+id);if(!w)return false;
  if(w.style.display==='none'||w.style.display==='')return false;
  if(w.classList.contains('docked'))return document.body.classList.contains('dock-on')&&!document.body.classList.contains('dock-collapsed');
  return true;}
function toggleWin(id){winVisible(id)?closeWin(id):openWin(id);}   // 菜单项：点一下开、再点一下关
function saveGeom(id){const w=$('#win-'+id);const g=JSON.parse(localStorage.getItem('rw_geom')||'{}');g[id]={left:w.style.left,top:w.style.top,width:w.style.width,height:w.style.height};localStorage.setItem('rw_geom',JSON.stringify(g));}
function restoreGeom(id){const g=(JSON.parse(localStorage.getItem('rw_geom')||'{}'))[id];if(!g)return;const w=$('#win-'+id);if(g.left){w.style.left=g.left;w.style.right='auto';}if(g.top)w.style.top=g.top;if(g.width)w.style.width=g.width;if(g.height)w.style.height=g.height;}
function addResize(w){const dirs=['n','s','e','w','ne','nw','se','sw'];const id=w.id.replace('win-','');
  dirs.forEach(dir=>{const h=document.createElement('div');h.className='rsz rsz-'+dir;w.appendChild(h);
    h.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();bringFront(w);
      const r=w.getBoundingClientRect();const sx=e.clientX,sy=e.clientY,sw=r.width,sh=r.height,sl=r.left,stp=r.top;w.style.right='auto';
      function mv(ev){const dx=ev.clientX-sx,dy=ev.clientY-sy;let nw=sw,nh=sh,nl=sl,nt=stp;
        if(dir.indexOf('e')>=0)nw=Math.max(240,sw+dx);
        if(dir.indexOf('s')>=0)nh=Math.max(160,sh+dy);
        if(dir.indexOf('w')>=0){nw=Math.max(240,sw-dx);nl=sl+(sw-nw);}
        if(dir.indexOf('n')>=0){nh=Math.max(160,sh-dy);nt=Math.max(54,stp+(sh-nh));}
        w.style.width=nw+'px';w.style.height=nh+'px';w.style.left=nl+'px';w.style.top=nt+'px';}
      function up(){document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);saveGeom(id);}
      document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);});});}


function updateChromeLayout(){
  const top=$('#topbar');
  if(!top)return;
  const h=Math.ceil(top.getBoundingClientRect().height||52);
  document.documentElement.style.setProperty('--topbar-h',h+'px');
}
function topbarH(){const t=$('#topbar');return Math.ceil((t&&t.getBoundingClientRect().height)||52);}
// 把浮动工具窗拉回可视区：先把尺寸限制在视口内，再把位置约束进屏幕，避免换电脑/缩小窗口后窗口跑到屏幕外。
function clampWin(w){
  if(!w||w.style.display==='none')return;
  const vw=window.innerWidth,vh=window.innerHeight,topMin=topbarH()+6;
  let ww=Math.min(w.offsetWidth,vw-16);
  let wh=Math.min(w.offsetHeight,vh-topMin-10);
  if(ww>0)w.style.width=ww+'px';
  if(wh>0)w.style.height=wh+'px';
  let left=parseFloat(w.style.left),top=parseFloat(w.style.top);
  const r=w.getBoundingClientRect();
  if(isNaN(left))left=r.left;
  if(isNaN(top))top=r.top;
  left=Math.max(8,Math.min(left,Math.max(8,vw-ww-8)));
  top=Math.max(topMin,Math.min(top,Math.max(topMin,vh-wh-8)));
  w.style.left=left+'px';w.style.right='auto';w.style.top=top+'px';
}
function clampAllWins(){document.querySelectorAll('.window').forEach(w=>{if(w.classList.contains('docked'))return;if(w.style.display!=='none')clampWin(w);});}
window.addEventListener('resize',()=>{updateChromeLayout();clampAllWins();scheduleFitOnResize();});
// 顶部工具栏因长标题/按钮换行而高度变化时，自动重排内容区（不依赖窗口缩放事件即可触发）。
if(window.ResizeObserver){try{new ResizeObserver(()=>updateChromeLayout()).observe($('#topbar'));}catch(e){}}

window.addEventListener('DOMContentLoaded',async()=>{
  updateChromeLayout();setTimeout(updateChromeLayout,80);
  pdfjsLib.GlobalWorkerOptions.workerSrc=(window.__PDF_WORKER__||'/lib/pdf.worker.min.js');
  function updateViewSegs(){
    document.querySelectorAll('#seg-scroll [data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===settings.scrollMode));
    document.querySelectorAll('#seg-layout [data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===settings.pageLayout));
  }
  async function applyViewChange(){
    saveSettings();updateViewSegs();estH=0;
    if(pdfDoc){if(settings.fitMode!=='off'){try{scale=await computeFitScale();}catch(e){}}buildPages();updateFitBtn();}
  }
  document.querySelectorAll('#seg-scroll [data-v]').forEach(b=>b.onclick=()=>{if(settings.scrollMode!==b.dataset.v){settings.scrollMode=b.dataset.v;applyViewChange();}});
  document.querySelectorAll('#seg-layout [data-v]').forEach(b=>b.onclick=()=>{if(settings.pageLayout!==b.dataset.v){settings.pageLayout=b.dataset.v;applyViewChange();}});
  function updateAiThink(){const b=$('#ai-think');if(b){b.textContent='思考：'+(settings.aiThink?'开':'关');b.classList.toggle('primary',!!settings.aiThink);}}
  updateViewSegs();updateAiThink();applyReaderBg();setToolMode(settings.toolMode);
  if($('#ai-think'))$('#ai-think').onclick=()=>{settings.aiThink=!settings.aiThink;saveSettings();updateAiThink();};
  if($('#ai-explain'))$('#ai-explain').onclick=runExplainInChat;
  if($('#ai-scope'))$('#ai-scope').onchange=()=>{const r=$('#ai-range');if(r)r.style.display=($('#ai-scope').value==='range')?'':'none';};
  $('#set-engine').value=settings.engine;$('#set-target').value=settings.target;$('#set-key').value=getKey();
  $('#set-dsmodel').value=settings.dsModel;$('#set-oaimodel').value=settings.oaModel;$('#set-oai-effort').value=settings.oaEffort;
  $('#set-claudemodel').value=settings.claudeModel;$('#set-claude-effort').value=settings.claudeEffort;
  $('#set-zaimodel').value=settings.zaiModel;$('#set-qwenmodel').value=settings.qwenModel;$('#set-kimimodel').value=settings.kimiModel;$('#set-custom-base').value=settings.customBase;$('#set-custom-model').value=settings.customModel;
  $('#nb-font').value=settings.nbFont;$('#nb-size').value=settings.nbSize;
  $('#set-bg').value=settings.readerBg;$('#set-bg-custom').value=settings.readerBgCustom;$('#hl-color').value=settings.hlColor;renderTerms();
  function engVis(){
    $('#key-wrap').style.display=settings.engine==='免费'?'none':'block';
    $('#dsmodel-wrap').style.display=settings.engine==='DeepSeek'?'block':'none';
    $('#oaimodel-wrap').style.display=settings.engine==='OpenAI'?'block':'none';
    $('#claudemodel-wrap').style.display=settings.engine==='Claude'?'block':'none';
    $('#zaimodel-wrap').style.display=settings.engine==='ZAI'?'block':'none';
    $('#qwenmodel-wrap').style.display=settings.engine==='Qwen'?'block':'none';
    $('#kimimodel-wrap').style.display=settings.engine==='Kimi'?'block':'none';
    $('#custom-wrap').style.display=settings.engine==='CustomOpenAI'?'block':'none';
  }engVis();
  $('#set-engine').onchange=e=>{settings.engine=e.target.value;saveSettings();$('#set-key').value=getKey();engVis();};
  $('#set-dsmodel').onchange=e=>{settings.dsModel=e.target.value;saveSettings();};
  $('#set-oaimodel').onchange=e=>{settings.oaModel=e.target.value;saveSettings();};
  $('#set-oai-effort').onchange=e=>{settings.oaEffort=e.target.value;saveSettings();};
  $('#set-claudemodel').onchange=e=>{settings.claudeModel=e.target.value;saveSettings();};
  $('#set-claude-effort').onchange=e=>{settings.claudeEffort=e.target.value;saveSettings();};
  $('#set-zaimodel').onchange=e=>{settings.zaiModel=e.target.value;saveSettings();};
  $('#set-qwenmodel').onchange=e=>{settings.qwenModel=e.target.value;saveSettings();};
  $('#set-kimimodel').onchange=e=>{settings.kimiModel=e.target.value;saveSettings();};
  $('#set-custom-base').oninput=e=>{settings.customBase=e.target.value.trim().replace(/\/$/,'');saveSettings();};
  $('#set-custom-model').oninput=e=>{settings.customModel=e.target.value.trim();saveSettings();};
  $('#set-key').oninput=e=>{settings.keys[settings.engine]=e.target.value;saveSettings();};
  $('#set-target').onchange=e=>{settings.target=e.target.value;saveSettings();};
  $('#set-term-add').onclick=addTerm;
  $('#set-term-zh').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addTerm();}});
  $('#set-term-foreign').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#set-term-zh').focus();}});
  $('#set-bg').onchange=e=>{settings.readerBg=e.target.value;saveSettings();applyReaderBg();};
  $('#set-bg-custom').oninput=e=>{settings.readerBgCustom=e.target.value;settings.readerBg='custom';$('#set-bg').value='custom';saveSettings();applyReaderBg();};
  $('#hl-color').onchange=e=>{settings.hlColor=e.target.value;saveSettings();};
  $('#menu-btn').onclick=()=>$('#shelf').classList.toggle('open');
  // 书架 / 设置 折叠
  document.querySelectorAll('.sec-h').forEach(h=>{h.onclick=()=>{const sec=$('#shelf-'+h.dataset.sec);h.classList.toggle('collapsed');if(sec)sec.classList.toggle('collapsed');};});
  // AI 内容集合：右下角入口 + 查看/修改/删除/复制
  $('#aic-fab').onclick=()=>{openWin('aicollection');loadAIC();};
  $('#aic-save-edit').onclick=aicSaveEdit;$('#aic-del').onclick=aicDelete;
  $('#aic-copy').onclick=()=>{const t=$('#aic-content').value||'';if(navigator.clipboard){navigator.clipboard.writeText(t).then(()=>toast('已复制')).catch(()=>toast('复制失败，可手动选择复制'));}else{toast('复制失败，可手动选择复制');}};
  loadAIC();
  // 「停止」按钮：中止对应功能的本次 AI 生成
  [['tr-stop','tr'],['ex-stop','ex'],['qa-stop','qa'],['ocr-stop','ocr'],['hum-stop','hum'],['lnk-stop','lnk']].forEach(p=>{const b=$('#'+p[0]);if(b)b.onclick=()=>stopAI(p[1]);});
  // 「保存」按钮：把该功能的输出存入 AI 内容集合
  const _T=s=>{const el=$(s);return el?(el.innerText||el.textContent||''):'';};
  function bindSave(id,cat,getText,getTitle){const b=$('#'+id);if(b)b.onclick=()=>saveToCollection(cat,(getTitle?getTitle():''),getText());}
  bindSave('tr-save','翻译',()=>_T('#tr-out'),()=>($('#tr-input').value||'').slice(0,40));
  bindSave('qa-save','问答',()=>{const a=[...qaHist].reverse().find(m=>m.role==='assistant');return a?a.content:_T('#qa-log');},()=>{const u=[...qaHist].reverse().find(m=>m.role==='user');return u?u.content.slice(0,40):'';});
  bindSave('ocr-save','OCR',()=>($('#ocr-text').value||''));
  bindSave('hum-save','人文社科精读',()=>_T('#hum-out'));
  bindSave('lnk-save','笔记关联',()=>_T('#lnk-out'));
  $('#file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;const fd=new FormData();fd.append('file',f);toast('正在导入…');try{const b=await api('/api/upload',{method:'POST',body:fd});await loadLibrary();openBook(b);}catch(err){toast('导入失败：'+err.message);}e.target.value='';});
  $('#url-go').onclick=async()=>{const u=$('#url-input').value.trim();if(!u){toast('请先粘贴网址');return;}toast('正在抓取网页…可能要十几秒');try{const b=await jpost('/api/fetch_url',{url:u});await loadLibrary();openBook(b);$('#url-input').value='';toast('已生成并加入书架');}catch(e){toast('失败：'+e.message);}};
  $('#prev').onclick=()=>gotoPage(page-pageStep());$('#next').onclick=()=>gotoPage(page+pageStep());
  $('#jump').onchange=e=>{let v=parseInt(e.target.value);if(v>=1&&v<=total)gotoPage(v);};
  $('#zin').onclick=()=>setScaleManual(scale+0.15);
  $('#zout').onclick=()=>setScaleManual(scale-0.15);
  $('#fit-btn').onclick=cycleFit;updateFitBtn();
  // 触摸板双指捏合 / Ctrl+滚轮 = 自由缩放（浏览器与 WebView 会把捏合手势报告为 ctrlKey 的 wheel 事件）
  $('#viewer').addEventListener('wheel',e=>{
    if(e.ctrlKey){e.preventDefault();const f=e.deltaY<0?1.08:0.926;setScaleManual(scale*f);}
  },{passive:false});
  $('#hl-tool').onclick=()=>setToolMode(settings.toolMode==='highlight'?'select':'highlight');
  $('#eraser-tool').onclick=()=>setToolMode(settings.toolMode==='eraser'?'select':'eraser');
  $('#open-ocr').onclick=()=>setOcr(!ocrMode);
  $('#open-translate').onclick=()=>toggleWin('translate');$('#open-explain').onclick=()=>toggleWin('qa');
  $('#open-hum').onclick=()=>toggleWin('hum');$('#paste-save').onclick=savePaste;
  $('#open-notebook').onclick=()=>toggleWin('notebook');
  setupDock();
  document.querySelectorAll('.win-close').forEach(b=>b.onclick=()=>closeWin(b.dataset.win));
  $('#tr-getsel').onclick=()=>{const s=lastSel||selText();if(s)$('#tr-input').value=s;};$('#tr-run').onclick=runTranslate;
  $('#qa-send').onclick=sendQA;$('#qa-clear').onclick=()=>{qaCtx='';$('#qa-ctx').textContent='（没有上下文，可直接提问）';};
  $('#qa-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();sendQA();}});
  $('#ocr-redo').onclick=()=>runOcrTask();
  $('#ocr-tr').onclick=()=>{const t=$('#ocr-text').value.trim();if(!t)return;openWin('translate');$('#tr-input').value=t;runTranslate();};
  $('#ocr-ex').onclick=()=>{const t=$('#ocr-text').value.trim();if(!t)return;openQA(t);runExplainInChat();};
  $('#ocr-hl').onclick=()=>{const t=$('#ocr-text').value.trim();if(!t||!book){toast('没有文本或未打开书');return;}jpost('/api/highlights',{book_id:book.id,page:page,text:t,color:settings.hlColor,rects:[]}).then(()=>{loadHighlights();toast('已划重点（第 '+plabel(page)+' 页）');});};
  $('#nb-word').onclick=()=>exportDoc('docx');$('#nb-pdf').onclick=()=>exportDoc('pdf');$('#nb-annotated-pdf').onclick=()=>exportAnnotatedPDF();
  $('#nb-newnote').onclick=newNote;
  $('#nb-font').onchange=e=>{settings.nbFont=e.target.value;saveSettings();applyNbFont();};
  $('#nb-size').oninput=e=>{settings.nbSize=+e.target.value;saveSettings();applyNbFont();};
  document.querySelectorAll('.window').forEach(w=>{if(w.classList.contains('docked'))return;addResize(w);const head=w.querySelector('.win-head');const id=w.id.replace('win-','');
    head.addEventListener('mousedown',e=>{if(e.target.classList.contains('win-close'))return;bringFront(w);const r=w.getBoundingClientRect();const ox=e.clientX-r.left,oy=e.clientY-r.top;w.style.right='auto';
      function mv(ev){const vw=window.innerWidth,vh=window.innerHeight,ww=w.offsetWidth,wh=w.offsetHeight;let nx=ev.clientX-ox,ny=ev.clientY-oy;nx=Math.max(8,Math.min(nx,Math.max(8,vw-ww-8)));ny=Math.max(54,Math.min(ny,Math.max(54,vh-wh-8)));w.style.left=nx+'px';w.style.right='auto';w.style.top=ny+'px';}
      function up(){document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);saveGeom(id);}
      document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);e.preventDefault();});});
  /* ===== 顶栏：下拉菜单 / 锁定 / 隐藏 / 快捷键面板（#5、#8） ===== */
  function closeMenus(except){document.querySelectorAll('.tb-menu.open').forEach(m=>{if(m!==except)m.classList.remove('open');});}
  function wireMenu(menuId,trigId){const menu=$('#'+menuId),trig=$('#'+trigId);if(!menu||!trig)return;
    trig.onclick=(ev)=>{ev.stopPropagation();const willOpen=!menu.classList.contains('open');closeMenus(menu);menu.classList.toggle('open',willOpen);};
    menu.querySelectorAll('.tb-pop .ghost').forEach(b=>b.addEventListener('click',()=>menu.classList.remove('open')));}
  wireMenu('menu-tools','tools-trigger');wireMenu('menu-features','features-trigger');
  wireUiModal();
  document.addEventListener('click',ev=>{if(!ev.target.closest('.tb-menu'))closeMenus();});
  document.addEventListener('pointerdown',ev=>{if(!ev.target.closest('.tb-menu'))closeMenus();});  // 点菜单外的任意处（含PDF区）即关闭下拉，pointerdown 比 click 更可靠

  // 锁定 / 隐藏顶栏
  let manualHidden=false,autoHidden=false,_lastST=0;
  function syncBar(){$('#topbar').classList.toggle('bar-hidden',manualHidden||autoHidden);updateChromeLayout();}
  function applyLock(){const b=$('#lock-btn');if(!b)return;b.classList.toggle('locked',!!settings.barLocked);b.textContent=settings.barLocked?'🔒':'🔓';
    b.title=settings.barLocked?'顶栏已锁定（常驻）。点此解锁——解锁后向下阅读时自动隐藏，鼠标移到顶部再出现':'顶栏未锁定（向下滚动时自动隐藏）。点此锁定为常驻';
    if(settings.barLocked){autoHidden=false;syncBar();}}
  $('#hide-btn').onclick=()=>{manualHidden=true;autoHidden=false;syncBar();};
  $('#bar-handle').onclick=()=>{manualHidden=false;autoHidden=false;syncBar();};
  $('#lock-btn').onclick=()=>{settings.barLocked=!settings.barLocked;saveSettings();applyLock();};
  function autoHideOnScroll(){if(settings.barLocked||manualHidden)return;const st=$('#viewer').scrollTop;
    if(st>_lastST+8&&st>80)autoHidden=true;else if(st<_lastST-8)autoHidden=false;_lastST=st;syncBar();}
  $('#viewer').addEventListener('scroll',autoHideOnScroll);
  document.addEventListener('mousemove',ev=>{if(!settings.barLocked&&autoHidden&&ev.clientY<=4){autoHidden=false;syncBar();}});
  applyLock();syncBar();

  // 快捷键面板
  function toggleHelp(show){const h=$('#kbd-help');h.classList.toggle('open',show===undefined?!h.classList.contains('open'):!!show);}
  $('#help-btn').onclick=()=>toggleHelp(true);$('#kh-close').onclick=()=>toggleHelp(false);
  $('#kbd-help').addEventListener('click',ev=>{if(ev.target.id==='kbd-help')toggleHelp(false);});

  /* ===== 全局键盘快捷键（#8） ===== */
  document.addEventListener('keydown',e=>{
    const tag=(e.target.tagName||'').toLowerCase();
    const typing=(tag==='input'||tag==='textarea'||tag==='select'||e.target.isContentEditable);
    if(e.key==='Escape'){
      if($('#ui-modal').classList.contains('open')){_umClose(null);return;}
      if(_ctxMenu){closeCtxMenu();return;}
      if($('#kbd-help').classList.contains('open')){toggleHelp(false);return;}
      if(document.querySelector('.tb-menu.open')){closeMenus();return;}
      if(typeof _folderPop!=='undefined'&&_folderPop){closeFolderPop();return;}
      const wins=Array.from(document.querySelectorAll('.window')).filter(w=>w.style.display!=='none');
      if(wins.length){wins.sort((a,b)=>(+b.style.zIndex||0)-(+a.style.zIndex||0));closeWin(wins[0].id.replace('win-',''));}
      return;
    }
    if(typing)return;
    if(e.key==='?'){e.preventDefault();toggleHelp();return;}
    if(e.altKey&&!e.ctrlKey&&!e.metaKey){
      const map={t:'translate',y:'qa',n:'notebook',r:'hum',
        h:'__hide',l:'__lock'};
      const k=e.key.toLowerCase();
      if(k in map){e.preventDefault();const v=map[k];
        if(v==='__hide'){manualHidden=!manualHidden;autoHidden=false;syncBar();}
        else if(v==='__lock'){settings.barLocked=!settings.barLocked;saveSettings();applyLock();}
        else if(typeof v==='function')v();else toggleWin(v);
        return;}
    }
    if(e.ctrlKey||e.metaKey){
      if(e.key==='='||e.key==='+'){e.preventDefault();setScaleManual(scale*1.12);}
      else if(e.key==='-'||e.key==='_'){e.preventDefault();setScaleManual(scale*0.893);}
      else if(e.key==='0'){e.preventDefault();cycleFit();}
      else if(e.key.toLowerCase()==='b'){e.preventDefault();$('#shelf').classList.toggle('open');}
      return;
    }
    if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();gotoPage(page-pageStep());}
    else if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){e.preventDefault();gotoPage(page+pageStep());}
    else if(e.key.toLowerCase()==='f'){e.preventDefault();cycleFit();}
    else if(e.key.toLowerCase()==='h'){e.preventDefault();setToolMode(settings.toolMode==='highlight'?'select':'highlight');}
    else if(e.key.toLowerCase()==='e'){e.preventDefault();setToolMode(settings.toolMode==='eraser'?'select':'eraser');}
  });
  const pop=$('#sel-pop');
  document.addEventListener('mouseup',e=>{setTimeout(()=>{const s=window.getSelection();const t=s&&s.toString().trim();
    const inSrc=false;const inV=e.target.closest&&(e.target.closest('#viewer')||inSrc);
    if(t&&inV&&!ocrMode&&settings.toolMode!=='eraser'){lastSel=t;lastSelectionInfo=selectionHighlightInfo();
      if(settings.toolMode==='highlight'&&!inSrc){addHighlight();pop.style.display='none';return;}
      try{const rc=s.getRangeAt(0).getBoundingClientRect();const popW=66;
      const pw=(s.anchorNode&&s.anchorNode.parentElement)?s.anchorNode.parentElement.closest('.page-wrap'):null;
      let x=inSrc?(rc.left-popW-8):(pw?pw.getBoundingClientRect().left-popW-12:rc.left-popW-8);if(x<6)x=6;
      let y=Math.max(58,Math.min(rc.top,window.innerHeight-150));
      pop.style.left=x+'px';pop.style.top=y+'px';pop.style.display='flex';}catch(err){}}
    else if(!(e.target.closest&&e.target.closest('#sel-pop'))){pop.style.display='none';}},10);});
  $('#pop-tr').onclick=()=>{if(!lastSel)return;openWin('translate');$('#tr-input').value=lastSel;runTranslate();pop.style.display='none';};
  $('#pop-ex').onclick=()=>{if(!lastSel)return;openQA(lastSel);runExplainInChat();pop.style.display='none';};
  $('#pop-hl').onclick=()=>{addHighlight();pop.style.display='none';};
  let _scrRAF=0;$('#viewer').addEventListener('scroll',()=>{pop.style.display='none';if(_scrRAF)return;_scrRAF=requestAnimationFrame(()=>{_scrRAF=0;onViewerScroll();});},{passive:true});
  applyNbFont();
  const lib=await loadLibrary();const last=localStorage.getItem('rw_lastbook');const b=lib.find(x=>x.id===last)||lib[0];if(b){openBook(b);}else{$('#shelf').classList.add('open');}
});
