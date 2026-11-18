(() => {
  'use strict';

  const key = 'bonjour-francais-nclc7-goal-v1';
  const dayMs = 86_400_000;
  const hoursFormat = new Intl.NumberFormat('zh-CN', {maximumFractionDigits: 2});
  const isMinutes = value => Number.isSafeInteger(value) && value >= 0;

  function localDate(now = new Date()) {
    return [String(now.getFullYear()).padStart(4, '0'), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  }

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function freshGoal(today) {
    return {version: 1, targetMinutes: 60_000, totalMinutes: 0, startDate: today, deadline: '', lastEntry: null};
  }

  function checked(goal) {
    if (!goal || goal.version !== 1 || !isMinutes(goal.targetMinutes) || !goal.targetMinutes || !isMinutes(goal.totalMinutes)) {
      throw Error('请检查目标学时和已学时长，目标至少需要一分钟。');
    }
    if (!validDate(goal.startDate) || (goal.deadline !== '' && !validDate(goal.deadline))) throw Error('请选择有效日期。');
    if (goal.deadline && goal.deadline < goal.startDate) throw Error('截止日期应等于或晚于开始日期。');
    const entry = goal.lastEntry;
    if (entry !== null && !(entry && typeof entry.id === 'string' && isMinutes(entry.minutes) && entry.minutes > 0 && entry.minutes <= goal.totalMinutes)) {
      throw Error('最近一次学时记录无法读取。');
    }
    return goal;
  }

  function readGoal(storage, fallback) {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    try { return checked(JSON.parse(raw)); }
    catch { throw Error('浏览器中的目标记录无法读取。'); }
  }

  function addEntry(goal, minutes, id) {
    if (!isMinutes(minutes) || !minutes) throw Error('请输入至少 1 分钟的整分钟数。');
    return checked({...goal, totalMinutes: goal.totalMinutes + minutes, lastEntry: {minutes, id}});
  }

  function undoEntry(goal, expectedId) {
    if (!goal.lastEntry || goal.lastEntry.id !== expectedId) throw Error('最近的记录已变化，请查看最新学时。');
    return {...goal, totalMinutes: goal.totalMinutes - goal.lastEntry.minutes, lastEntry: null};
  }

  // Only apply the fields the user edited. An open settings dialog must not erase a later log.
  function editGoal(current, original, draft) {
    const result = {...current};
    for (const field of ['targetMinutes', 'totalMinutes', 'startDate', 'deadline']) {
      if (draft[field] === original[field]) continue;
      if (current[field] !== original[field] && current[field] !== draft[field]) {
        throw Error('另一标签页已修改这项记录，请关闭设置并重新打开。');
      }
      result[field] = draft[field];
      if (field === 'totalMinutes') result.lastEntry = null;
    }
    return checked(result);
  }

  function measures(goal, now = new Date()) {
    const study = Math.min(1, goal.totalMinutes / goal.targetMinutes);
    if (!goal.deadline) return {study, remaining: null, days: null, state: 'unconfigured'};
    const today = localDate(now);
    // Civil-day differences stay integral across daylight-saving transitions. The rail follows actual time.
    const days = Math.round((Date.parse(goal.deadline) - Date.parse(today)) / dayMs);
    const start = new Date(goal.startDate + 'T00:00:00').getTime();
    const end = new Date(goal.deadline + 'T00:00:00').getTime();
    let remaining = now < end ? 1 : 0;
    if (end > start) remaining = Math.max(0, Math.min(1, (end - now.getTime()) / (end - start)));
    const state = days < 0 ? 'overdue' : days === 0 ? 'due' : today < goal.startDate ? 'scheduled' : 'active';
    return {study, remaining, days: Math.max(0, days), state};
  }

  function percent(fraction) {
    // Reserve 100.0% for an attained endpoint, even when rounding a nearly complete goal.
    return (fraction >= 1 ? 100 : Math.min(99.9, fraction * 100)).toFixed(1);
  }

  let release = null;

  function mount(container) {
    container.replaceChildren(document.getElementById('goal-template').content.cloneNode(true));
    const board = container.querySelector('#goal-board');
    const byId = id => board.querySelector('#' + id);
    const action = name => board.querySelector('[data-goal-action="' + name + '"]');
    const settings = byId('goal-settings-form');
    const custom = byId('goal-custom-form');
    const dialog = byId('goal-dialog');
    const full = action('fullscreen');
    const studyBar = byId('goal-study-bar');
    const timeBar = byId('goal-time-bar');
    const abort = new AbortController();
    const listen = (element, event, callback) => element.addEventListener(event, callback, {signal: abort.signal});
    const initial = freshGoal(localDate());
    const oldTitle = document.title;
    let goal = initial;
    let original = goal;
    let clock, toast;
    let savingForm = false;

    document.body.classList.add('goal-active');
    document.title = 'NCLC 7 目标 · Bonjour Français';

    function announce(message, persistent = false) {
      const status = byId('goal-status');
      clearTimeout(toast);
      status.textContent = message;
      if (!persistent) toast = setTimeout(() => { status.textContent = ''; }, 3200);
    }

    function updateRail(rail, fraction, valueText) {
      rail.toggleAttribute('data-empty', fraction === null || (rail === timeBar && fraction === 0));
      if (fraction === null) rail.removeAttribute('aria-valuenow');
      else rail.setAttribute('aria-valuenow', percent(fraction));
      rail.setAttribute('aria-valuetext', valueText);
      rail.style.setProperty('--width', ((fraction ?? 0) * 100) + '%');
    }

    function paint() {
      const {study, remaining, days, state} = measures(goal);
      const total = hoursFormat.format(goal.totalMinutes / 60);
      const target = hoursFormat.format(goal.targetMinutes / 60);
      byId('goal-percent').textContent = percent(study);
      byId('goal-total').textContent = total;
      byId('goal-target').textContent = target;
      byId('goal-days').textContent = days === null ? '—' : String(days);
      const timeNote = {unconfigured: '选择截止日期，开始倒计时', overdue: '计划日期已过', due: '今天到期', scheduled: '计划尚未开始'};
      byId('goal-time-detail').textContent = timeNote[state] || '计划时间剩余 ' + percent(remaining) + '%';
      byId('goal-date-label').textContent = goal.deadline ? '调整日期' : '选择截止日期';
      for (const [id, value] of [['goal-start-label', goal.startDate], ['goal-end-label', goal.deadline]]) {
        const label = byId(id);
        if (value) label.dateTime = value;
        else label.removeAttribute('datetime');
        label.textContent = value ? value.replaceAll('-', '.') : '待设置';
      }
      const undo = action('undo');
      undo.disabled = !goal.lastEntry;
      const undoText = goal.lastEntry ? '撤销上次记录的 ' + goal.lastEntry.minutes + ' 分钟' : '撤销上次记录';
      undo.title = undoText;
      undo.setAttribute('aria-label', undoText);
      updateRail(studyBar, study, '已学 ' + total + ' 小时，目标 ' + target + ' 小时');
      updateRail(timeBar, remaining, days === null ? '待设置截止日期' : '剩余 ' + days + ' 天');
    }

    function storageError(error) {
      if (error.name === 'SecurityError' || error.name === 'QuotaExceededError') return '浏览器未能保存记录，请检查站点存储权限或可用空间。';
      return error.message || '未能保存目标记录。';
    }

    function reload() {
      try { goal = readGoal(window.localStorage, initial); }
      catch (error) { announce(storageError(error), true); }
      paint();
    }

    // Pages serves HTTPS, where Web Locks serialize changes across tabs. Read again inside each write.
    async function commit(change) {
      function write() {
        const storage = window.localStorage;
        const current = readGoal(storage, initial);
        const next = change(current);
        if (next !== current || storage.getItem(key) === null) storage.setItem(key, JSON.stringify(next));
        return next;
      }
      const next = navigator.locks ? await navigator.locks.request(key, write) : write();
      if (!abort.signal.aborted) { goal = next; paint(); }
    }

    function openForm(mode) {
      reload();
      original = goal;
      const isCustom = mode === 'custom';
      settings.hidden = isCustom;
      custom.hidden = !isCustom;
      byId('goal-dialog-title').textContent = isCustom ? '记录学习时长' : '目标设置';
      board.querySelectorAll('.goal-form-error').forEach(element => { element.textContent = ''; });
      settings.elements.targetHours.value = Number((goal.targetMinutes / 60).toFixed(2));
      settings.elements.totalHours.value = Number((goal.totalMinutes / 60).toFixed(2));
      settings.elements.startDate.value = goal.startDate;
      settings.elements.deadline.value = goal.deadline;
      custom.reset();
      dialog.showModal();
      const firstField = isCustom ? custom.elements.minutes : mode === 'dates' ? settings.elements.deadline : settings.elements.targetHours;
      firstField.focus();
    }

    function flash(rail) {
      const panel = rail.closest('.goal-panel');
      panel.classList.remove('is-progress-updated');
      // Reapply the one-shot animation on each saved entry, even during a previous sweep.
      void panel.offsetWidth;
      panel.classList.add('is-progress-updated');
    }

    async function log(minutes) {
      const id = globalThis.crypto?.randomUUID?.() ?? Date.now() + '-' + Math.random();
      await commit(current => addEntry(current, minutes, id));
      if (abort.signal.aborted) return;
      flash(studyBar);
      announce('已记入 ' + (minutes % 60 ? minutes + ' 分钟' : (minutes / 60) + ' 小时'));
    }

    function updateFullscreen() {
      const active = document.fullscreenElement === board;
      full.hidden = !document.fullscreenEnabled || typeof board.requestFullscreen !== 'function';
      full.title = active ? '退出全屏' : '进入全屏';
      full.setAttribute('aria-label', full.title);
      full.setAttribute('aria-pressed', String(active));
      full.querySelector('use').setAttribute('href', active ? '#goal-i-contract' : '#goal-i-expand');
    }

    listen(board, 'click', async event => {
      if (event.target === dialog) { dialog.close(); return; }
      const button = event.target.closest('[data-goal-action]');
      if (!button || button.disabled) return;
      const name = button.dataset.goalAction;
      try {
        if (['settings', 'dates', 'custom'].includes(name)) openForm(name);
        else if (name === 'close') dialog.close();
        else if (name === 'one' || name === 'two') await log(name === 'one' ? 60 : 120);
        else if (name === 'undo') {
          const id = goal.lastEntry?.id;
          await commit(current => undoEntry(current, id));
          if (!abort.signal.aborted) announce('已撤销上次学时记录');
        } else if (name === 'fullscreen') {
          if (document.fullscreenElement === board) await document.exitFullscreen();
          else await board.requestFullscreen();
        }
      } catch (error) {
        if (!abort.signal.aborted) announce(name === 'fullscreen' ? '当前窗口无法切换全屏。' : storageError(error));
      }
    });

    listen(dialog, 'submit', async event => {
      event.preventDefault();
      if (savingForm) return;
      savingForm = true;
      const form = event.target;
      const errorLabel = form.querySelector('.goal-form-error');
      errorLabel.textContent = '';
      try {
        if (form === custom) await log(custom.elements.minutes.valueAsNumber);
        else {
          const draft = {
            targetMinutes: Math.round(settings.elements.targetHours.valueAsNumber * 60),
            totalMinutes: Math.round(settings.elements.totalHours.valueAsNumber * 60),
            startDate: settings.elements.startDate.value,
            deadline: settings.elements.deadline.value
          };
          const baseline = original;
          const previous = goal;
          await commit(current => editGoal(current, baseline, draft));
          if (!abort.signal.aborted) {
            if (goal.deadline && (goal.startDate !== previous.startDate || goal.deadline !== previous.deadline)) flash(timeBar);
            announce('目标设置已保存');
          }
        }
        if (!abort.signal.aborted && dialog.open) dialog.close();
      } catch (error) { errorLabel.textContent = storageError(error); }
      finally { savingForm = false; }
    });

    function tick() {
      paint();
      clearTimeout(clock);
      clock = setTimeout(tick, 60_050 - Date.now() % 60_000);
    }
    listen(window, 'storage', event => { if (event.key === key || event.key === null) reload(); });
    listen(window, 'pageshow', reload);
    listen(document, 'visibilitychange', () => { if (!document.hidden) { reload(); tick(); } });
    listen(document, 'fullscreenchange', updateFullscreen);
    updateFullscreen();
    reload();
    tick();
    // Persist the initial start date even if the first visit ends before the first study session.
    commit(current => current).catch(error => { if (!abort.signal.aborted) announce(storageError(error), true); });

    release = () => {
      abort.abort();
      clearTimeout(clock); clearTimeout(toast);
      if (dialog.open) dialog.close();
      document.body.classList.remove('goal-active');
      document.title = oldTitle;
    };
  }

  function unmount() {
    if (release) { release(); release = null; }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {key, freshGoal, readGoal, addEntry, undoEntry, editGoal, measures, percent, localDate};
  } else {
    window.FRENCH_GOAL = {mount, unmount};
  }
})();
