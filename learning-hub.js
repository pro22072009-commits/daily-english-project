(function () {
  'use strict';
  const service = window.storageService;
  const KEY = 'dailyEnglishSystemV2';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = value => JSON.parse(JSON.stringify(value));
  const read = () => { try { return JSON.parse(service.getItem(KEY) || '{}'); } catch { return {}; } };
  const iso = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const addDays = (date, days) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate()+days); return iso(d); };
  const monday = date => { const d = new Date(`${date}T12:00:00`); return addDays(date,-((d.getDay()+6)%7)); };
  const dateLabel = date => date ? new Date(date.length===10 ? `${date}T12:00:00` : date).toLocaleString('ru-RU', date.length===10 ? {day:'numeric',month:'long'} : {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : 'дата не указана';
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const el = id => document.getElementById(id);
  const modeName = mode => mode === 'ielts' ? 'IELTS Academic' : 'B2 Foundation';
  const plural = (n,one,few,many) => n%100>=11&&n%100<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many;
  const hub = data => data.learningHub || {works:[],reviewLog:[]};
  const currentMode = () => read().studyMode === 'ielts' ? 'ielts' : 'b2';
  let signature = '', selectedId = '', editorBase = null, previewVersion = '', weekStart = monday(iso()), renderTimer = 0, lastMode=currentMode();
  const notice = document.createElement('p'); notice.id='hub-message'; notice.className='hub-message'; notice.setAttribute('role','status'); notice.setAttribute('aria-live','polite');
  el('view-progress').append(notice);
  function message(text, error=false) { notice.textContent=text; notice.classList.toggle('error',error); }
  function persist(mutator, refresh=false) {
    const data=read(); data.learningHub ||= {works:[],reviewLog:[]};
    data.learningHub.works ||= []; data.learningHub.reviewLog ||= [];
    mutator(data);
    const result=service.setItem(KEY,JSON.stringify(data));
    if(result===false)throw new Error(service.getState().error || 'Изменение не сохранено.');
    if(refresh)window.dailyEnglishRefreshB2?.();
    schedule(); return data;
  }
  function section(id, title, parent, tag='section') {
    const node=document.createElement(tag); node.id=id; node.className='hub-panel';
    node.innerHTML=tag==='details' ? `<summary>${title}</summary>` : `<h2>${title}</h2>`;
    parent.append(node); return node;
  }
  const home=el('redesign-home'), progress=el('view-progress');
  const entry=section('hub-review-entry','Повторить сегодня',home);
  const summary=section('hub-week','Обзор недели',progress);
  summary.insertAdjacentHTML('beforeend',`<div class="hub-week-tools"><button type="button" data-hub-week="-7" aria-label="Предыдущая неделя">Предыдущая</button><label>Неделя с даты<input id="hub-week-date" type="date" value="${weekStart}"></label><button type="button" data-hub-week="7" aria-label="Следующая неделя">Следующая</button><button type="button" id="hub-current-week">Текущая</button></div><div id="hub-week-data"></div>`);
  const units=section('hub-unit-overview','Учебный путь',progress);
  const works=section('hub-works','Мои работы',progress);
  works.insertAdjacentHTML('beforeend',`<p class="hub-muted">Writing и Speaking: свои тексты, заметки и проверки. Черновик сохраняется при вводе, отдельную версию можно зафиксировать.</p><div class="hub-actions"><button type="button" id="hub-new-work">Новая работа</button><button type="button" id="hub-import-drafts">Добавить черновики Writing</button></div><div id="hub-work-list" class="hub-work-list"></div><form id="hub-work-form" class="hub-work-form"><div class="hub-fields"><label>Навык<select name="type"><option value="writing">Writing</option><option value="speaking">Speaking</option></select></label><label>Режим<select name="mode"><option value="b2">B2 Foundation</option><option value="ielts">IELTS Academic</option></select></label><label>Дата<input name="date" type="date" required></label><label>Состояние<select name="status"><option value="draft">Черновик</option><option value="done">Готово</option></select></label></div><label>Тема<input name="topic" required maxlength="160" placeholder="О чём твоя работа?"></label><label>Текст или заметки к устному ответу<textarea name="text" rows="8" maxlength="50000" placeholder="Твой текст, план или расшифровка ответа"></textarea></label><div class="hub-fields"><label>Собственная проверка<textarea name="review" rows="3" maxlength="5000" placeholder="Что удалось и что стоит исправить?"></textarea></label><label>Следующий шаг<textarea name="nextStep" rows="3" maxlength="1000" placeholder="Одно конкретное действие"></textarea></label></div><div class="hub-actions"><button type="submit" class="primary">Сохранить версию</button><button type="button" id="hub-export-work">Скачать текст</button><span id="hub-work-save" role="status"></span></div><p class="hub-muted">До 20 зафиксированных версий на работу; до 50 000 символов в текущем тексте. Тексты и версии включены в резервную копию прогресса.</p></form><div id="hub-work-versions"></div><div id="hub-version-preview" hidden></div><section id="hub-audio"><h3>Голосовые записи</h3><p class="hub-muted">Аудио хранится только на этом устройстве, отдельно от текстов: до 3 минут и 3 МБ на запись, до 20 МБ всего. В облако и JSON-копию не входит. Важные записи можно скачать отдельными файлами.</p><div class="hub-actions"><button type="button" id="hub-record">Записать голос</button><button type="button" id="hub-stop-record" disabled>Остановить</button><label class="hub-file">Добавить аудиофайл<input id="hub-audio-file" type="file" accept="audio/*,.webm,.mp3,.wav,.ogg,.m4a"></label></div><p id="hub-audio-status" role="status"></p><div id="hub-audio-list"></div></section><details id="hub-existing-reviews"><summary>Ранее сохранённые проверки Speaking / Writing</summary><div id="hub-existing-review-list"></div></details>`);
  const queue=section('hub-review','Повторить сегодня',progress);
  const legacy=section('hub-original-progress','Журнал, результаты и план курса',progress,'details');
  const form=el('hub-work-form');
  const editor=document.createElement('details');editor.id='hub-editor';editor.innerHTML='<summary>Редактор работы, версии и аудио</summary>';
  form.before(editor);
  for(const node of [form,el('hub-work-versions'),el('hub-version-preview'),el('hub-audio')])editor.append(node);
  function place() {
    const plan=el('selected-day-plan'); if(plan && plan.nextElementSibling!==entry)plan.after(entry);
    const head=el('redesign-progress-heading');
    let before=head;
    for(const node of [notice,summary,units,works,queue,legacy]){if(before.nextElementSibling!==node)before.after(node);before=node;}
    for(const node of [...progress.children]){
      if(node.dataset.redesignRelocated && !legacy.contains(node))legacy.append(node);
    }
  }
  // Called while the existing layout observer is disconnected: no competing
  // observers move the same native module back and forth.
  window.dailyEnglishHubProgressTarget = () => legacy;
  window.dailyEnglishPlaceHub = place;
  function reviewData(data) {
    const b2=data.b2Foundation||{};
    return {words:(b2.vocabulary||[]).filter(w=>w.nextReview&&w.nextReview<=iso()),errors:(b2.errors||[]).map((item,index)=>({item,index})).filter(({item})=>!item.resolved)};
  }
  function renderReview(data) {
    const {words,errors}=reviewData(data),isB2=currentMode()==='b2';
    entry.hidden=!isB2;queue.hidden=!isB2;
    const entryHTML=`<div class="hub-review-short"><p><strong>${words.length}</strong> ${plural(words.length,'слово','слова','слов')} к повторению · <strong>${errors.length}</strong> ${plural(errors.length,'нерешённая ошибка','нерешённые ошибки','нерешённых ошибок')}</p><button type="button" data-hub-open-review>Открыть очередь</button></div>`;
    if(entry.dataset.content!==entryHTML){entry.innerHTML='<h2>Повторить сегодня</h2>'+entryHTML;entry.dataset.content=entryHTML;}
    const wasOpen=queue.querySelector('details')?.open||false;
    el('hub-review').innerHTML=`<h2>Повторить сегодня</h2><p class="hub-muted">Очередь на ${dateLabel(iso())}. Срок повторения слова берётся из существующего расписания SRS.</p>${!words.length&&!errors.length?'<p>На сегодня очередь пуста.</p>':''}<details id="hub-review-items" ${wasOpen?'open':''}><summary>${words.length} ${plural(words.length,'слово','слова','слов')} · ${errors.length} ${plural(errors.length,'ошибка','ошибки','ошибок')} — открыть</summary><div class="hub-review-grid">${words.slice(0,12).map(w=>`<article><span class="hub-chip">Слово · срок ${dateLabel(w.nextReview)}</span><h3>${esc(w.term)}</h3><p>${esc(w.definition||'')}</p><p>${esc(w.meaning||'')}</p><div class="hub-actions"><button type="button" data-hub-word="${esc(w.id)}" data-hub-result="remembered">Вспомнил(а)</button><button type="button" data-hub-word="${esc(w.id)}" data-hub-result="again">Повторить завтра</button><button type="button" data-b2-speak="${esc(w.term)}" aria-label="Произнести ${esc(w.term)}">Произнести</button></div></article>`).join('')}${errors.map(({item,index})=>`<article><span class="hub-chip">Ошибка · ${dateLabel(item.date)} · ещё не исправлена</span><h3>${esc(item.error)}</h3><p>${item.correction?`Исправление: ${esc(item.correction)}`:'Исправление пока не записано'}</p><button type="button" data-hub-resolve="${index}" data-hub-error="${esc(item.error)}">Разобрался с ошибкой</button></article>`).join('')}</div>${words.length>12?`<button type="button" data-hub-vocabulary>Ещё ${words.length-12} слов — открыть словарь</button>`:''}</details>`;
  }
  function weekData(data) {
    const end=addDays(weekStart,6),b2=data.b2Foundation||{},inWeek=d=>d>=weekStart&&d<=end;
    const mode=currentMode(),activity=new Set();
    for(const [date,value] of Object.entries(data.stats?.activityDates||{}))if(value&&inWeek(date))activity.add(date);
    let tasks=0;
    const history=mode==='b2'?b2.completed||{}:data.stats?.plans||{};
    for(const [date,row] of Object.entries(history)){if(!inWeek(date))continue;const n=Object.entries(row||{}).filter(([key,value])=>value===true&&(mode==='b2'||['vocab','grammar','input','output'].includes(key))).length;tasks+=n;if(n)activity.add(date);}
    const reviewIds=new Set((b2.vocabulary||[]).filter(w=>w.lastReviewed&&inWeek(w.lastReviewed)).map(w=>w.id));
    for(const row of hub(data).reviewLog||[])if(inWeek(row.date))reviewIds.add(row.wordId);
    const doneUnits=Array.from({length:12},(_,i)=>i+1).filter(n=>b2.unitPlan?.[n]?.completedAt||b2.unitProgress?.[n]==='done');
    const ready=(hub(data).works||[]).filter(w=>w.mode===mode&&w.status==='done'&&inWeek(w.date));
    const errors=(b2.errors||[]).filter(e=>!e.resolved).length;
    return {end,tasks,days:activity.size,activity,words:mode==='b2'?reviewIds.size:null,units:doneUnits,ready:ready.length,errors:mode==='b2'?errors:null};
  }
  function renderWeek(data) {
    const w=weekData(data),mode=currentMode();
    const stats=[['Дней активности (оба режима)',w.days],['Отметок заданий',w.tasks],...(mode==='b2'?[['Слов повторено',w.words],['Нерешённых ошибок',w.errors]]:[]),['Готовых работ за неделю',w.ready]];
    el('hub-week-data').innerHTML=`<p class="hub-week-title">${modeName(mode)} · ${dateLabel(weekStart)} — ${dateLabel(w.end)}</p><div class="hub-metrics">${stats.map(([label,value])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('')}</div><div class="hub-week-days">${Array.from({length:7},(_,i)=>{const date=addDays(weekStart,i);return `<span class="${w.activity.has(date)?'active':''}"><b>${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][i]}</b>${w.activity.has(date)?'✓':'—'}</span>`}).join('')}</div><p class="hub-muted">По сохранённым отметкам и датам активности. Слова считаются один раз за неделю. Общая серия включает активность обоих режимов.</p>${!w.days&&!w.tasks&&!w.ready?'<p>На эту неделю записей пока нет.</p>':''}`;
    el('hub-week-date').value=weekStart;
    units.hidden=mode!=='b2';
    units.innerHTML=`<div class="hub-heading"><h2>Учебный путь</h2><button type="button" data-hub-textbook>Открыть учебник</button></div><p>${w.units.length} / 12 Units завершено по сохранённым отметкам</p><div class="hub-units">${Array.from({length:12},(_,i)=>`<span class="${w.units.includes(i+1)?'done':''}">${w.units.includes(i+1)?'✓ ':''}U${i+1}</span>`).join('')}</div>`;
  }
  function workValues() { const fd=new FormData(form);return Object.fromEntries(['type','mode','date','status','topic','text','review','nextStep'].map(k=>[k,String(fd.get(k)||'')])); }
  function loadWork(id='') {
    if(recorder?.state==='recording'){message('Для перехода к другой работе требуется завершить запись голоса.',true);return;}
    selectedId=id; previewVersion='';
    const work=(hub(read()).works||[]).find(w=>w.id===id);
    editorBase=work?clone(work):null;
    const values=work||{type:'writing',mode:currentMode(),date:iso(),status:'draft',topic:'',text:'',review:'',nextStep:''};
    for(const key of ['type','mode','date','status','topic','text','review','nextStep'])form.elements[key].value=values[key]||'';
    el('hub-work-save').textContent=id?'Работа открыта':'Новый черновик';
    renderVersions();renderAudio();
  }
  function saveWork(version=false) {
    const values=workValues();
    if(!values.topic.trim()&&!values.text.trim()&&!selectedId)return null;
    if(!version&&editorBase&&Object.keys(values).every(key=>values[key]===(editorBase[key]||'')))return selectedId;
    if(version&&!form.reportValidity())return null;
    const wasNew=!selectedId;
    const id=selectedId||uid();
    const data=persist(data=>{
      const list=data.learningHub.works,existing=list.find(w=>w.id===id);
      let work=existing?service.mergeChanges(editorBase||{},{...(editorBase||{}),...values},existing):{...values,id,createdAt:new Date().toISOString(),versions:[]};
      work={...work,id,updatedAt:new Date().toISOString(),versions:existing?.versions||work.versions||[]};
      if(version){
        if(work.versions.length>=20)throw new Error('У работы уже 20 версий. Скачать текст; текущий черновик продолжает сохраняться.');
        work.versions.push({id:uid(),at:new Date().toISOString(),text:work.text,topic:work.topic,status:work.status,review:work.review,nextStep:work.nextStep});
      }
      if(existing)list[list.indexOf(existing)]=work;else list.push(work);
    });
    selectedId=id;editorBase=clone(data.learningHub.works.find(w=>w.id===id));
    for(const key of Object.keys(values))if(editorBase[key]!==values[key])form.elements[key].value=editorBase[key]||'';
    el('hub-work-save').textContent=version?'Версия сохранена':'Черновик сохранён на устройстве';
    if((version||values.status==='done')&&values.text.trim())window.dailyEnglishRecordActivity?.();
    if(version||wasNew)renderVersions();return id;
  }
  function renderWorks(data) {
    const list=(hub(data).works||[]).filter(w=>w.mode===currentMode()).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
    el('hub-work-list').innerHTML=list.length?list.map(w=>`<button type="button" data-hub-work="${esc(w.id)}" aria-pressed="${selectedId===w.id}"><strong>${esc(w.topic||'Без названия')}</strong><span>${w.type==='speaking'?'Speaking':'Writing'} · ${dateLabel(w.date)} · ${w.status==='done'?'Готово':'Черновик'} · ${(w.versions||[]).length} версий</span></button>`).join(''):'<p class="hub-muted">В этом режиме ещё нет работ. Доступны создание новой работы и импорт черновиков Writing.</p>';
    let drafts={};try{drafts=JSON.parse(service.getItem('dailyEnglishAcademicDraftsV2')||'{}');}catch{}
    const count=Object.values(drafts).filter(v=>typeof v==='string'&&v.trim()).length;
    el('hub-import-drafts').textContent=`Добавить черновики Writing (${count})`;el('hub-import-drafts').disabled=!count;
    const reviews=data.b2Foundation?.skillChecks||[];
    el('hub-existing-review-list').innerHTML=reviews.length?reviews.slice().reverse().map(w=>`<article><h3>${esc(w.task||'Без названия')}</h3><p>${w.type==='speaking'?'Speaking':'Writing'} · ${dateLabel(w.date)}</p><p>${esc(w.note||'')}</p><p>Следующий шаг: ${esc(w.next||'не записан')}</p></article>`).join(''):'<p>Проверок пока нет.</p>';
  }
  function renderVersions() {
    const work=(hub(read()).works||[]).find(w=>w.id===selectedId);
    const versions=work?.versions||[];
    el('hub-work-versions').innerHTML=`<details><summary>Версии текста · ${versions.length} / 20</summary>${versions.slice().reverse().map(v=>`<article><strong>${dateLabel(v.at)}</strong><p>${esc((v.text||'').slice(0,150))}${(v.text||'').length>150?'…':''}</p><button type="button" data-hub-version="${esc(v.id)}">Открыть версию · ${(v.text||'').length} символов</button></article>`).join('')||'<p>Зафиксированных версий пока нет.</p>'}</details>`;
    const v=versions.find(v=>v.id===previewVersion);el('hub-version-preview').hidden=!v;
    if(v)el('hub-version-preview').innerHTML=`<h3>Версия от ${dateLabel(v.at)}</h3><textarea readonly aria-label="Предпросмотр версии">${esc(v.text)}</textarea><p>Перед заменой текущий текст будет сохранён отдельной версией.</p><button type="button" id="hub-use-version">Сделать текущей</button><button type="button" id="hub-close-version">Закрыть просмотр</button>`;
  }
  function decorateCalendar() {
    const calendar=el('b2-calendar-section');if(!calendar||calendar.querySelector('.hub-calendar-legend'))return;
    const legend=document.createElement('div');legend.className='hub-calendar-legend';legend.setAttribute('aria-label','Обозначения календаря');
    legend.innerHTML='<span><i class="legend-selected"></i>Выбран</span><span><i class="legend-today"></i>Сегодня</span><span>◐ Частично</span><span>✓ Выполнено</span><span>☾ Отдых</span>';
    calendar.querySelector('.b2-calendar-month')?.after(legend);
  }
  function render() {
    place();decorateCalendar();
    const streak=Number(el('streak')?.textContent)||0;
    const streakLabel=[...(document.querySelector('.streak')?.childNodes||[])].find(n=>n.nodeType===Node.TEXT_NODE&&/дней|дня|день/.test(n.textContent));
    if(streakLabel){const text=' '+plural(streak,'день','дня','дней');if(streakLabel.textContent!==text)streakLabel.textContent=text;}
    const raw=service.getItem(KEY)||'{}',key=raw+'|'+weekStart+'|'+(service.getItem('dailyEnglishAcademicDraftsV2')||'');
    if(key===signature)return;signature=key;
    const data=read();
    if(lastMode!==currentMode()){if(recorder?.state==='recording')recorder.stop();lastMode=currentMode();loadWork();editor.open=false;}
    renderReview(data);renderWeek(data);renderWorks(data);
    const state=service.getState();const status=el('storageStatus');
    if(status)status.dataset.state=state.error?'error':state.conflicts.length?'conflict':!navigator.onLine?'offline':'saved';
  }
  function schedule() { clearTimeout(renderTimer);renderTimer=setTimeout(render,30); }
  form.addEventListener('input',()=>{try{saveWork();}catch(error){el('hub-work-save').textContent=error.message;message(error.message,true);}});
  form.addEventListener('change',()=>{try{saveWork();}catch(error){message(error.message,true);}});
  form.addEventListener('submit',event=>{event.preventDefault();try{saveWork(true);message('Версия работы сохранена.');}catch(error){message(error.message,true);}});
  function download(blob,name) { const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
  document.addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b)return;
    try{
      if(b.hasAttribute('data-hub-open-review')){showView('progress');const items=el('hub-review-items');if(items)items.open=true;queue.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
      if(b.hasAttribute('data-hub-vocabulary'))showView('vocabulary');
      if(b.hasAttribute('data-hub-textbook'))showView('textbook');
      if(b.dataset.hubWeek){weekStart=addDays(weekStart,Number(b.dataset.hubWeek));render();}
      if(b.id==='hub-current-week'){weekStart=monday(iso());render();}
      if(b.dataset.hubWork){loadWork(b.dataset.hubWork);editor.open=true;form.elements.topic.focus();renderWorks(read());}
      if(b.id==='hub-new-work'){loadWork();editor.open=true;form.elements.topic.focus();renderWorks(read());}
      if(b.dataset.hubVersion){previewVersion=b.dataset.hubVersion;renderVersions();}
      if(b.id==='hub-close-version'){previewVersion='';renderVersions();}
      if(b.id==='hub-use-version'){
        const v=(hub(read()).works||[]).find(w=>w.id===selectedId)?.versions.find(v=>v.id===previewVersion);if(!v)return;
        const desired=clone(v);if(!saveWork(true))return;
        for(const key of ['text','topic','status','review','nextStep'])form.elements[key].value=desired[key]||'';
        saveWork();previewVersion='';renderVersions();message('Версия стала текущей. Предыдущий текст сохранён.');
      }
      if(b.id==='hub-export-work'){const w=workValues();download(new Blob([`${w.topic}\n${w.date} · ${modeName(w.mode)}\n\n${w.text}\n\nСамопроверка: ${w.review}\nСледующий шаг: ${w.nextStep}`],{type:'text/plain;charset=utf-8'}),`daily-english-work-${w.date||iso()}.txt`);}
      if(b.id==='hub-import-drafts'){
        const drafts=JSON.parse(service.getItem('dailyEnglishAcademicDraftsV2')||'{}');let added=0;
        persist(data=>{for(const [key,text]of Object.entries(drafts)){if(typeof text!=='string'||!text.trim())continue;const id='legacy-'+key;if(data.learningHub.works.some(w=>w.id===id))continue;data.learningHub.works.push({id,type:'writing',mode:'ielts',date:iso(),status:'draft',topic:`Writing · ${key}`,text,review:'',nextStep:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),versions:[]});added++;}});
        message(`Добавлено черновиков: ${added}. Они находятся в режиме IELTS Academic; исходные поля сохранены.`);
      }
      if(b.dataset.hubWord){
        const native=[...document.querySelectorAll(b.dataset.hubResult==='again'?'[data-vocab-again]':'[data-vocab-review]')].find(n=>(n.dataset.vocabReview||n.dataset.vocabAgain)===b.dataset.hubWord);
        if(native)native.click();else{showView('vocabulary');message('Слово доступно в очереди повторения словаря.',true);}
      }
      if(b.hasAttribute('data-hub-resolve')){
        persist(data=>{const error=data.b2Foundation?.errors?.[Number(b.dataset.hubResolve)];if(error&&error.error===b.dataset.hubError){error.resolved=true;error.resolvedAt=iso();}},true);
        message('Ошибка отмечена как разобранная.');
      }
    }catch(error){message(error.message||'Не удалось сохранить изменение.',true);}
  });
  // Observe native SRS actions as well as the new queue, without changing the
  // existing intervals, overdue handling or activity calculation.
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-vocab-review],[data-vocab-again]');if(!button)return;
    const id=button.dataset.vocabReview||button.dataset.vocabAgain;
    const before=clone(read().b2Foundation?.vocabulary?.find(w=>w.id===id)||{});
    queueMicrotask(()=>{
      const after=read().b2Foundation?.vocabulary?.find(w=>w.id===id);
      if(after&&(after.stage!==before.stage||after.nextReview!==before.nextReview||after.lastReviewed!==before.lastReviewed)){
        try{persist(data=>data.learningHub.reviewLog.push({id:uid(),date:iso(),wordId:id,result:button.hasAttribute('data-vocab-again')?'again':'remembered'}));}catch(error){message(error.message,true);}
      }
    });
  },true);
  el('hub-week-date').addEventListener('change',event=>{if(/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)){weekStart=monday(event.target.value);render();}});
  const dbPromise = new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error('Хранилище аудио недоступно.'));return;}
    const request=indexedDB.open('DailyEnglishAudioV1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('recordings',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  // A blocked/private browser must not produce an unhandled rejection.
  dbPromise.catch(()=>{});
  let recorder=null,stream=null,recordTimer=null,recordStarted=0,recordFor='',audioURLs=[],audioGeneration=0;
  const audioExtension = (blob) => /\.(webm|mp3|wav|ogg|m4a)$/i.exec(blob.name||'')?.[1].toLowerCase() || (blob.type.includes('mp4')?'m4a':blob.type.includes('mpeg')?'mp3':blob.type.includes('wav')?'wav':blob.type.includes('ogg')?'ogg':'webm');
  async function audioRows(){const db=await dbPromise;return new Promise((resolve,reject)=>{const tx=db.transaction('recordings'),r=tx.objectStore('recordings').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async function storeAudio(blob,workId,duration=0) {
    if(!workId)throw new Error('Для записи нужна тема работы.');
    if(blob.size>3*1024*1024)throw new Error('Запись больше 3 МБ. Сохранить более короткий файл.');
    if(!duration)duration=await new Promise((resolve,reject)=>{const audio=new Audio(),url=URL.createObjectURL(blob);const timer=setTimeout(()=>finish(new Error('Не удалось прочитать длительность аудио.')),10000);function finish(error){clearTimeout(timer);URL.revokeObjectURL(url);audio.removeAttribute('src');if(error)reject(error);else resolve(audio.duration);}audio.onloadedmetadata=()=>{const seconds=audio.duration;clearTimeout(timer);URL.revokeObjectURL(url);audio.removeAttribute('src');if(!Number.isFinite(seconds)||seconds<=0)reject(new Error('Не удалось прочитать длительность аудио.'));else resolve(seconds);};audio.onerror=()=>finish(new Error('Браузер не распознаёт этот аудиофайл.'));audio.src=url;});
    if(duration>180.5)throw new Error('Запись длиннее 3 минут. Выбрать более короткий файл.');
    const rows=await audioRows();if(rows.reduce((n,r)=>n+r.blob.size,0)+blob.size>20*1024*1024)throw new Error('Хранилище аудио достигло 20 МБ. Скачать записи и освободить место.');
    const db=await dbPromise;
    await new Promise((resolve,reject)=>{const tx=db.transaction('recordings','readwrite');tx.objectStore('recordings').put({id:uid(),workId,createdAt:new Date().toISOString(),blob,duration,extension:audioExtension(blob)});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
    el('hub-audio-status').textContent='Аудио сохранено на этом устройстве.';await renderAudio();
  }
  async function renderAudio(){
    const generation=++audioGeneration,workId=selectedId;
    try{
      const rows=(await audioRows()).filter(r=>r.workId===workId);if(generation!==audioGeneration)return;
      audioURLs.forEach(url=>URL.revokeObjectURL(url));audioURLs=[];
      el('hub-audio-list').innerHTML=rows.map(r=>{const url=URL.createObjectURL(r.blob);audioURLs.push(url);return `<article><p>${dateLabel(r.createdAt)} · ${(r.blob.size/1024).toFixed(0)} КБ</p><audio controls preload="metadata" src="${url}"></audio><div class="hub-actions"><a class="sys-btn" href="${url}" download="daily-english-speaking-${r.id}.${esc(r.extension||audioExtension(r.blob))}">Скачать запись</a><button type="button" data-hub-delete-audio="${r.id}">Удалить с устройства</button></div></article>`;}).join('')||'<p class="hub-muted">У этой работы нет записей на устройстве.</p>';
    }catch(error){el('hub-audio-status').textContent=error.message;}
  }
  function stopTracks(){if(stream)stream.getTracks().forEach(track=>track.stop());stream=null;clearTimeout(recordTimer);el('hub-record').disabled=false;el('hub-stop-record').disabled=true;}
  el('hub-record').addEventListener('click',async()=>{
    try{
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Запись доступна через HTTPS или localhost в поддерживаемом браузере. Можно добавить готовый аудиофайл.');
      const id=saveWork();if(!id)throw new Error('Для записи нужна тема работы.');
      el('hub-record').disabled=true;stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type));
      recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});recordFor=id;recordStarted=performance.now();const chunks=[];let size=0;
      recorder.ondataavailable=event=>{if(event.data.size){chunks.push(event.data);size+=event.data.size;if(size>=3*1024*1024&&recorder.state==='recording')recorder.stop();}};
      recorder.onstop=async()=>{const blob=new Blob(chunks,{type:recorder.mimeType}),duration=(performance.now()-recordStarted)/1000;stopTracks();try{if(blob.size){await storeAudio(blob,recordFor,duration);window.dailyEnglishRecordActivity?.();}}catch(error){el('hub-audio-status').textContent=error.message;download(blob,`daily-english-recording-${iso()}.${audioExtension(blob)}`);}};
      recorder.onerror=()=>{stopTracks();el('hub-audio-status').textContent='Не удалось продолжить запись. Добавить аудиофайл.';};
      recorder.start(500);el('hub-stop-record').disabled=false;el('hub-audio-status').textContent='Идёт запись. Автоматическая остановка через 3 минуты.';
      recordTimer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},180000);
    }catch(error){stopTracks();el('hub-audio-status').textContent=error.message;}
  });
  el('hub-stop-record').addEventListener('click',()=>{if(recorder?.state==='recording')recorder.stop();});
  el('hub-audio-file').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;if(!file.type.startsWith('audio/')&&!/\.(webm|mp3|wav|ogg|m4a)$/i.test(file.name))throw new Error('Требуется аудиофайл.');await storeAudio(file,saveWork());}catch(error){el('hub-audio-status').textContent=error.message;}finally{event.target.value='';}});
  el('hub-audio-list').addEventListener('click',async event=>{const button=event.target.closest('[data-hub-delete-audio]');if(!button)return;if(!confirm('Удалить эту запись с устройства? Сначала скачать её, если хочешь сохранить.'))return;try{const db=await dbPromise;await new Promise((resolve,reject)=>{const tx=db.transaction('recordings','readwrite');tx.objectStore('recordings').delete(button.dataset.hubDeleteAudio);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});await renderAudio();}catch(error){el('hub-audio-status').textContent=error.message;}});
  window.addEventListener('pagehide',()=>{if(recorder?.state==='recording')recorder.stop();stopTracks();audioURLs.forEach(url=>URL.revokeObjectURL(url));});
  window.addEventListener('storage',event=>{if(event.key===KEY||event.key==='dailyEnglishAcademicDraftsV2')schedule();});
  service.subscribe(()=>{const state=service.getState();const status=el('storageStatus');if(status)status.dataset.state=state.error?'error':state.conflicts.length?'conflict':!navigator.onLine?'offline':state.status==='Синхронизируется'?'syncing':'saved';schedule();});
  new MutationObserver(schedule).observe(el('redesign-home'),{childList:true,subtree:true});
  loadWork();place();render();
})();
