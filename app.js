const STORAGE_KEY = 'luna-minor-portfolio-v1';
const defaults = [['opdracht','De opdracht'],['aanpak','Mijn aanpak'],['proces','Het proces'],['resultaat','Het resultaat']];
const clone = value => JSON.parse(JSON.stringify(value));
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL = value => { try {const url=new URL(value,location.href);return ['https:','http:','file:'].includes(url.protocol)||/^data:image\/(jpeg|png|webp|gif);base64,/i.test(value)?escapeHTML(value):'';}catch{return '';} };
function normalize(data){
  if(!Array.isArray(data)||data.length>200)throw Error('Ongeldige projectlijst');
  const ids=new Set();
  return data.map(item=>{
    if(!item||typeof item.title!=='string')throw Error('Ongeldig project');
    const p={};for(const key of ['id','title','type','summary','number','image','imageAlt','url'])p[key]=typeof item[key]==='string'?item[key]:'';
    if(!p.id||ids.has(p.id))p.id=crypto.randomUUID();ids.add(p.id);
    p.sections=Array.isArray(item.sections)?item.sections.map(s=>({title:String(s.title??''),text:String(s.text??'')})):defaults.map(([key,title])=>({title,text:String(item[key]||'')}));
    p.photos=Array.isArray(item.photos)?item.photos.map(p=>({src:String(p.src||''),alt:String(p.alt||''),caption:String(p.caption||'')})):[];return p;
  });
}
let projects=normalize(window.portfolioProjects),editing=false,draft=null,dragId=null,busy=0,storageProblem=false;
const timeline=document.querySelector('#timeline'),dialog=document.querySelector('#project-dialog'),editor=document.querySelector('#edit-dialog'),form=document.querySelector('#project-form'),status=document.querySelector('#save-status');
try{const stored=localStorage.getItem(STORAGE_KEY);if(stored)projects=normalize(JSON.parse(stored).projects);}catch{storageProblem=true;status.textContent='Browseropslag niet beschikbaar. Bewaar je werk met een reservekopie.';}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,projects}));storageProblem=false;status.textContent='✓ Opgeslagen in deze browser';return true;}catch{storageProblem=true;status.textContent='Niet in browser opgeslagen. Maak nu een reservekopie om je wijzigingen te bewaren.';return false;}}
function visual(p){
  if(p.image&&safeURL(p.image))return `<img src="${safeURL(p.image)}" alt="${escapeHTML(p.imageAlt)}" loading="lazy">`;
  if(p.id==='green-stories')return '<div class="green-visual" aria-label="Tijdelijke illustratie Green Stories"><span class="story-card back">?</span><span class="story-card front"><small>GREEN</small><strong>stories</strong><span>?</span></span><span class="visual-caption">Spelconcept · projectfoto volgt</span></div>';
  return '<div class="empty-visual"><span>＋</span>Ruimte voor jouw beeld</div>';
}
function render(){
  document.body.classList.toggle('editing',editing);document.querySelector('#toggle-edit').setAttribute('aria-pressed',String(editing));document.querySelector('#toggle-edit').textContent=editing?'✓ Klaar met bewerken':'✎ Portfolio bewerken';document.querySelector('#editor-actions').hidden=!editing;
  timeline.innerHTML=projects.map((p,i)=>`<article class="project-row" data-id="${escapeHTML(p.id)}"><span class="timeline-dot" aria-hidden="true"></span>${editing?`<div class="project-tools"><button class="drag-handle" draggable="true" aria-label="Versleep ${escapeHTML(p.title)}" title="Sleep dit project naar een andere plek">⠿ Verplaatsen</button><button data-move="-1" ${i===0?'disabled':''} aria-label="${escapeHTML(p.title)} omhoog">↑</button><button data-move="1" ${i===projects.length-1?'disabled':''} aria-label="${escapeHTML(p.title)} omlaag">↓</button><button data-edit="${escapeHTML(p.id)}">✎ Bewerken</button></div>`:''}<button class="project-visual" data-project="${escapeHTML(p.id)}" aria-label="Bekijk ${escapeHTML(p.title)}">${visual(p)}<span class="image-arrow" aria-hidden="true">↗</span></button><div class="project-copy"><span class="project-number">${escapeHTML(p.number||String(i+1).padStart(2,'0'))}<span> / ${escapeHTML(p.type)}</span></span><h3>${escapeHTML(p.title)}</h3><p>${escapeHTML(p.summary)}</p><button class="text-link" data-project="${escapeHTML(p.id)}">Bekijk project <span>↗</span></button></div></article>`).join('');
}
function renderDetail(id){const p=projects.find(p=>p.id===id);if(!p)return;dialog.dataset.projectId=id;const sections=p.sections.filter(s=>s.text.trim());document.querySelector('#detail-content').innerHTML=`${editing?`<button class="detail-edit" data-edit="${escapeHTML(id)}">✎ Dit project bewerken</button>`:''}<p class="eyebrow">${escapeHTML(p.type)} · MINOR CIRCULAIRE ECONOMIE</p><h2 id="detail-title">${escapeHTML(p.title)}</h2>${p.summary?`<p class="detail-summary">${escapeHTML(p.summary)}</p>`:''}<div class="detail-visual">${visual(p)}</div><div class="detail-sections">${sections.map(s=>`<section><h3>${escapeHTML(s.title)}</h3><p>${escapeHTML(s.text)}</p></section>`).join('')}</div>${!sections.length&&editing?'<p class="placeholder">Klik op ‘Dit project bewerken’ om je opdracht, aanpak en resultaat toe te voegen.</p>':''}${p.photos.length?`<div class="photo-grid">${p.photos.map(photo=>`<figure><img src="${safeURL(photo.src)}" alt="${escapeHTML(photo.alt)}">${photo.caption?`<figcaption>${escapeHTML(photo.caption)}</figcaption>`:''}</figure>`).join('')}</div>`:''}${p.url&&safeURL(p.url)?`<a class="visit" href="${safeURL(p.url)}" target="_blank" rel="noopener noreferrer">Bekijk de website ↗</a>`:''}`;}
function syncBody(){document.body.classList.toggle('dialog-open',dialog.open||editor.open);}
function openProject(id){renderDetail(id);dialog.showModal();dialog.scrollTop=0;syncBody();}
function moveProject(id,direction){const from=projects.findIndex(p=>p.id===id),to=from+direction;if(from<0||to<0||to>=projects.length)return;projects.splice(to,0,projects.splice(from,1)[0]);persist();render();timeline.querySelector(`[data-id="${CSS.escape(id)}"] [data-move="${direction}"]`)?.focus();}
function openEditor(id){draft=id?clone(projects.find(p=>p.id===id)):normalize([{id:crypto.randomUUID(),title:'Nieuw project',sections:defaults.map(([,title])=>({title,text:''}))}])[0];for(const key of ['number','type','title','summary','url','imageAlt'])form.elements[key].value=draft[key];document.querySelector('#edit-title').textContent=id?'Project bewerken':'Nieuw project';document.querySelector('#form-status').textContent='';renderCover();renderSections();renderPhotos();editor.showModal();editor.scrollTop=0;syncBody();}
function renderCover(){document.querySelector('#cover-preview').innerHTML=draft.image?`<img src="${safeURL(draft.image)}" alt="Gekozen omslagbeeld">`:'<p class="edit-hint">Nog geen eigen omslagbeeld gekozen.</p>';}
function renderSections(){document.querySelector('#section-fields').innerHTML=draft.sections.map((s,i)=>`<div class="section-field" data-section="${i}"><div class="block-controls"><span>Tekstblok ${i+1}</span><button type="button" data-section-move="-1" ${i===0?'disabled':''} aria-label="Tekstblok ${i+1} omhoog">↑</button><button type="button" data-section-move="1" ${i===draft.sections.length-1?'disabled':''} aria-label="Tekstblok ${i+1} omlaag">↓</button><button type="button" data-section-remove>Verwijderen</button></div><label>Kop<input data-section-key="title" value="${escapeHTML(s.title)}"></label><label>Tekst<textarea data-section-key="text" rows="4">${escapeHTML(s.text)}</textarea></label></div>`).join('');}
function renderPhotos(){document.querySelector('#photo-fields').innerHTML=draft.photos.map((p,i)=>`<div class="photo-field" data-photo="${i}"><img src="${safeURL(p.src)}" alt="${escapeHTML(p.alt)}"><div><label>Beschrijving<input data-photo-key="alt" value="${escapeHTML(p.alt)}"></label><label>Onderschrift<input data-photo-key="caption" value="${escapeHTML(p.caption)}"></label><div class="block-controls"><button type="button" data-photo-move="-1" ${i===0?'disabled':''} aria-label="Foto ${i+1} omhoog">↑</button><button type="button" data-photo-move="1" ${i===draft.photos.length-1?'disabled':''} aria-label="Foto ${i+1} omlaag">↓</button><button type="button" data-photo-remove>Foto verwijderen</button></div></div></div>`).join('');}
document.querySelector('#toggle-edit').addEventListener('click',()=>{editing=!editing;render();if(editing&&!storageProblem)status.textContent='Wijzigingen blijven in deze browser. Maak regelmatig een reservekopie.';});
document.querySelector('#add-project').addEventListener('click',()=>openEditor());
document.addEventListener('click',e=>{const edit=e.target.closest('[data-edit]');if(edit){openEditor(edit.dataset.edit);return;}const move=e.target.closest('[data-move]');if(move){moveProject(move.closest('[data-id]').dataset.id,Number(move.dataset.move));return;}const p=e.target.closest('[data-project]');if(p)openProject(p.dataset.project);});
timeline.addEventListener('dragstart',e=>{if(!editing||!e.target.closest('.drag-handle'))return;dragId=e.target.closest('[data-id]').dataset.id;e.dataTransfer.setData('text/plain',dragId);e.dataTransfer.effectAllowed='move';e.target.closest('.project-row').classList.add('dragging');});
timeline.addEventListener('dragover',e=>{if(!dragId)return;const row=e.target.closest('.project-row');if(!row)return;e.preventDefault();e.dataTransfer.dropEffect='move';timeline.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));row.classList.add('drop-target');});
timeline.addEventListener('drop',e=>{if(!dragId)return;e.preventDefault();const row=e.target.closest('[data-id]');if(row){const from=projects.findIndex(p=>p.id===dragId),to=projects.findIndex(p=>p.id===row.dataset.id);if(from>=0&&to>=0&&from!==to){projects.splice(to,0,projects.splice(from,1)[0]);persist();}}dragId=null;render();});
timeline.addEventListener('dragend',()=>{dragId=null;timeline.querySelectorAll('.dragging,.drop-target').forEach(el=>el.classList.remove('dragging','drop-target'));});
form.addEventListener('input',e=>{const s=e.target.closest('[data-section]'),p=e.target.closest('[data-photo]');if(s&&e.target.dataset.sectionKey)draft.sections[Number(s.dataset.section)][e.target.dataset.sectionKey]=e.target.value;if(p&&e.target.dataset.photoKey)draft.photos[Number(p.dataset.photo)][e.target.dataset.photoKey]=e.target.value;});
form.addEventListener('click',e=>{const s=e.target.closest('[data-section]'),p=e.target.closest('[data-photo]');if(s){const i=Number(s.dataset.section);if(e.target.closest('[data-section-remove]')){draft.sections.splice(i,1);renderSections();}else if(e.target.closest('[data-section-move]')){const to=i+Number(e.target.dataset.sectionMove);draft.sections.splice(to,0,draft.sections.splice(i,1)[0]);renderSections();}}if(p){const i=Number(p.dataset.photo);if(e.target.closest('[data-photo-remove]')){draft.photos.splice(i,1);renderPhotos();}else if(e.target.closest('[data-photo-move]')){const to=i+Number(e.target.dataset.photoMove);draft.photos.splice(to,0,draft.photos.splice(i,1)[0]);renderPhotos();}}});
document.querySelector('#add-section').addEventListener('click',()=>{draft.sections.push({title:'Nieuwe kop',text:''});renderSections();});
document.querySelector('#remove-cover').addEventListener('click',()=>{draft.image='';renderCover();});
async function readImage(file){if(!file.type.startsWith('image/'))throw Error('Kies een afbeelding');const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(1,1400/img.naturalWidth,1400/img.naturalHeight),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#e9e7e7';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.82);}finally{URL.revokeObjectURL(url);}}
async function uploadImages(input,isCover){const files=Array.from(input.files),current=draft;if(!files.length)return;busy++;form.querySelector('[type="submit"]').disabled=true;document.querySelector('#form-status').textContent='Afbeeldingen verwerken…';try{const images=[];for(const file of files)images.push({src:await readImage(file),alt:file.name.replace(/\.[^.]+$/,''),caption:''});if(draft!==current)return;if(isCover){draft.image=images[0].src;renderCover();}else{draft.photos.push(...images);renderPhotos();}document.querySelector('#form-status').textContent='Afbeeldingen toegevoegd. Klik op Opslaan om ze te bewaren.';}catch{document.querySelector('#form-status').textContent='Afbeelding niet geopend. Probeer een JPG, PNG of WebP.';}finally{busy--;form.querySelector('[type="submit"]').disabled=busy>0;input.value='';}}
document.querySelector('#cover-upload').addEventListener('change',e=>uploadImages(e.target,true));document.querySelector('#photos-upload').addEventListener('change',e=>uploadImages(e.target,false));
form.addEventListener('submit',e=>{e.preventDefault();if(busy)return;for(const key of ['number','type','title','summary','url','imageAlt'])draft[key]=form.elements[key].value.trim();if(!draft.title){form.elements.title.focus();return;}const i=projects.findIndex(p=>p.id===draft.id);if(i<0)projects.push(draft);else projects[i]=draft;persist();render();if(dialog.open)renderDetail(draft.id);editor.close();});
document.querySelectorAll('.cancel-edit').forEach(b=>b.addEventListener('click',()=>editor.close()));document.querySelector('.close').addEventListener('click',()=>dialog.close());for(const m of [dialog,editor])m.addEventListener('close',syncBody);
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
document.querySelector('#export-data').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,projects},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`luna-portfolio-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Reservekopie aangeboden als download.';});
document.querySelector('#import-data').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text()),imported=normalize(data.projects);if(!confirm('Deze reservekopie vervangt de huidige projecten. Wil je doorgaan?'))return;projects=imported;persist();render();}catch{status.textContent='Reservekopie niet geopend. Kies een geldig portfolio-JSON-bestand.';}finally{e.target.value='';}});
render();

// De sleepgreep werkt met muis en aanraking; pijltjes blijven beschikbaar.
let pointerDrag = null;
timeline.addEventListener('pointerdown', event => {
  const handle = event.target.closest('.drag-handle');
  if (!editing || !handle || event.button !== 0) return;
  event.preventDefault();
  handle.setPointerCapture(event.pointerId);
  pointerDrag = { id: handle.closest('[data-id]').dataset.id, x: event.clientX, y: event.clientY, moved: false, handle };
});
timeline.addEventListener('pointermove', event => {
  if (!pointerDrag) return;
  if (Math.hypot(event.clientX - pointerDrag.x, event.clientY - pointerDrag.y) < 7 && !pointerDrag.moved) return;
  pointerDrag.moved = true;
  pointerDrag.handle.closest('.project-row').classList.add('dragging');
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.project-row');
  timeline.querySelectorAll('.drop-target').forEach(row => row.classList.remove('drop-target'));
  if (target && target.dataset.id !== pointerDrag.id) target.classList.add('drop-target');
  if (event.clientY < 65) window.scrollBy(0, -18);
  else if (event.clientY > innerHeight - 65) window.scrollBy(0, 18);
});
function finishPointerDrag(event) {
  if (!pointerDrag) return;
  const current = pointerDrag;
  pointerDrag = null;
  if (current.handle.hasPointerCapture(event.pointerId)) current.handle.releasePointerCapture(event.pointerId);
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.project-row');
  if (event.type !== 'pointercancel' && current.moved && target) {
    const from = projects.findIndex(p => p.id === current.id), to = projects.findIndex(p => p.id === target.dataset.id);
    if (from >= 0 && to >= 0 && from !== to) { projects.splice(to, 0, projects.splice(from, 1)[0]); persist(); render(); }
  }
  timeline.querySelectorAll('.dragging,.drop-target').forEach(row => row.classList.remove('dragging', 'drop-target'));
}
timeline.addEventListener('pointerup', finishPointerDrag);
timeline.addEventListener('pointercancel', finishPointerDrag);
