'use strict';
const KEY = 'bonjour-francais-progress-v1';
const THEME_KEY = 'bonjour-francais-theme-v1';
const categories = [['route','学习路线'],['pronunciation','发音'],['vocabulary','词汇'],['grammar','语法'],['listening','听力'],['speaking','口语'],['reading','阅读'],['writing','写作'],['notebook','随手记'],['review','错题与收藏'],['resources','官方资源'],['draws','EE 邀请记录']];
const descriptions = {pronunciation:'按课次查发音、连读与听辨',vocabulary:'词性、性数、搭配与辨析',grammar:'完整结构表、变位与中文讲解',listening:'每课教材音频的听力任务',speaking:'按情景提问、回应并复述',reading:'读对话与资料，核对信息',writing:'按课次完成短文与改错'};
const main = document.getElementById('main');
const {vocabulary,resources,units} = window.COURSE_CONTENT;
const catalog = window.COURSE_LIBRARY.catalog;
const lesson14 = {...catalog.find(c=>c.number===14), ...window.LESSON14_CONTENT,
  categorySections:{grammar:['faire','questions','jobs','time','verbs','errors'], vocabulary:['jobs','words'], pronunciation:['sound'], reading:['phrases'], speaking:['phrases'], writing:['phrases','errors']},
  listening:'听第 14 课教材录音：第一遍辨认人物与地点；第二遍记职业、居住地、工作地、星期、时刻与交通方式；第三遍核对 faire、est-ce que、省音和 jours / fois；第四遍分角色跟读并用 4—6 句复述安排。'};
const courses = new Map([...window.COURSE_LIBRARY.lessons,lesson14].map(c=>[c.number,c]));
for(const course of courses.values())if(!course.exercises)course.exercises=[...course.sections.find(s=>s.id==='practice').html.matchAll(/<h3>([A-J])\. (.*?)<\/h3>([\s\S]*?)(?=<h3>|$)/g)].map(([,id,title,body])=>({id,title,html:`<h3>${id}. ${title}</h3>${body}`}));
const questions = [...window.COURSE_CONTENT.questions.map(q=>({...q,lesson:14})),...Array.from(courses.values()).flatMap(c=>c.quickQuestions.map(q=>({...q,lesson:c.number})))];
const validLessonNumber = n => Number.isInteger(n) && n>=1 && n<=36;
const emptyQuickNoteDraft = () => ({title:'',body:'',editingId:null});
const emptyState = () => ({version:1,completed:[],wrong:[],favorites:[],notes:{},attempts:{},currentLesson:null,quickNotes:[],quickNoteDraft:emptyQuickNoteDraft()});
function validQuickNotesState(s) {
  const list=s.quickNotes===undefined?[]:s.quickNotes;
  if(!Array.isArray(list)||!list.every(n=>n&&typeof n.id==='string'&&/^[a-z0-9-]{1,80}$/.test(n.id)&&typeof n.title==='string'&&typeof n.body==='string'&&n.body.trim()&&typeof n.createdAt==='string'&&Number.isFinite(Date.parse(n.createdAt))&&typeof n.updatedAt==='string'&&Number.isFinite(Date.parse(n.updatedAt))))return false;
  if(new Set(list.map(n=>n.id)).size!==list.length)return false;
  const draft=s.quickNoteDraft;
  return draft===undefined||(draft&&typeof draft.title==='string'&&typeof draft.body==='string'&&(draft.editingId===null||list.some(n=>n.id===draft.editingId)));
}
function validState(s) {return s && s.version===1 && (s.currentLesson===undefined || s.currentLesson===null || validLessonNumber(s.currentLesson)) && ['completed','wrong','favorites'].every(k=>Array.isArray(s[k])) && s.completed.every(n=>Number.isInteger(n)&&n>=1&&n<=36) && s.wrong.every(id=>questions.some(q=>q.id===id)) && s.favorites.every(n=>Number.isInteger(n)&&n>=1&&n<=36) && s.notes && typeof s.notes==='object' && !Array.isArray(s.notes) && Object.values(s.notes).every(v=>typeof v==='string') && s.attempts && typeof s.attempts==='object' && !Array.isArray(s.attempts) && validQuickNotesState(s);}
let state=emptyState(), storageAvailable=true, suppressVisitTracking=false;
try {const stored=JSON.parse(localStorage.getItem(KEY));if(validState(stored))state={...emptyState(),...stored};}catch {storageAvailable=false;}
function notify(message) {const el=document.getElementById('notice');el.textContent=message;el.classList.add('notice-visible');clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.classList.remove('notice-visible'),3500);}
function save() {try {localStorage.setItem(KEY,JSON.stringify(state));storageAvailable=true;return true;}catch {storageAvailable=false;notify('浏览器未能保存记录，请导出备份。');return false;}}
function escapeHtml(value) {return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function icon(name) {return `<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-${name==='notebook'?'writing':name}"></use></svg>`;}
function applyTheme(theme,persist=false) {
  const value=theme==='paper'?'paper':'glass',label=value==='glass'?'液态玻璃':'纸感书房';
  document.documentElement.dataset.theme=value;
  document.getElementById('theme-label').textContent=`配色：${label}`;
  document.getElementById('theme-toggle').setAttribute('aria-label',`切换配色，当前为${label}`);
  if(persist)try {localStorage.setItem(THEME_KEY,value);}catch {notify('配色已切换，但当前浏览器无法保存配色偏好。');}
}
let initialTheme='glass';
try {initialTheme=localStorage.getItem(THEME_KEY)==='paper'?'paper':'glass';}catch {}
applyTheme(initialTheme);
document.getElementById('theme-toggle').addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='glass'?'paper':'glass',true));
function external(url,label) {return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>`;}
function heading(k,title,description='') {return `<div class="eyebrow">${k}</div><h1>${title}</h1>${description?`<p class="subtle">${description}</p>`:''}`;}
function nextUnfinishedLesson(after=0) {
  const remaining=Array.from({length:36},(_,i)=>i+1).filter(n=>!state.completed.includes(n));
  return remaining.find(n=>n>after) || remaining[0] || null;
}
function learningLesson() {
  return state.currentLesson || nextUnfinishedLesson(state.completed.length?Math.max(...state.completed):0) || 36;
}
function defaultCourseNumber() {
  const n=learningLesson();
  return Array.from(courses.keys()).filter(v=>v<=n).sort((a,b)=>b-a)[0] || Math.min(...courses.keys());
}
function rememberLearningLesson(n) {
  if(validLessonNumber(n) && !state.completed.includes(n) && state.currentLesson!==n) {
    state.currentLesson=n;save();
  }
}
function navigation(page) {
  const selected=Number(location.hash.split('/')[1]),n=courses.has(selected)?selected:defaultCourseNumber();
  const links=items=>items.map(([id,label])=>`<a class="nav-link ${page===id?'active':''}" ${page===id?'aria-current="page"':''} href="#${id}${categories.slice(1,8).some(c=>c[0]===id)?'/'+n:''}">${icon(id)}<span>${label}</span></a>`).join('');
  document.getElementById('navigation').innerHTML=`<div class="nav-group"><p class="nav-label">学习</p>${links(categories.slice(0,8))}</div><div class="nav-group"><p class="nav-label">复习与资料</p>${links(categories.slice(8))}</div>`;
}
let routeUnit=null;
function note(id,prompt) {return `<section class="section"><h2>${prompt}</h2><textarea data-note="${id}" aria-label="${prompt}" placeholder="写下自己的表达、问题或复习要点…">${escapeHtml(state.notes[id]||'')}</textarea><div class="print-note" data-print-note="${id}">${escapeHtml(state.notes[id]||'（尚未填写）')}</div><p class="source-note">输入后自动保存在当前浏览器，可在“学习记录与备份”中导出。</p></section>`;}
function quiz(list=questions) {return list.map(q=>`<form class="question" data-question="${q.id}"><div class="eyebrow">第 ${q.lesson||14} 课</div><h3>${escapeHtml(q.question)}</h3><div class="answer-options">${q.options.map((v,i)=>`<label><input type="radio" name="answer" value="${i}" required> ${escapeHtml(v)}</label>`).join('')}</div><button class="button secondary" type="submit">检查答案</button><div class="feedback" aria-live="polite"></div><p class="print-answer">答案：${escapeHtml(q.options[q.answer])}。${escapeHtml(q.explanation)}</p></form>`).join('');}
function route() {
  const n=learningLesson(),meta=catalog.find(c=>c.number===n),done=state.completed.includes(n);
  const allDone=Array.from({length:36},(_,i)=>i+1).every(v=>state.completed.includes(v));
  const title=allDone?'A1课次已全部标记完成。':done?`回顾第 ${n} 课。`:state.currentLesson||state.completed.length?`继续第 ${n} 课。`:'从第 1 课开始。';
  const reason=allDone?'可以选择已学课程回顾，或整理错题和笔记。':state.currentLesson?'沿着教材继续学习，也可以随时调整当前课次。':state.completed.length?'根据已完成课次推荐；可以手动调整。':'一点一点，把法语用起来。从第1课开始，或选择你正在学的课次。';
  const unit=routeUnit||Math.ceil(n/4),first=(unit-1)*4+1;
  return `<header class="page-heading">${heading('VOTRE PARCOURS DE FRANÇAIS',title,reason)}</header>
    <section class="hero"><div class="hero-content">
      <span class="tag">A1 · LEÇON ${String(n).padStart(2,'0')}${courses.has(n)?'':' · 教材笔记'}</span>
      <h2${meta?' lang="fr"':''}>${meta?escapeHtml(meta.title):`第 ${n} 课 · 教材学习记录`}</h2>
      <p class="subtle">${meta?escapeHtml(meta.translation+' · '+meta.core.slice(0,2).join(' · ')):'详细讲义待补充，可以结合教材记录笔记。'}</p>
      <div class="hero-actions"><a class="button" href="#lesson/${n}">${done?'回顾本课':'继续学习'} →</a><button class="button quiet" type="button" data-complete="${n}">${done?'已完成 ✓ · 撤销':'标记本课完成'}</button></div>
      <label class="learning-choice" for="learning-course">当前学习课次 <span class="learning-select"><select id="learning-course">${Array.from({length:36},(_,i)=>i+1).map(v=>{const c=catalog.find(c=>c.number===v);return `<option value="${v}" ${n===v?'selected':''}>第 ${v} 课${c?' · '+escapeHtml(c.title):' · 教材笔记'}${state.completed.includes(v)?' · 已完成':''}</option>`;}).join('')}</select><svg class="learning-select-arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4"/></svg></span></label>
    </div><div class="hero-number" aria-hidden="true"><span>${String(n).padStart(2,'0')}</span><small>LEÇON / 36</small></div></section>
    <section class="section route-section" aria-labelledby="route-title"><div class="section-heading"><h2 id="route-title">教材路线</h2><span class="source-note">已标记完成 ${state.completed.length} / 36 课</span></div>
      <div class="unit-picker" role="group" aria-label="选择教材单元">${units.map((name,i)=>{const u=i+1;return `<button class="unit-button" type="button" data-unit="${u}" aria-pressed="${unit===u}"><strong lang="fr">UNITÉ ${u}</strong><span class="unit-name" lang="fr">${escapeHtml(name)}</span><small>${String((u-1)*4+1).padStart(2,'0')}–${String(u*4).padStart(2,'0')} 课</small></button>`;}).join('')}</div>
      <h3 class="unit-heading"><span lang="fr">UNITÉ ${unit} · ${escapeHtml(units[unit-1])}</span></h3>
      <div class="chapter-grid">${Array.from({length:4},(_,i)=>first+i).map(v=>{const c=catalog.find(c=>c.number===v),completed=state.completed.includes(v);return `<a href="#lesson/${v}" class="chapter-card ${v===n?'current':''} ${completed?'done':''}" ${v===n?'aria-current="step"':''}><span class="chapter-number">${String(v).padStart(2,'0')}<span aria-hidden="true">${completed?'✓':v===n?'·':''}</span></span><strong${c?' lang="fr"':''}>${c?escapeHtml(c.title):`第 ${v} 课`}</strong><span class="chapter-status">${completed?'已完成':v===n?'当前学习':'未开始'} · ${courses.has(v)?'详细讲义':'教材笔记'}</span></a>`;}).join('')}</div>
      <p class="source-note">第 ${first}–${first+3} 课 · 打开课程不会自动标记完成。${first+3>15?'第16课及以后的详细讲义正在补充，可先结合教材记录笔记。':''}</p>
    </section>
    <section class="section study-shortcuts" aria-labelledby="shortcuts-title"><div class="section-heading"><h2 id="shortcuts-title">在这里积累</h2><span class="source-note">学过的内容，随时回看</span></div><div class="two">
      <a class="study-shortcut" href="#review">${icon('review')}<div><h3>复习清单 →</h3><p>${state.wrong.length} 道待复习错题 · ${state.favorites.length} 节收藏课程</p></div></a>
      <a class="study-shortcut" href="#settings">${icon('grammar')}<div><h3>学习记录与备份 →</h3><p>保存你的笔记与学习痕迹</p></div></a>
    </div></section>
    <section class="section"><div class="section-heading"><h2>所有学习分类</h2><span class="source-note">随时查，也能按课学</span></div><div class="skill-grid">${categories.slice(1,8).map(([id,label])=>`<a class="skill-link" href="#${id}/${defaultCourseNumber()}">${icon(id)}<div><h3>${label} →</h3><p>${descriptions[id]}</p></div></a>`).join('')}</div></section>
    <section class="section"><h2>走向 NCLC 7</h2><div class="roadmap"><div class="current">A1 教材学习<small>当前阶段</small></div><div>A2 巩固<small>后续补充</small></div><div>中级综合训练<small>听说读写</small></div><div>考试专项<small>按四项成绩核对 NCLC</small></div></div><p class="source-note">课程完成记录用于安排学习。语言等级通过对应评估或考试成绩确认。</p></section>
    <details class="course-directory section"><summary>前 ${Math.max(...catalog.map(c=>c.number))} 课 · 教材路线 <span class="source-note">完整讲义目录</span></summary><div class="course-list">${catalog.map(c=>`<a class="course-entry" href="#lesson/${c.number}"><span class="course-entry-number">${String(c.number).padStart(2,'0')}</span><div><h3>${escapeHtml(c.title)} · ${escapeHtml(c.translation)} →</h3><p>${escapeHtml(c.core.join(' · '))}</p></div></a>`).join('')}</div></details>
    <section class="section"><div class="section-heading"><h2>A1 课次记录</h2><span class="source-note">共36课</span></div><p class="source-note">第1—15课已提供详细讲义，其余课次可先保留教材笔记。课次完成记录由你确认。</p><div class="lessons">${Array.from({length:36},(_,i)=>i+1).map(v=>`<a href="#lesson/${v}" class="lesson-link ${v===n?'current':''} ${state.completed.includes(v)?'done':''}" aria-label="第 ${v} 课${state.completed.includes(v)?'，已完成':''}">${String(v).padStart(2,'0')}${state.completed.includes(v)?' ✓':''}</a>`).join('')}</div></section>`;
}
function knowledge(ids,course=lesson14) {
  const wanted=ids||course.sections.map(s=>s.id);
  return `<div class="lesson-notes">${wanted.map(id=>{const section=course.sections.find(s=>s.id===id);return `<section class="knowledge-section" id="lesson${course.number}-${id}" aria-labelledby="title-${course.number}-${id}">${section.html.replace('<h2>',`<h2 id="title-${course.number}-${id}">`)}</section>`;}).join('')}</div>`;
}
function writtenPractice(letters,course=lesson14) {return `<section class="lesson-notes knowledge-section"><h2>书面练习与参考答案</h2><p class="subtle">先在笔记中作答，再展开答案核对。</p>${course.exercises.filter(e=>letters.includes(e.id)).map(e=>e.html).join('')}</section>`;}
function quickCheck(list,n=14) {const qs=list||questions.filter(q=>q.lesson===n);return `<section class="section" id="lesson${n}-quick-check"><h2>即时小测 · ${qs.length} 题</h2><p class="subtle">提交后查看解析，答错的题会自动进入“错题与收藏”。开放任务请按参考答案和自查标准检查。</p>${quiz(qs)}</section>`;}
function lesson(n) {
  const course=courses.get(n),meta=catalog.find(c=>c.number===n),done=state.completed.includes(n),favorite=state.favorites.includes(n);
  const qs=questions.filter(q=>q.lesson===n);
  return heading(`LEÇON ${String(n).padStart(2,'0')}`,meta?`${escapeHtml(meta.title)} · ${escapeHtml(meta.translation)}`:`第 ${n} 课 · 教材学习记录`,course?`详细复习讲义 · ${course.sections.length} 个模块 · ${course.exercises.length} 组书面练习与解析 · ${qs.length} 道即时小测`:'本课详细讲义正在补充；可以先结合教材记录笔记。')+
  `<div class="toolbar"><button class="button" data-complete="${n}">${done?'已完成 ✓ · 撤销':'标记本课完成'}</button><button class="button secondary" data-favorite="${n}">${favorite?'已收藏 ★ · 取消':'收藏本课'}</button><a href="#route">回到学习路线</a></div>`+
  (course?`<div class="toolbar lesson-actions"><button class="button secondary" data-print>打印 / 另存为 PDF（含答案）</button><button class="button secondary" data-answers="open">展开全部参考答案</button><button class="button secondary" data-answers="close">收起全部参考答案</button></div><nav class="lesson-toc" aria-label="第 ${n} 课知识目录"><h2>本课目录</h2><div>${course.sections.map(section=>`<a href="#lesson/${n}/${section.id}">${escapeHtml(section.title.replace(' / ',' · '))}</a>`).join('')}<a href="#lesson/${n}/quick-check">即时小测 · ${qs.length} 题</a></div></nav>`+knowledge(course.sections.filter(s=>s.id!=='review').map(s=>s.id),course)+quickCheck(qs,n)+knowledge(['review'],course)+`<section class="section"><h2>按技能继续练习</h2><div class="grid">${['listening','speaking','reading','writing'].map(id=>`<a class="card card-link" href="#${id}/${n}"><h3>${categories.find(c=>c[0]===id)[1]} →</h3><p>第 ${n} 课 · ${descriptions[id]}</p></a>`).join('')}</div></section>`:'')+note(`lesson-${n}`,'本课笔记');
}
function categoryPage(kind,arg) {
  const n=arg===undefined?defaultCourseNumber():Number(arg),course=courses.get(n),label=categories.find(c=>c[0]===kind)[1];
  if(!course)return heading('A1',label)+`<div class="empty">第 ${escapeHtml(arg)} 课的详细内容正在补充。<p><a href="#${kind}/${defaultCourseNumber()}">查看第 ${defaultCourseNumber()} 课 →</a></p></div>`;
  let html=heading(`A1 · LEÇON ${String(n).padStart(2,'0')}`,label,`${escapeHtml(course.title)} · ${escapeHtml(course.translation)}`)+`<div class="toolbar"><label>选择课次 <select id="course-select" data-category="${kind}">${Array.from(courses.values()).sort((a,b)=>a.number-b.number).map(c=>`<option value="${c.number}" ${n===c.number?'selected':''}>第 ${c.number} 课 · ${escapeHtml(c.title)}</option>`).join('')}</select></label><a href="#lesson/${n}">查看本课完整讲义 →</a></div>`;
  const sectionMap=course.categorySections;
  if(kind==='listening')html+=`<section class="knowledge-section"><h2>第 ${n} 课音频 · 听辨、核对与复述</h2><p>${external(resources[4][2],'打开出版方配套音频与视频')}，按手中教材的课次和音轨编号找到录音。</p><p>${escapeHtml(course.listening)}</p><h3>复听记录</h3><p>写下第一遍确定的信息、第二遍补上的信息、对照原文后发现的错误，以及准备模仿的两句话。每次跟读时先听整句，再暂停复述。</p></section>`+knowledge(sectionMap.pronunciation,course);
  else html+=knowledge(sectionMap[kind],course);
  const groups={grammar:['A','B','D','I'],vocabulary:['C'],pronunciation:['H'],reading:['G'],speaking:['E','J'],writing:['F','I']};
  if(groups[kind])html+=writtenPractice(groups[kind],course);
  const qs=questions.filter(q=>q.lesson===n&&(q.group===kind||(kind==='grammar'&&!q.group)));
  if(qs.length)html+=quickCheck(qs,n);
  if(['listening','speaking','reading','writing'].includes(kind))html+=note(n===14?kind:`${kind}-${n}`,`第 ${n} 课 · 我的${label}练习`);
  return html;
}
let notebookQuery='';
function quickNoteTime(value) {return new Date(value).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function notebookList() {
  const term=notebookQuery.trim().toLocaleLowerCase();
  const list=[...state.quickNotes].sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)).filter(n=>(n.title+' '+n.body).toLocaleLowerCase().includes(term));
  if(!list.length)return `<div class="empty">${term?'没有找到匹配的记录，试试其他关键词。':'还没有记录。随手记下一个词、一句话，或今天想到的问题。'}</div>`;
  return list.map(n=>`<article class="card quick-note" id="quick-note-${n.id}" aria-labelledby="quick-note-title-${n.id}"><h3 id="quick-note-title-${n.id}">${escapeHtml(n.title||'未命名记录')}</h3><p class="source-note"><time datetime="${escapeHtml(n.updatedAt)}">更新于 ${quickNoteTime(n.updatedAt)}</time></p><div class="quick-note-body">${escapeHtml(n.body)}</div><div class="toolbar quick-note-actions"><button type="button" class="button secondary" data-quick-note-edit="${n.id}" aria-label="编辑：${escapeHtml(n.title||'未命名记录')}">编辑</button><button type="button" class="button quiet" data-quick-note-delete="${n.id}" aria-label="删除：${escapeHtml(n.title||'未命名记录')}">删除</button></div></article>`).join('');
}
function notebook() {
  const draft=state.quickNoteDraft,editing=Boolean(draft.editingId);
  return heading('MON CARNET','随手记','遇到的词、想到的句子、想问的问题，都可以记在这里。')+`<div class="notebook-layout">
    <section class="card notebook-editor" aria-labelledby="notebook-editor-title"><h2 id="notebook-editor-title">${editing?'编辑记录':'记一笔'}</h2>
      <form id="quick-note-form"><label for="quick-note-title">标题 <span class="subtle">（可选）</span></label><input id="quick-note-title" class="quick-note-title" data-quick-note-field="title" type="text" placeholder="给这条记录起个名字" value="${escapeHtml(draft.title)}">
      <label for="quick-note-body">内容</label><textarea id="quick-note-body" data-quick-note-field="body" placeholder="例如：aujourd’hui 的拼写、想练习的一句话…" required>${escapeHtml(draft.body)}</textarea>
      <p id="quick-note-status" class="source-note" role="status">${!storageAvailable?'草稿暂未保存到浏览器，请保留页面并导出备份。':draft.title||draft.body?'草稿已自动保存，点击下方按钮保存为记录。':'输入后自动保存草稿。'}</p>
      <div class="toolbar"><button type="submit" class="button">${editing?'保存修改':'保存记录'}</button><button type="button" class="button quiet" id="quick-note-reset">${editing?'取消编辑':'清空草稿'}</button></div></form>
      <p class="source-note">保存在当前浏览器。可在<a href="#settings">学习记录与备份</a>中一起导出。</p>
    </section>
    <section class="notebook-records" aria-labelledby="notebook-records-title"><div class="section-heading"><h2 id="notebook-records-title">我的记录</h2><span class="source-note">共 ${state.quickNotes.length} 条</span></div>
      <label class="notebook-filter" for="quick-note-search">查找记录<input id="quick-note-search" type="search" placeholder="搜索标题或内容" value="${escapeHtml(notebookQuery)}" aria-controls="quick-note-list"></label><div id="quick-note-list" class="quick-note-list">${notebookList()}</div>
    </section></div>`;
}
function persistQuickNotes(list,draft) {
  const previousList=state.quickNotes,previousDraft=state.quickNoteDraft;
  state.quickNotes=list;state.quickNoteDraft=draft;
  if(save())return true;
  state.quickNotes=previousList;state.quickNoteDraft=previousDraft;
  const status=document.getElementById('quick-note-status');
  if(status)status.textContent='未能保存，请保留草稿并导出备份。';
  return false;
}
function quickNoteDraftChanged() {
  const draft=state.quickNoteDraft,original=state.quickNotes.find(n=>n.id===draft.editingId);
  return original?draft.title!==original.title||draft.body!==original.body:Boolean(draft.title||draft.body);
}
function submitQuickNote() {
  const draft=state.quickNoteDraft;
  if(!draft.body.trim()){notify('先写一点内容再保存。');return;}
  const now=new Date().toISOString(),original=state.quickNotes.find(n=>n.id===draft.editingId);
  let id=original?.id;
  if(!id)do {id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}while(state.quickNotes.some(n=>n.id===id));
  const entry={id,title:draft.title.trim(),body:draft.body,createdAt:original?.createdAt||now,updatedAt:now};
  const list=[entry,...state.quickNotes.filter(n=>n.id!==id)];
  if(persistQuickNotes(list,emptyQuickNoteDraft())){render();document.getElementById('quick-note-body')?.focus?.();notify(original?'记录已更新':'记录已保存');}
}
function quickNoteAction(button) {
  const editingId=button.dataset.quickNoteEdit,deletingId=button.dataset.quickNoteDelete;
  if(editingId) {
    const entry=state.quickNotes.find(n=>n.id===editingId);
    if(!entry||state.quickNoteDraft.editingId===editingId)return;
    if(quickNoteDraftChanged()&&!confirm('当前草稿尚未保存为记录。放弃草稿并编辑这条记录？'))return;
    if(persistQuickNotes(state.quickNotes,{title:entry.title,body:entry.body,editingId})){render();document.getElementById('quick-note-body')?.focus?.();}
  } else if(deletingId) {
    if(!state.quickNotes.some(n=>n.id===deletingId)||!confirm('删除这条随手记？删除后无法恢复。'))return;
    const draft=state.quickNoteDraft.editingId===deletingId?emptyQuickNoteDraft():state.quickNoteDraft;
    if(persistQuickNotes(state.quickNotes.filter(n=>n.id!==deletingId),draft)){render();notify('记录已删除');}
  } else if(button.id==='quick-note-reset') {
    if(quickNoteDraftChanged()&&!confirm('清空当前未保存的草稿？'))return;
    if(persistQuickNotes(state.quickNotes,emptyQuickNoteDraft())){render();document.getElementById('quick-note-body')?.focus?.();}
  }
}
let drawData=null,drawLoading=false,drawError=false,drawType='',drawYear='',drawPage=0;
async function loadDraws() {if(drawData||drawLoading)return;drawLoading=true;try {const response=await fetch('data/draws.json');if(!response.ok)throw Error('无法读取邀请记录');const data=await response.json();if(!Array.isArray(data.rounds))throw Error('数据格式错误');drawData=data;}catch {drawError=true;}finally {drawLoading=false;if(location.hash==='#draws')render();}}
function draws() {loadDraws();const header=heading('EXPRESS ENTRY','EE 邀请记录','从官方记录观察轮次、类别、最低获邀 CRS 分数与邀请数量。');if(!drawData)return header+`<div class="empty">${drawError?'记录暂时无法读取，请稍后重试或查看官方页面。':'正在读取官方记录…'}</div><p>${external(resources[2][2],'打开 IRCC 官方邀请页面')}</p>`;const all=drawData.rounds,types=[...new Set(all.map(r=>r.category))].sort(),years=[...new Set(all.map(r=>r.date.slice(0,4)))].sort().reverse();const filtered=all.filter(r=>(!drawType||r.category===drawType)&&(!drawYear||r.date.startsWith(drawYear)));drawPage=Math.max(0,Math.min(drawPage,Math.max(0,Math.ceil(filtered.length/20)-1)));const shown=filtered.slice(drawPage*20,drawPage*20+20);const recent=filtered.slice(0,12).reverse();return header+`<p class="source-note">最近成功检查：${escapeHtml(drawData.checked_at||'尚未检查')} · ${all.length} 条历史记录 · 时间保留官方 UTC</p><div class="toolbar"><label>类别 <select id="draw-type"><option value="">全部类别</option>${types.map(t=>`<option ${drawType===t?'selected':''} value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}</select></label><label>年份 <select id="draw-year"><option value="">全部年份</option>${years.map(y=>`<option ${drawYear===y?'selected':''}>${y}</option>`).join('')}</select></label><button class="button secondary" id="french-only">只看法语类别</button></div>${drawType&&recent.length?`<section class="card"><h3>所选类别 · 最近 ${recent.length} 轮最低 CRS</h3><div class="chart" role="img" aria-label="${escapeHtml(recent.map(r=>r.date+'：'+r.crs).join('；'))}">${recent.map(r=>`<div class="bar-item">${r.crs}<div class="bar" style="height:${Math.round(r.crs/1200*110)}px"></div>${escapeHtml(r.date.slice(5))}</div>`).join('')}</div></section>`:''}<div class="table-scroll section"><table><thead><tr><th>轮次</th><th>日期 / UTC 时间</th><th>类别</th><th>最低 CRS</th><th>邀请数量</th><th>详情</th></tr></thead><tbody>${shown.map(r=>`<tr><td>#${r.id}</td><td>${escapeHtml(r.date)}<br><small>${escapeHtml(r.time||'')}</small></td><td>${escapeHtml(r.category)}</td><td>${r.crs}</td><td>${r.invitations.toLocaleString('zh-CN')}</td><td>${external(r.source,'官方')}<details><summary>同分排序</summary>${escapeHtml(r.tie_breaking||'官网未提供')}</details></td></tr>`).join('')||'<tr><td colspan="6">没有符合筛选条件的记录。</td></tr>'}</tbody></table></div><div class="pager"><button class="button secondary" data-page="-1" ${drawPage===0?'disabled':''}>上一页</button><span>${drawPage+1} / ${Math.max(1,Math.ceil(filtered.length/20))} · ${filtered.length} 条</span><button class="button secondary" data-page="1" ${(drawPage+1)*20>=filtered.length?'disabled':''}>下一页</button></div><p class="source-note">首版记录联邦 EE 轮次，包括 EE 中的 PNP 专属轮次。各省独立邀请另行记录。以每轮官方详情为核对来源。</p>`;}
function settings() {return heading('MES DONNÉES','学习记录与备份','保留你自己的学习痕迹。')+`<div class="card prose"><h2>当前浏览器中的记录</h2><p>${state.completed.length} 课完成记录 · ${state.wrong.length} 道错题 · ${Object.keys(state.notes).length} 份课后笔记 · ${state.quickNotes.length} 条随手记${state.quickNoteDraft.title||state.quickNoteDraft.body?' · 1 份随手记草稿':''}</p><p>更换浏览器、清除网站数据或迁移网站地址前，请导出备份。备份文件包含课后笔记、随手记及未完成草稿，请保存在自己的电脑上。</p><div class="toolbar"><button class="button" id="export">导出学习记录</button><label class="button secondary">导入备份<input id="import" type="file" accept="application/json,.json" hidden></label></div></div>`;}
function render() {const [page,arg,section]=(location.hash.slice(1)||'route').split('/');if(!suppressVisitTracking&&(page==='lesson'||(categories.slice(1,8).some(c=>c[0]===page)&&courses.has(Number(arg)))))rememberLearningLesson(Number(arg));suppressVisitTracking=false;main.className=page==='lesson'||categories.slice(1,8).some(c=>c[0]===page)?'reading-page':'';document.getElementById('page-location').textContent=page==='lesson'?`A1 / 第 ${arg} 课`:page==='settings'?'学习记录与备份':`A1 / ${categories.find(c=>c[0]===page)?.[1]||'学习路线'}`;navigation(page==='lesson'?'route':page);document.getElementById('search').value='';if(page==='route')main.innerHTML=route();else if(page==='lesson'){const n=Number(arg);main.innerHTML=Number.isInteger(n)&&n>=1&&n<=36?lesson(n):heading('','找不到这节课');}else if(categories.slice(1,8).some(c=>c[0]===page))main.innerHTML=categoryPage(page,arg);else if(page==='review')main.innerHTML=heading('RÉVISION','错题与收藏','答对的错题会从待复习列表中移除。')+`<section class="section"><h2>收藏课程</h2>${state.favorites.length?state.favorites.map(n=>`<p><a href="#lesson/${n}">第 ${n} 课${catalog.find(c=>c.number===n)?' · '+escapeHtml(catalog.find(c=>c.number===n).title):''} →</a></p>`).join(''):'<p class="subtle">在课程页面点击“收藏本课”。</p>'}</section><section class="section"><h2>待复习错题</h2>${state.wrong.length?quiz(questions.filter(q=>state.wrong.includes(q.id))):'<div class="empty">目前没有待复习错题。继续学一课吧。<p><a href="#route">回到学习路线 →</a></p></div>'}</section>`;else if(page==='resources')main.innerHTML=heading('RESSOURCES','官方资源','学习标准、教材资源与加拿大官方信息。')+`<div class="links">${resources.map(r=>`<div class="card">${external(r[2],r[0])}<p class="subtle">${r[1]}</p></div>`).join('')}</div>`;else if(page==='draws')main.innerHTML=draws();else if(page==='notebook'){if(arg)notebookQuery='';main.innerHTML=notebook();}else if(page==='settings')main.innerHTML=settings();else main.innerHTML=heading('','找不到这个页面')+'<a href="#route">返回学习路线</a>';if(section&&page==='lesson')document.getElementById(`lesson${Number(arg)}-${section}`)?.scrollIntoView();if(page==='notebook'&&arg)document.getElementById(`quick-note-${arg}`)?.scrollIntoView();if(!storageAvailable)main.insertAdjacentHTML('afterbegin','<p role="alert">浏览器存储暂不可用，学习记录可能无法保留，请及时导出备份。</p>');}
main.addEventListener('submit',e=>{if(e.target.id==='quick-note-form'){e.preventDefault();submitQuickNote();return;}const form=e.target.closest('[data-question]');if(!form)return;e.preventDefault();const q=questions.find(q=>q.id===form.dataset.question),value=new FormData(form).get('answer');if(value===null)return;const correct=Number(value)===q.answer;state.attempts[q.id]=correct;state.wrong=state.wrong.filter(id=>id!==q.id);if(!correct)state.wrong.push(q.id);save();const feedback=form.querySelector('.feedback');feedback.className=`feedback ${correct?'correct':'wrong'}`;feedback.textContent=(correct?'答对了。':'再想一想。正确答案：'+q.options[q.answer]+(/[.!?。！？]$/.test(q.options[q.answer])?' ':'。'))+q.explanation;});
main.addEventListener('input',e=>{
  if(e.target.id==='quick-note-search'){notebookQuery=e.target.value;document.getElementById('quick-note-list').innerHTML=notebookList();return;}
  const field=e.target.dataset.quickNoteField;
  if(field==='title'||field==='body'){
    state.quickNoteDraft[field]=e.target.value;
    const saved=save(),status=document.getElementById('quick-note-status');
    if(status)status.textContent=saved?'草稿已自动保存，点击下方按钮保存为记录。':'草稿暂未保存到浏览器，请保留页面并导出备份。';
    return;
  }
  if(e.target.dataset.note){state.notes[e.target.dataset.note]=e.target.value;const printed=main.querySelector(`[data-print-note="${e.target.dataset.note}"]`);if(printed)printed.textContent=e.target.value||'（尚未填写）';save();}});
main.addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;if(button.dataset.quickNoteEdit||button.dataset.quickNoteDelete||button.id==='quick-note-reset'){quickNoteAction(button);return;}if(button.dataset.unit){const unit=Number(button.dataset.unit);if(Number.isInteger(unit)&&unit>=1&&unit<=9){routeUnit=unit;render();}return;}if(button.hasAttribute('data-print'))window.print();if(button.dataset.answers){main.querySelectorAll('.lesson-notes details').forEach(d=>d.open=button.dataset.answers==='open');}if(button.dataset.complete){const n=Number(button.dataset.complete);if(!validLessonNumber(n))return;const wasDone=state.completed.includes(n);state.completed=wasDone?state.completed.filter(v=>v!==n):[...state.completed,n];state.currentLesson=wasDone?n:(nextUnfinishedLesson(n)||n);save();suppressVisitTracking=true;render();}if(button.dataset.favorite){const n=Number(button.dataset.favorite);state.favorites=state.favorites.includes(n)?state.favorites.filter(v=>v!==n):[...state.favorites,n];save();render();}if(button.dataset.page){drawPage+=Number(button.dataset.page);render();}if(button.id==='french-only'){drawType=drawData?.rounds.find(r=>r.category==='法语能力类别')?.category||'';drawPage=0;render();}if(button.id==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='bonjour-francais-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}});
main.addEventListener('change',async e=>{if(e.target.id==='learning-course'){const n=Number(e.target.value);if(!validLessonNumber(n))return;state.currentLesson=n;save();render();document.getElementById('learning-course')?.focus?.();return;}if(e.target.id==='course-select'){location.hash=`#${e.target.dataset.category}/${e.target.value}`;return;}if(e.target.id==='draw-type'){drawType=e.target.value;drawPage=0;render();}if(e.target.id==='draw-year'){drawYear=e.target.value;drawPage=0;render();}if(e.target.id==='import'){const file=e.target.files[0];if(!file)return;try {if(file.size>5_000_000)throw Error('备份文件过大');const imported=JSON.parse(await file.text());if(!validState(imported))throw Error('这不是有效的学习记录备份');if(!confirm('导入将替换当前浏览器中的学习记录，是否继续？'))return;const previous=state;state={...emptyState(),...imported};if(!save()){state=previous;return;}suppressVisitTracking=true;render();notify('学习记录已导入');}catch(error){notify(error.message);}}});
document.getElementById('search').addEventListener('input',e=>{const term=e.target.value.trim().toLocaleLowerCase();if(!term){render();return;}const entries=[...categories.slice(1,8).map(([id,label])=>[label,descriptions[id],`#${id}`]),...vocabulary.map(v=>[v[0],v[1]+' '+v[2],'#vocabulary']),...resources.map(r=>[r[0],r[1],'#resources']),...Array.from(courses.values()).flatMap(c=>c.sections.map(s=>[`第 ${c.number} 课 · ${s.title}`,plainText(s.html),`#lesson/${c.number}/${s.id}`])),...state.quickNotes.map(n=>[n.title||'未命名记录',n.body,`#notebook/${n.id}`]),...catalog.map(c=>[`${c.title} ${c.translation}`,`第${c.number}课 `+c.core.join(' '),`#lesson/${c.number}`])];main.className='';document.getElementById('page-location').textContent='RECHERCHE / 搜索结果';const matches=entries.filter(r=>(r[0]+' '+r[1]).toLocaleLowerCase().includes(term));main.innerHTML=heading('RECHERCHE','搜索结果')+`<p class="subtle">${matches.length} 项匹配</p><div class="links">${matches.map(r=>`<a class="card card-link" href="${r[2]}"><h3>${escapeHtml(r[0])} →</h3><p>${escapeHtml(searchExcerpt(r[1],term))}</p></a>`).join('')||'<div class="empty">没有找到匹配内容，试试“职业”“时间”或“faire”。</div>'}</div>`;});
function plainText(html) {return html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
function searchExcerpt(text,term) {const found=text.toLocaleLowerCase().indexOf(term);const start=Math.max(0,found-35);return (start?'…':'')+text.slice(start,start+140)+(text.length>start+140?'…':'');}
// In-page lesson navigation preserves selected answers and opened reference panels.
window.addEventListener('hashchange',e=>{
  const from=(e.oldURL||'').split('#')[1]||'',to=location.hash.slice(1);
  const previous=from.split('/'),next=to.split('/');
  if(previous[0]==='lesson'&&next[0]==='lesson'&&previous[1]===next[1]&&next[2]&&!document.getElementById('search').value){document.getElementById(`lesson${Number(next[1])}-${next[2]}`)?.scrollIntoView();return;}
  if(next[0]==='route'||!next[0])routeUnit=null;window.scrollTo(0,0);render();
});
let printPanels=[];
window.addEventListener('beforeprint',()=>{printPanels=[...main.querySelectorAll('details')].map(panel=>({panel,open:panel.open}));printPanels.forEach(({panel})=>panel.open=true);});
window.addEventListener('afterprint',()=>{printPanels.forEach(({panel,open})=>panel.open=open);printPanels=[];});
render();
