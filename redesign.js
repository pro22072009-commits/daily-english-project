(function () {
  const labels={dashboard:'Сегодня',textbook:'Учебник',practice:'Практика',vocabulary:'Слова',progress:'Прогресс'};
  const icons={dashboard:'M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4',textbook:'M4 4h7v16H4z M13 4h7v16h-7',practice:'M5 4l15 8-15 8z',vocabulary:'M4 5h16v12H9l-5 4z M8 9h8 M8 13h5',progress:'M4 20V12 M10 20V4 M16 20V9 M22 20H2'};
  const svg=key=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[key]}"/></svg>`;
  const original=window.showView;
  const app=document.querySelector('.app');
  const dash=document.getElementById('view-dashboard');
  // The footer belongs after all five views, including the generated ones.
  const footer=document.querySelector('.footer');if(footer)app.append(footer);
  let current='dashboard';
  document.addEventListener('click',event=>{if(event.target.closest('[data-calendar-date],[data-calendar-shift],[data-calendar-today]'))window.dailyEnglishCalendarSelectionActive=true;},true);
  document.addEventListener('change',event=>{if(event.target.id==='b2-calendar-picker')window.dailyEnglishCalendarSelectionActive=true;},true);
  const create=(id,parent,tag='section')=>{let el=document.getElementById(id);if(!el){el=document.createElement(tag);el.id=id;parent.append(el);}return el;};
  const home=create('redesign-home',dash);
  const practice=create('view-practice',app);practice.className='view';
  const progress=create('view-progress',app);progress.className='view';
  const practiceBody=create('redesign-practice-body',practice);
  practiceBody.innerHTML=`<div class="redesign-section-heading"><span class="b2-kicker">Практика навыков</span><h1>Тренировка учебных навыков</h1><p>Работающие модули и дополнительные материалы курса.</p></div><div class="redesign-practice-grid">${[['reading','Reading','Понимание текста'],['listening','Listening','Аудирование'],['writing','Writing','Письменная речь'],['speaking','Speaking','Устная речь'],['grammar','Grammar','Грамматика']].map(([id,name,sub])=>`<button data-practice="${id}"><strong>${name}</strong><b aria-hidden="true">↗</b></button>`).join('')}</div>`;
  const progressHead=create('redesign-progress-heading',progress);progressHead.innerHTML='<span class="b2-kicker">Твой учебный путь</span><h1>Прогресс и результаты</h1><p>Сохранённые результаты, проверки, ошибки и история обучения.</p>';
  progress.prepend(progressHead);
  const diagnostic=create('redesign-diagnostic',progress);diagnostic.className='redesign-resources';
  diagnostic.innerHTML='<h2>Дополнительная диагностика IELTS</h2><p class="system-sub">Учебная диагностика экзаменационного режима. Результат не определяет уровень B2 автоматически.</p>';
  const resources=()=>`<h3>Полезные ресурсы</h3><p class="system-sub">Дополнительные упражнения к основному курсу Empower.</p><div class="redesign-resource-links"><a href="https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2" target="_blank" rel="noopener noreferrer">British Council · B1–B2 Grammar ↗</a><a href="https://learnenglish.britishcouncil.org/free-resources/vocabulary/b1-b2" target="_blank" rel="noopener noreferrer">British Council · B1–B2 Vocabulary ↗</a></div>`;
  const useful=create('redesign-useful',home);useful.className='redesign-resources';useful.innerHTML=resources();
  const extra=create('redesign-practice-resources',practice);extra.className='redesign-resources';extra.innerHTML=resources();
  document.querySelectorAll('.nav,.mobile-nav').forEach(nav=>{
    nav.innerHTML=Object.entries(labels).map(([id,label])=>`<button type="button" data-section="${id}">${svg(id)}<span>${label}</span></button>`).join('');
  });
  const brand=document.querySelector('.brand');brand.innerHTML='<div class="redesign-header-title"><small id="redesign-header-date"></small><h1 id="redesign-page-title">Сегодня</h1></div>';
  const badge=document.querySelector('.streak');
  if(badge){
    const text=[...badge.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.includes('🔥'));
    if(text)text.textContent=text.textContent.replace('🔥','');
    const flame=document.createElement('span');flame.className='redesign-flame';flame.setAttribute('aria-hidden','true');
    flame.innerHTML='<svg viewBox="0 0 24 28"><path class="flame-outer" d="M13 1c1 6 8 8 8 15a9 9 0 0 1-18 0c0-4 2-7 5-10-1 5 1 6 2 6 3-2 4-6 3-11Z"/><path class="flame-inner" d="M12 13c0 4-4 5-4 9a4 4 0 0 0 8 0c0-3-3-5-4-9Z"/></svg>';
    badge.prepend(flame);
  }
  document.getElementById('redesign-header-date').textContent=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
  const move=(node,target)=>{if(node&&node.parentElement!==target)target.append(node);};
  const course=document.getElementById('textbook-plan-content');
  const observer=new MutationObserver(arrange);
  window.dailyEnglishBeforeRender=()=>{
    observer.disconnect();
    document.querySelectorAll('[data-redesign-relocated]').forEach(n=>n.remove());
    observer.observe(document.body,{childList:true,subtree:true});
  };
  function arrange(){
    observer.disconnect();
    const fresh=document.querySelector('#b2-foundation-content #b2-calendar-section');
    if(fresh){
      document.querySelectorAll('[data-redesign-relocated]').forEach(n=>n.remove());
      document.querySelectorAll('#b2-foundation-content > :not(.b2-today-head):not(.redesign-original-today):not(.b2-ielts-note)').forEach(n=>n.dataset.redesignRelocated='true');
      const road=fresh.querySelector('#redesign-roadmap-source');if(road)road.dataset.redesignRelocated='true';
    }
    move(document.getElementById('b2-calendar-section'),home);
    const calendar=document.getElementById('b2-calendar-section');if(calendar&&home.firstElementChild!==calendar)home.prepend(calendar);
    const calendarTitle=calendar?.querySelector('.b2-calendar-head h3');if(calendarTitle&&calendarTitle.textContent!=='Учебный календарь')calendarTitle.textContent='Учебный календарь';
    move(document.getElementById('study-mode-panel'),home);
    move(document.getElementById('selected-day-plan'),home);
    if(home.lastElementChild!==useful)home.append(useful);
    const plan=document.getElementById('selected-day-plan');if(plan)plan.hidden=JSON.parse(storageService.getItem('dailyEnglishSystemV2')||'{}').studyMode==='ielts';
    plan?.querySelectorAll('.b2-current-task').forEach(task => {
      const body = task.querySelector('.b2-task-body');
      if (!body) return;
      const assignment = body.querySelector('.b2-sb-assignment');
      if (assignment) body.before(assignment);
      body.remove();
    });
    const source=document.getElementById('b2-foundation-content');
    if(source)Array.from(source.children).forEach(node=>{
      if(node.matches('.b2-today-head,.redesign-original-today,.b2-ielts-note'))return;
      if(node.matches('.b2-course-details,.b2-course-summary'))move(node,course);
      else if(node.matches('.b2-optional,.b2-resources'))move(node,practice);
      else move(node,window.dailyEnglishHubProgressTarget?.(node)||progress);
    });
    move(document.getElementById('redesign-roadmap-source'),window.dailyEnglishHubProgressTarget?.()||progress);
    // Retain the original dashboard/IELTS controls in Progress, including diagnostics.
    Array.from(dash.children).forEach(node=>{if(node!==home&&node.id!=='b2-foundation-panel')move(node,progress);});
    const p=document.getElementById('progress-system');
    move(document.getElementById('open-diagnostic')?.closest('.buttonrow'),diagnostic);
    move(document.getElementById('grammar-daily'),practice);
    const legacyPlan=document.getElementById('daily-plan-system');
    const academic=JSON.parse(storageService.getItem('dailyEnglishSystemV2')||'{}').studyMode==='ielts';
    if(p)p.hidden=!academic;
    if(legacyPlan){legacyPlan.hidden=!academic;move(legacyPlan,academic?home:progress);}
    progress.querySelectorAll('.scoregrid,.targetbox,#roadmap').forEach(n=>{
      n.hidden=!academic;
      if(academic)n.style.removeProperty('display');
      if(n.previousElementSibling?.classList.contains('headingrow'))n.previousElementSibling.hidden=!academic;
    });
    const academicSide=progress.querySelector('.side');if(academicSide)academicSide.hidden=!academic;
    if(footer){
      if(app.lastElementChild!==footer)app.append(footer);
      const caption=academic?'IELTS Academic · ориентировочные учебные оценки':'B2 Foundation · Cambridge Empower · цель 15 февраля 2027';
      if(footer.textContent!==caption)footer.textContent=caption;
    }
    document.querySelectorAll('[data-section]').forEach(b=>{b.classList.toggle('active',b.dataset.section===current);b.setAttribute('aria-current',b.dataset.section===current?'page':'false');});
    document.getElementById('redesign-page-title').textContent=labels[current]||'Практика';
    window.dailyEnglishPlaceHub?.();
    observer.observe(document.body,{childList:true,subtree:true});
  }
  window.showView=function(name){
    current=['reading','listening','writing','speaking'].includes(name)?'practice':name;
    original(name);
    const view=document.getElementById('view-'+name);if(view)view.hidden=false;
    arrange();
  };
  document.addEventListener('click',event=>{
    const nav=event.target.closest('[data-section]');if(nav){showView(nav.dataset.section);return;}
    const skill=event.target.closest('[data-practice]');if(!skill)return;
    if(skill.dataset.practice==='grammar'){
      showView('practice');const grammar=document.getElementById('grammar-daily');
      if(grammar){grammar.hidden=false;grammar.scrollIntoView({behavior: (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'),block:'start'});}else document.getElementById('redesign-practice-resources').scrollIntoView({behavior: (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')});
    }else showView(skill.dataset.practice);
  });
  arrange();showView('dashboard');
})();
