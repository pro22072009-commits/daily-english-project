(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const focus = document.createElement('section'); focus.id = 'design-next'; focus.className = 'hub-panel';
  focus.innerHTML = '<span class="hub-chip">Следующий шаг</span><h2>Что делать сейчас</h2><p id="design-next-title"></p><button type="button" class="primary" id="design-start">Начать</button>';
  $('redesign-home').prepend(focus);
  function nextTask() {
    const plan = $('selected-day-plan');
    if (!plan || plan.hidden) return null;
    return [...plan.querySelectorAll('.b2-current-task')].find(task => {const input=task.querySelector('input[type=checkbox]');return input && !input.checked;});
  }
  function refresh() {
    const task=nextTask(), title=$('design-next-title');
    const text=task?.querySelector('.b2-task-title')?.textContent;
    const next=text || ($('selected-day-plan')?.hidden ? 'Выбери практику IELTS на сегодня.' : 'На выбранный день нет незавершённых заданий. Можно перейти к практике.');
    if(title.textContent!==next)title.textContent=next;
    const label=task?'Начать задание':'Открыть практику';
    if($('design-start').textContent!==label)$('design-start').textContent=label;
  }
  $('design-start').onclick=()=>{const task=nextTask();if(task){task.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});task.querySelector('input')?.focus({preventScroll:true});}else window.showView('writing');};
  const tools=document.createElement('div');tools.className='design-density';
  tools.innerHTML='<span>Календарь</span><button type="button" data-density="comfortable" aria-pressed="true">Обычный</button><button type="button" data-density="compact" aria-pressed="false">Компактный</button>';
  $('b2-calendar-section').before(tools);
  tools.onclick=event=>{const b=event.target.closest('[data-density]');if(!b)return;document.body.classList.toggle('design-compact',b.dataset.density==='compact');tools.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};
  const filter=document.createElement('div');filter.className='hub-fields design-filters';
  filter.innerHTML='<label>Навык<select id="design-skill"><option value="">Все навыки</option><option value="Writing">Writing</option><option value="Speaking">Speaking</option></select></label><label>Состояние<select id="design-status"><option value="">Все работы</option><option value="Черновик">Черновики</option><option value="Готово">Готовые</option></select></label><p id="design-filter-count" role="status"></p>';
  $('hub-work-list').before(filter);
  function filterWorks(){const buttons=[...$('hub-work-list').querySelectorAll('[data-hub-work]')];let count=0;for(const b of buttons){const meta=b.querySelector('span')?.textContent||'';const visible=(!$('design-skill').value||meta.startsWith($('design-skill').value))&&(!$('design-status').value||meta.includes(' · '+$('design-status').value+' · '));if(b.hidden===visible)b.hidden=!visible;if(visible)count++;}const text=`Показано работ: ${count}`;if($('design-filter-count').textContent!==text)$('design-filter-count').textContent=text;}
  filter.addEventListener('change',filterWorks);
  const details=document.createElement('details');details.id='design-progress-details';details.className='hub-panel';details.innerHTML='<summary>Учебный путь и библиотека работ</summary>';
  $('hub-week').after(details);
  // Existing placement hook owns progress order; keep its observer disconnected.
  const original=window.dailyEnglishPlaceHub;
  window.dailyEnglishPlaceHub=()=>{original?.();$('hub-week').after(details);details.append($('hub-unit-overview'),$('hub-works'));};
  window.dailyEnglishPlaceHub();
  const oldNew=$('hub-new-work');oldNew.addEventListener('click',()=>{details.open=true;});
  new MutationObserver(()=>{refresh();filterWorks();}).observe($('redesign-home'),{childList:true,subtree:true,attributes:true,attributeFilter:['checked','hidden']});
  new MutationObserver(filterWorks).observe($('hub-work-list'),{childList:true});
  document.addEventListener('change',refresh);
  refresh();filterWorks();
})();


