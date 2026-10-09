const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'data/draws.json'), 'utf8'));

function app(saved, hash = '#route', theme = null) {
  const elements = {};
  const storage = {value: saved || null, theme};
  function element(id) {
    return elements[id] ||= {innerHTML: '', value: '', textContent: '', listeners: {}, attributes: {},
      classList: {add() {}, remove() {}},
      getAttribute(name) {return this.attributes[name];}, focus() {this.focused=true;},
      setAttribute(name, value) {this.attributes[name] = value;},
      scrollIntoView() {this.scrolled = true;}, querySelector() {return null;}, querySelectorAll() {return [];},
      addEventListener(name, callback) {this.listeners[name] = callback;},
      insertAdjacentHTML(_, text) {this.innerHTML = text + this.innerHTML;}};
  }
  const context = vm.createContext({
    console, location: {hash},
    document: {documentElement: {dataset: {}}, getElementById: element, querySelector: () => element('skip'), createElement: () => ({click() {}})},
    localStorage: {getItem: key => key === 'bonjour-francais-theme-v1' ? storage.theme : storage.value,
      setItem: (key, value) => {if(key === 'bonjour-francais-theme-v1') {if(storage.failTheme)throw Error('theme storage unavailable');storage.theme = value;}else {if(storage.failSave)throw Error('progress storage unavailable');storage.value = value;}}},
    setTimeout: () => 1, clearTimeout() {},
    fetch: async () => ({ok: true, json: async () => snapshot}),
    FormData: class {constructor(form) {this.form = form;} get() {return this.form.answer;}},
    confirm: () => true, Blob, URL
  });
  context.window = context;
  context.events = {};
  context.addEventListener = (name, callback) => {context.events[name] = callback;};
  context.print = () => {context.printed = true;};
  context.scrollTo = () => {};
  vm.runInContext(fs.readFileSync(path.join(root, 'content.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'course.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'lesson14.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), context);
  return {context, elements, storage, main: element('page-content')};
}

test('every learning page renders; invalid lesson numbers are rejected', () => {
  for (const page of ['route','lesson/14','lesson/13','pronunciation','vocabulary','grammar',
                      'listening','speaking','reading','writing','review','resources','settings','notebook']) {
    assert.ok(app(null, '#' + page).main.innerHTML.includes('<h1>'), page);
  }
  assert.ok(app(null, '#lesson/99').main.innerHTML.includes('找不到'));
});

test('the homepage without a fragment defaults to the learning route', () => {
  const expected = app(null, '#route');
  for (const hash of ['', '#']) {
    const a = app(null, hash);
    assert.equal(a.main.innerHTML, expected.main.innerHTML, hash || 'no fragment');
    assert.equal(a.elements.navigation.innerHTML, expected.elements.navigation.innerHTML);
  }
  const a = app(null, '#lesson/8');
  a.context.location.hash = '';
  a.context.events.hashchange({oldURL: 'https://example.test/#lesson/8'});
  assert.equal(a.main.innerHTML, app(a.storage.value, '#route').main.innerHTML);
  assert.ok(a.main.innerHTML.includes('继续第 8 课'));
  assert.ok(app(null, '#unknown').main.innerHTML.includes('找不到这个页面'));
});

test('wrong answers persist and a later correct answer clears the review item', () => {
  const a = app(null, '#lesson/14');
  const feedback = {};
  const form = {dataset: {question: 'q2'}, answer: '0', querySelector: () => feedback};
  const event = {preventDefault() {}, target: {closest: () => form}};
  a.main.listeners.submit(event);
  assert.deepEqual(JSON.parse(a.storage.value).wrong, ['q2']);
  assert.ok(feedback.textContent.includes('正确答案'));
  form.answer = '1';
  a.main.listeners.submit(event);
  assert.deepEqual(JSON.parse(a.storage.value).wrong, []);
  assert.ok(feedback.textContent.startsWith('答对了'));
});

test('completion and notes survive reloading; user note HTML is escaped', () => {
  const a = app(null, '#lesson/14');
  a.main.listeners.click({target: {closest: () => ({dataset: {complete: '14'}, hasAttribute: () => false})}});
  a.main.listeners.input({target: {dataset: {note: 'lesson-14'}, value: '<img src=x onerror=alert(1)>'}});
  const restored = app(a.storage.value, '#lesson/14');
  assert.ok(restored.main.innerHTML.includes('已完成'));
  assert.ok(restored.main.innerHTML.includes('&lt;img'));
  assert.ok(!restored.main.innerHTML.includes('<img src=x'));
});

test('French filter includes official versions and resets pagination', async () => {
  const a = app(null, '#draws');
  await new Promise(resolve => setImmediate(resolve));
  a.main.listeners.click({target: {closest: () => ({id: 'french-only', dataset: {}, hasAttribute: () => false})}});
  assert.ok(a.main.innerHTML.includes('所选类别'));
  const expected = snapshot.rounds.filter(r => r.category === '法语能力类别').length;
  assert.ok(a.main.innerHTML.includes(`${expected} 条`));
  assert.ok(a.main.innerHTML.includes('官方'));
});

test('malformed imports do not replace personal progress', async () => {
  const a = app(null, '#settings');
  await a.main.listeners.change({target: {id: 'import', files: [{size: 20, text: async () => '{"version":1}'}]}});
  assert.equal(a.storage.value, null);
  assert.ok(a.elements.notice.textContent.includes('有效'));
});

test('lesson 14 retains all twelve reference modules and ten written exercise groups', () => {
  const a = app(null, '#lesson/14');
  assert.equal(a.context.LESSON14_CONTENT.sections.length, 12);
  assert.equal(a.context.LESSON14_CONTENT.exercises.length, 10);
  for (const section of a.context.LESSON14_CONTENT.sections) {
    assert.ok(a.main.innerHTML.includes(`id="lesson14-${section.id}"`), section.id);
  }
  assert.ok(a.main.innerHTML.includes('nous commençons'));
  assert.ok(a.main.innerHTML.includes('19:00') || a.main.innerHTML.includes('dix-neuf heures'));
  assert.equal((a.main.innerHTML.match(/data-question=/g) || []).length, 30);
  assert.ok(a.main.innerHTML.includes('打印 / 另存为 PDF（含答案）'));
});

test('deep links scroll to knowledge sections and preserve answers on in-lesson navigation', () => {
  const a = app(null, '#lesson/14/time');
  assert.equal(a.elements['lesson14-time'].scrolled, true);
  const before = a.main.innerHTML;
  a.context.location.hash = '#lesson/14/sound';
  a.context.events.hashchange({oldURL: 'https://example.test/#lesson/14/time'});
  assert.equal(a.elements['lesson14-sound'].scrolled, true);
  assert.equal(a.main.innerHTML, before);
});

test('category pages use full reference content, including phonetics and written exercises', () => {
  assert.ok(app(null, '#pronunciation/14').main.innerHTML.includes('informaticienne /'));
  assert.ok(app(null, '#vocabulary/14').main.innerHTML.includes('un ingénieur'));
  assert.ok(app(null, '#grammar/14').main.innerHTML.includes('rentre-t-elle'));
  assert.ok(app(null, '#reading/14').main.innerHTML.includes('Claire est informaticienne'));
  assert.ok(app(null, '#writing/14').main.innerHTML.includes('F. 翻译'));
});

test('search finds detailed knowledge and links to the correct lesson section', () => {
  const a = app();
  a.elements.search.listeners.input({target: {value: 'commençons'}});
  assert.ok(a.elements['search-results'].innerHTML.includes('#lesson/14/verbs'));
  assert.ok(a.elements['search-results'].innerHTML.includes('commençons'));
});

test('print expands reference answers and restores each original panel state', () => {
  const a = app(null, '#lesson/14');
  const panels = [{open: false}, {open: true}];
  a.main.querySelectorAll = () => panels;
  a.context.events.beforeprint();
  assert.ok(panels.every(p => p.open));
  a.context.events.afterprint();
  assert.deepEqual(panels.map(p => p.open), [false, true]);
});

test('new questions use the same persistent wrong-answer review as earlier questions', () => {
  const a = app(null, '#lesson/14');
  const q = a.context.LESSON14_CONTENT.quickQuestions.find(q => q.id === 'q28');
  const feedback = {};
  const form = {dataset: {question: q.id}, answer: String((q.answer + 1) % q.options.length), querySelector: () => feedback};
  const event = {preventDefault() {}, target: {closest: () => form}};
  a.main.listeners.submit(event);
  const restored = app(a.storage.value, '#review');
  assert.ok(restored.main.innerHTML.includes('data-question="q28"'));
  form.answer = String(q.answer);
  a.main.listeners.submit(event);
  assert.deepEqual(JSON.parse(a.storage.value).wrong, []);
});

test('question IDs and correct-option indexes are valid and remain compatible with saved progress', () => {
  const a = app();
  const questions = [...a.context.COURSE_CONTENT.questions, ...a.context.LESSON14_CONTENT.quickQuestions];
  assert.equal(new Set(questions.map(q => q.id)).size, 30);
  assert.ok(questions.every(q => Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length && q.explanation));
  const state = {version:1, completed:[14], wrong:['q2','q28'], favorites:[14], notes:{'lesson-14':'已有笔记'}, attempts:{q2:false,q28:false}};
  const restored = app(JSON.stringify(state), '#lesson/14');
  assert.ok(restored.main.innerHTML.includes('已有笔记'));
  assert.ok(restored.main.innerHTML.includes('已收藏'));
});

test('lesson 1 covers the verified core instead of merely having twelve section headings', () => {
  const a = app(null, '#lesson/1');
  const c = a.context.COURSE_LIBRARY.lessons.find(c => c.number === 1);
  assert.equal(c.sections.length, 12);
  for (const text of ['s’appelle','vous vous appelez','Qui est-ce','C’est Hugo','française','italienne','mon mari','ma femme','升调','降调','nom','prénom','Bonne soirée']) {
    assert.ok(a.main.innerHTML.includes(text), text);
  }
  for (const section of c.sections) assert.ok(a.main.innerHTML.includes(`id="lesson1-${section.id}"`));
  assert.equal((a.main.innerHTML.match(/data-question=/g)||[]).length, 30);
  const practice = c.sections.find(s=>s.id==='practice').html;
  for (const letter of 'ABCDEFGHIJ') assert.ok(practice.includes(`<h3>${letter}.`), letter);
  assert.equal((practice.match(/<details>/g)||[]).length, 10);
  assert.ok(a.main.innerHTML.includes('打印 / 另存为 PDF（含答案）'));
});

test('lesson-specific category pages and search preserve the selected lesson', () => {
  for (const category of ['grammar','vocabulary','pronunciation','reading','speaking','writing','listening']) {
    const a = app(null, '#'+category+'/1');
    assert.ok(a.main.innerHTML.includes('Bienvenue !'), category);
    assert.ok(a.main.innerHTML.includes('第 1 课'), category);
    assert.ok(a.main.innerHTML.includes('#lesson/1'), category);
    assert.ok(a.elements.navigation.innerHTML.includes('#grammar/1'), category);
  }
  const a = app();
  a.elements.search.listeners.input({target:{value:'Qui est-ce'}});
  assert.ok(a.elements['search-results'].innerHTML.includes('#lesson/1/questions'));
  assert.ok(!app(null, '#lesson/17').main.innerHTML.includes('即时小测'));
});

test('question IDs across courses are unique and new lesson mistakes survive reload', () => {
  const a = app(null, '#lesson/1');
  const qs = [...a.context.COURSE_CONTENT.questions, ...a.context.LESSON14_CONTENT.quickQuestions, ...a.context.COURSE_LIBRARY.lessons.flatMap(c=>c.quickQuestions)];
  assert.equal(new Set(qs.map(q=>q.id)).size, qs.length);
  const q = a.context.COURSE_LIBRARY.lessons[0].quickQuestions.find(q=>q.question.includes('Qui est-ce'));
  const feedback={};
  const form={dataset:{question:q.id},answer:String((q.answer+1)%3),querySelector:()=>feedback};
  const e={preventDefault(){},target:{closest:()=>form}};
  a.main.listeners.submit(e);
  const restored=app(a.storage.value,'#review');
  assert.ok(restored.main.innerHTML.includes(`data-question="${q.id}"`));
  assert.ok(restored.main.innerHTML.includes('第 1 课'));
  form.answer=String(q.answer);a.main.listeners.submit(e);
  assert.deepEqual(JSON.parse(a.storage.value).wrong,[]);
});

test('lesson 1 deep links preserve answer state; lesson switches render the new content', () => {
  const a = app(null,'#lesson/1/questions');
  assert.equal(a.elements['lesson1-questions'].scrolled,true);
  const before=a.main.innerHTML;
  a.context.location.hash='#lesson/1/sound';
  a.context.events.hashchange({oldURL:'https://example.test/#lesson/1/questions'});
  assert.equal(a.main.innerHTML,before);
  assert.equal(a.elements['lesson1-sound'].scrolled,true);
  a.context.location.hash='#lesson/14/sound';
  a.context.events.hashchange({oldURL:'https://example.test/#lesson/1/sound'});
  assert.ok(a.main.innerHTML.includes('À Londres'));
  assert.equal(a.elements['lesson14-sound'].scrolled,true);
});

test('older skill-page notes remain visible in lesson 14 after adding course selection', () => {
  const state={version:1,completed:[],wrong:[],favorites:[],notes:{reading:'旧阅读笔记'},attempts:{}};
  const a=app(JSON.stringify(state),'#reading/14');
  assert.ok(a.main.innerHTML.includes('旧阅读笔记'));
});

test('lesson 2 covers articles, agreement, places, identity and syllables with practice', () => {
  const a=app(null,'#lesson/2');
  for(const text of ['l’étudiant','l’Italie','le Mexique','en Iran','au Canada','italienne','canadienne','Je parle chinois','/pa.ʁi/','联诵']) assert.ok(a.main.innerHTML.includes(text),text);
  assert.equal((a.main.innerHTML.match(/data-question=/g)||[]).length,30);
  for(const kind of ['grammar','vocabulary','pronunciation','listening','speaking','reading','writing']) {
    const page=app(null,'#'+kind+'/2');
    assert.ok(page.main.innerHTML.includes('#lesson/2'),kind);
    assert.ok(page.elements.navigation.innerHTML.includes('#grammar/2'),kind);
  }
  a.elements.search.listeners.input({target:{value:'Mexique'}});
  assert.ok(a.elements['search-results'].innerHTML.includes('#lesson/2/places'));
});

test('lesson 3 covers wellbeing, age, contact details, determiners, numbers and rhythm', () => {
  const a=app(null,'#lesson/3');
  for(const text of ['Comment allez-vous','J’ai dix-neuf ans','j’ai','tu as','vous avez','mon adresse','son numéro','une adresse','Quelle est ton adresse','vingt et un','前导 0','词组重音','/si.zɑ̃/']) assert.ok(a.main.innerHTML.includes(text),text);
  assert.equal((a.main.innerHTML.match(/data-question=/g)||[]).length,30);
  for(const kind of ['grammar','vocabulary','pronunciation','listening','speaking','reading','writing']) {
    const page=app(null,'#'+kind+'/3');
    assert.ok(page.main.innerHTML.includes('#lesson/3'),kind);
    assert.ok(page.elements.navigation.innerHTML.includes('#grammar/3'),kind);
  }
  a.elements.search.listeners.input({target:{value:'mon adresse'}});
  assert.ok(a.elements['search-results'].innerHTML.includes('#lesson/3/possessives'));
});

test('lesson 4 integrates profile reading, likes, questions and message production', () => {
  const a=app(null,'#lesson/4');
  for(const text of ['correspond@nce.com','J’aime le cinéma','J’aime danser','j’adore','tu aimes','Vous aimez','Mei','Ana','Marco','francophone','未提及','共同喜好','6—8 句','/vu.zɛ.me/']) assert.ok(a.main.innerHTML.includes(text),text);
  assert.equal((a.main.innerHTML.match(/data-question=/g)||[]).length,30);
  for(const kind of ['grammar','vocabulary','pronunciation','listening','speaking','reading','writing']) {
    const page=app(null,'#'+kind+'/4');
    assert.ok(page.main.innerHTML.includes('#lesson/4'),kind);
    assert.ok(page.elements.navigation.innerHTML.includes('#grammar/4'),kind);
  }
  a.elements.search.listeners.input({target:{value:'correspondante'}});
  assert.ok(a.elements['search-results'].innerHTML.includes('#lesson/4/words'));
  const stored={version:1,completed:[4],wrong:['l04-q24'],favorites:[4],notes:{'lesson-4':'笔友留言'},attempts:{'l04-q24':false}};
  const restored=app(JSON.stringify(stored),'#review');
  assert.ok(restored.main.innerHTML.includes('correspond@nce.com'));
  assert.ok(restored.main.innerHTML.includes('data-question="l04-q24"'));
});

const authoredCoverage={
  5:['des bureaux','nous sommes','Il y a','Ce sont','Qu’est-ce qu’il y a','près du bureau','les objets','复数口语标记'],
  6:['nous avons','ils ont','Il n’a pas de','Ce n’est pas','mes','marron','moi','/z/'],
  7:['ce','cet','cette','ces','quels','quelles','combien','euros','cher','enchaînement'],
  8:['artiste','peintre','à gauche','entre','cheveux','资料','未提及','展览'],
  9:['eux','elles','chez nous','habitez','Où','rez-de-chaussée','m²','/y/','圆唇'],
  10:['Prenez','prenons','Allez','au','aux','y','enchaînement','交通'],
  11:['C’est','On','on','禁止连读','en Martinique','conseil','旅游'],
  12:['Marseille','住房','旅游','未提及','港口','路线','资料'],
  13:['partons','partez','partent','premier','janvier','moins le quart','demie','aller-retour','/z/'],
  15:['lisons','écrivons','nous nous levons','s’habille','ne me','de la natation','au tennis','Le dimanche','/ʁ/'],
  16:['reprenons','prennent','nous nageons','recommençons','se détend','jusqu’à','未提及','采访','报刊','/ʁ/']
};
const authoredCourseChecks=JSON.parse(fs.readFileSync(path.join(root,'lessons/catalog.json'),'utf8')).filter(c=>c.number>=5&&c.number<=16&&fs.existsSync(path.join(root,'lessons',String(c.number).padStart(2,'0')+'.json')));
for(const {number:n} of authoredCourseChecks)test(`lesson ${n}: verified core, skill routes and persistent review`,()=>{
  const a=app(null,'#lesson/'+n);
  for(const text of authoredCoverage[n])assert.ok(a.main.innerHTML.includes(text),text);
  assert.equal((a.main.innerHTML.match(/data-question=/g)||[]).length,n>=15?42:30);
  assert.equal((a.main.innerHTML.match(/<details>/g)||[]).length,10);
  for(const kind of ['grammar','vocabulary','pronunciation','listening','speaking','reading','writing']){
    const page=app(null,`#${kind}/${n}`);assert.ok(page.main.innerHTML.includes(`#lesson/${n}`),kind);assert.ok(page.elements.navigation.innerHTML.includes(`#grammar/${n}`),kind);
  }
  const q=a.context.COURSE_LIBRARY.lessons.find(c=>c.number===n).quickQuestions[0];
  const form={dataset:{question:q.id},answer:String((q.answer+1)%q.options.length),querySelector:()=>({})};
  a.main.listeners.submit({preventDefault(){},target:{closest:()=>form}});
  const review=app(a.storage.value,'#review');assert.ok(review.main.innerHTML.includes(`data-question="${q.id}"`));assert.ok(review.main.innerHTML.includes(`第 ${n} 课`));
  form.answer=String(q.answer);a.main.listeners.submit({preventDefault(){},target:{closest:()=>form}});assert.deepEqual(JSON.parse(a.storage.value).wrong,[]);
});


test('route includes lesson 15 and new knowledge search links reach the authored sections',()=>{
  const a=app();
  assert.ok(a.main.innerHTML.includes('前 16 课 · 教材路线'));
  for(const n of [13,14,15,16])assert.ok(a.main.innerHTML.includes('#lesson/'+n));
  a.elements.search.listeners.input({target:{value:'partons'}});
  assert.ok(a.elements['search-results'].innerHTML.includes('#lesson/13/partir'));
  a.elements.search.listeners.input({target:{value:'levons'}});
  assert.ok(a.elements['search-results'].innerHTML.includes('#lesson/15/reflexive'));
  const detailed=app(null,'#lesson/15');
  assert.ok(detailed.main.innerHTML.includes('Le dimanche matin'));
  assert.ok(!detailed.main.innerHTML.includes('正文正在补充'));
});


function progress(overrides={}) {
  return JSON.stringify({version:1,completed:[],wrong:[],favorites:[],notes:{},attempts:{},...overrides});
}
function homeHero(a) {return a.main.innerHTML.match(/<section class="hero">([\s\S]*?)<\/section>/)[1];}
function clickComplete(a,n) {
  a.main.listeners.click({target:{closest:()=>({dataset:{complete:String(n)},hasAttribute:()=>false})}});
}
test('new visitors can choose their actual chapter without a fixed lesson 14 recommendation',()=>{
  const a=app();
  assert.ok(a.main.innerHTML.includes('<h1>从第 1 课开始。</h1>'));
  assert.ok(homeHero(a).includes('#lesson/1'));
  assert.ok(homeHero(a).includes('Bienvenue !'));
  assert.ok(a.elements.navigation.innerHTML.includes('#grammar/1'));
  assert.equal(a.storage.value,null);
});
test('opening an unfinished lesson remembers it across reloads without marking it complete',()=>{
  const a=app(null,'#lesson/13');
  const stored=JSON.parse(a.storage.value);
  assert.equal(stored.currentLesson,13);assert.deepEqual(stored.completed,[]);
  const home=app(a.storage.value,'');
  assert.ok(home.main.innerHTML.includes('<h1>继续第 13 课。</h1>'));
  assert.ok(homeHero(home).includes('Un aller simple'));
  assert.ok(homeHero(home).includes('#lesson/13'));
  assert.ok(home.elements.navigation.innerHTML.includes('#reading/13'));
  assert.ok(app(a.storage.value,'#grammar').main.innerHTML.includes('Un aller simple'));
});
test('completed lesson reviews and non-learning pages preserve the active chapter',()=>{
  const saved=progress({currentLesson:15,completed:[1,2,3,8,14],notes:{'lesson-14':'已有笔记'}});
  for(const hash of ['#lesson/8','#reading/14','#review','#resources','#settings']){
    const a=app(saved,hash);
    assert.equal(JSON.parse(a.storage.value).currentLesson,15,hash);
    assert.ok(homeHero(app(a.storage.value)).includes('#lesson/15'));
    assert.equal(JSON.parse(a.storage.value).notes['lesson-14'],'已有笔记');
  }
});
test('completion advances past finished chapters and undo restores the selected lesson',()=>{
  const a=app(progress({currentLesson:14,completed:[...Array.from({length:13},(_,i)=>i+1),15]}),'#lesson/14');
  clickComplete(a,14);
  assert.equal(JSON.parse(a.storage.value).currentLesson,16);
  assert.ok(a.main.innerHTML.includes('已完成 ✓'));
  assert.ok(homeHero(app(a.storage.value)).includes('#lesson/16'));
  clickComplete(a,14);
  assert.equal(JSON.parse(a.storage.value).currentLesson,14);
  assert.ok(!JSON.parse(a.storage.value).completed.includes(14));
});
test('old backups without the new field retain progress and recommend the following chapter',async()=>{
  const saved=progress({completed:[14],notes:{'lesson-14':'旧笔记'},wrong:['q2']});
  const a=app(saved);
  assert.ok(homeHero(a).includes('#lesson/15'));
  assert.deepEqual(JSON.parse(a.storage.value).wrong,['q2']);
  await a.main.listeners.change({target:{id:'import',files:[{size:saved.length,text:async()=>saved}]}});
  assert.equal(JSON.parse(a.storage.value).currentLesson,null);
  assert.equal(JSON.parse(a.storage.value).notes['lesson-14'],'旧笔记');
  assert.ok(homeHero(a).includes('#lesson/15'));
});
test('manual chapter selection persists and invalid imported chapters do not replace progress',async()=>{
  const a=app(progress({completed:[1],currentLesson:2}));
  await a.main.listeners.change({target:{id:'learning-course',value:'15'}});
  const saved=a.storage.value;
  assert.equal(JSON.parse(saved).currentLesson,15);
  assert.deepEqual(JSON.parse(saved).completed,[1]);
  assert.ok(homeHero(app(saved)).includes('Le dimanche matin'));
  for(const n of [0,37,'15']){
    const invalid=progress({currentLesson:n});
    await a.main.listeners.change({target:{id:'import',files:[{size:invalid.length,text:async()=>invalid}]}});
    assert.equal(a.storage.value,saved);
  }
});
test('all completed chapters offer review without inventing lesson 37',()=>{
  const a=app(progress({completed:Array.from({length:36},(_,i)=>i+1),currentLesson:36}));
  assert.ok(a.main.innerHTML.includes('A1课次已全部标记完成'));
  assert.ok(homeHero(a).includes('#lesson/36'));
  assert.ok(homeHero(a).includes('回顾本课'));
  assert.ok(!a.main.innerHTML.includes('#lesson/37'));
});
test('unfinished textbook chapters are labelled honestly and default skills use an available course',()=>{
  const a=app(progress({currentLesson:17,completed:[16]}));
  assert.ok(homeHero(a).includes('教材笔记'));
  assert.ok(homeHero(a).includes('详细讲义待补充'));
  assert.ok(a.elements.navigation.innerHTML.includes('#grammar/16'));
  assert.ok(app(a.storage.value,'#grammar').main.innerHTML.includes('Une journée avec Laure Manaudou'));
});

test('the selected palette restores independently of progress and unknown palettes use glass',()=>{
  const saved=progress({currentLesson:14,notes:{'lesson-14':'保留原有笔记'}});
  for(const [preference,expected] of [[null,'glass'],['paper','paper'],['unknown','glass']]) {
    const a=app(saved,'#route',preference);
    assert.equal(a.context.document.documentElement.dataset.theme,expected);
    assert.equal(a.storage.value,saved);
    assert.equal(a.storage.theme,preference);
    assert.ok(a.elements['theme-label'].textContent.includes(expected==='paper'?'纸感书房':'液态玻璃'));
  }
});

test('changing palette preserves rendered lesson content, answers, progress and reload preference',()=>{
  const saved=progress({currentLesson:14,completed:[1,2],wrong:['q2'],favorites:[14],notes:{'lesson-14':'我的笔记'}});
  const a=app(saved,'#lesson/14');
  const before=a.main.innerHTML;
  a.elements['theme-toggle'].listeners.click();
  assert.equal(a.context.document.documentElement.dataset.theme,'paper');
  assert.equal(a.storage.theme,'paper');
  assert.equal(a.storage.value,saved);
  assert.equal(a.main.innerHTML,before);
  assert.equal(a.elements['theme-toggle'].attributes['aria-label'],'切换配色，当前为纸感书房');
  const restored=app(a.storage.value,'#lesson/14',a.storage.theme);
  assert.equal(restored.context.document.documentElement.dataset.theme,'paper');
  assert.equal(restored.main.innerHTML,before);
  restored.elements['theme-toggle'].listeners.click();
  assert.equal(restored.storage.theme,'glass');
  assert.equal(restored.storage.value,saved);
});

test('importing a learning backup keeps the independently selected palette',async()=>{
  const a=app(progress({currentLesson:14}),'#route','paper');
  const imported=progress({currentLesson:4,completed:[1,2,3],notes:{'lesson-4':'导入的笔记'}});
  await a.main.listeners.change({target:{id:'import',files:[{size:imported.length,text:async()=>imported}]}});
  assert.equal(a.storage.theme,'paper');
  assert.equal(a.context.document.documentElement.dataset.theme,'paper');
  assert.equal(JSON.parse(a.storage.value).notes['lesson-4'],'导入的笔记');
});

test('palette storage failures retain progress and still allow the current page to change color',()=>{
  const saved=progress({currentLesson:14,completed:[1],notes:{'lesson-14':'重要笔记'}});
  const a=app(saved);
  a.storage.failTheme=true;
  a.elements['theme-toggle'].listeners.click();
  assert.equal(a.context.document.documentElement.dataset.theme,'paper');
  assert.equal(a.storage.value,saved);
  assert.equal(a.storage.theme,null);
  assert.ok(a.elements.notice.textContent.includes('无法保存配色偏好'));
});

test('browsing textbook units does not advance the current lesson or mark chapters complete',()=>{
  const saved=progress({currentLesson:14,completed:[1,2]});
  const a=app(saved);
  a.main.listeners.click({target:{closest:()=>({dataset:{unit:'9'},hasAttribute:()=>false})}});
  assert.equal(a.storage.value,saved);
  assert.ok(a.main.innerHTML.includes('data-unit="9" aria-pressed="true"'));
  assert.ok(a.main.innerHTML.match(/<div class="chapter-grid">([\s\S]*?)<\/div>/)[1].includes('#lesson/33'));
  a.context.location.hash='#lesson/8';
  a.context.events.hashchange({oldURL:'https://example.test/#route'});
  a.context.location.hash='#route';
  a.context.events.hashchange({oldURL:'https://example.test/#lesson/8'});
  assert.ok(a.main.innerHTML.includes('data-unit="2" aria-pressed="true"'));
  assert.ok(a.main.innerHTML.includes('<h1>继续第 8 课。</h1>'));
});

function quickNoteInput(a,field,value) {
  a.main.listeners.input({target:{dataset:{quickNoteField:field},value}});
}
function quickNoteSubmit(a) {
  a.main.listeners.submit({target:{id:'quick-note-form'},preventDefault(){}});
}
function quickNoteClick(a,dataset={},id='') {
  a.main.listeners.click({target:{closest:()=>({dataset,id,hasAttribute:()=>false})}});
}
function quickNoteFixture(overrides={}) {
  return {id:'note-1',title:'常用表达',body:'Ça marche !\n好的，没问题。',createdAt:'2026-10-09T03:00:00.000Z',updatedAt:'2026-10-09T03:00:00.000Z',...overrides};
}

test('standalone notebook restores old progress and drafts without changing the current lesson',()=>{
  const saved=progress({currentLesson:14,completed:[1,2],notes:{'lesson-14':'课后笔记'}});
  const a=app(saved,'#notebook');
  assert.ok(a.elements.navigation.innerHTML.includes('href="#notebook"'));
  assert.ok(a.main.innerHTML.includes('记一笔'));
  quickNoteInput(a,'title','每天一点');quickNoteInput(a,'body','Bonjour !\n今天复习问候。');
  const state=JSON.parse(a.storage.value);
  assert.equal(state.currentLesson,14);assert.deepEqual(state.completed,[1,2]);
  assert.equal(state.notes['lesson-14'],'课后笔记');assert.equal(state.quickNotes.length,0);
  const restored=app(a.storage.value,'#notebook');
  assert.ok(restored.main.innerHTML.includes('每天一点'));assert.ok(restored.main.innerHTML.includes('Bonjour !\n今天复习问候。'));
  restored.elements['theme-toggle'].listeners.click();
  assert.equal(restored.storage.value,a.storage.value);
});

test('quick notes create multiple records, escape personal text and keep line breaks after reload',()=>{
  const a=app(null,'#notebook');
  quickNoteInput(a,'title','<img src=x onerror=alert(1)>');
  quickNoteInput(a,'body','第一行\n<script>alert(1)</script>');quickNoteSubmit(a);
  let state=JSON.parse(a.storage.value);
  assert.equal(state.quickNotes.length,1);assert.equal(state.quickNoteDraft.body,'');
  assert.ok(!a.main.innerHTML.includes('<img src=x'));assert.ok(a.main.innerHTML.includes('&lt;script&gt;'));
  quickNoteInput(a,'body','第二条，不需要标题。');quickNoteSubmit(a);
  state=JSON.parse(a.storage.value);
  assert.equal(state.quickNotes.length,2);assert.notEqual(state.quickNotes[0].id,state.quickNotes[1].id);
  const restored=app(a.storage.value,'#notebook');
  assert.ok(restored.main.innerHTML.includes('未命名记录'));assert.ok(restored.main.innerHTML.includes('第一行\n&lt;script&gt;'));
});

test('empty content cannot become a record and leaves the draft available',()=>{
  const a=app(null,'#notebook');
  quickNoteInput(a,'title','只有标题');quickNoteInput(a,'body',' \n ');quickNoteSubmit(a);
  const state=JSON.parse(a.storage.value);
  assert.equal(state.quickNotes.length,0);assert.equal(state.quickNoteDraft.title,'只有标题');
  assert.ok(a.elements.notice.textContent.includes('先写一点内容'));
});

test('editing survives navigation and reload then updates the same record with its original creation time',()=>{
  const entry=quickNoteFixture();
  const a=app(progress({currentLesson:15,quickNotes:[entry]}),'#notebook');
  quickNoteClick(a,{quickNoteEdit:entry.id});quickNoteInput(a,'body','改为：Ça me va.');
  a.context.location.hash='#route';a.context.events.hashchange({oldURL:'https://example.test/#notebook'});
  assert.equal(JSON.parse(a.storage.value).currentLesson,15);
  const restored=app(a.storage.value,'#notebook');
  assert.ok(restored.main.innerHTML.includes('保存修改'));quickNoteSubmit(restored);
  const state=JSON.parse(restored.storage.value);
  assert.equal(state.quickNotes.length,1);assert.equal(state.quickNotes[0].id,entry.id);
  assert.equal(state.quickNotes[0].createdAt,entry.createdAt);assert.equal(state.quickNotes[0].body,'改为：Ça me va.');
  assert.equal(state.quickNoteDraft.editingId,null);
});

test('cancelled edit, draft reset and deletion preserve data; deletion clears only the selected record',()=>{
  const first=quickNoteFixture(),second=quickNoteFixture({id:'note-2',title:'数字'});
  const a=app(progress({quickNotes:[first,second]}),'#notebook');
  quickNoteInput(a,'body','还没整理好的想法');const saved=a.storage.value;
  a.context.confirm=()=>false;
  quickNoteClick(a,{quickNoteEdit:first.id});quickNoteClick(a,{},'quick-note-reset');quickNoteClick(a,{quickNoteDelete:first.id});
  assert.equal(a.storage.value,saved);
  a.context.confirm=()=>true;
  quickNoteClick(a,{quickNoteDelete:first.id});
  let state=JSON.parse(a.storage.value);
  assert.equal(state.quickNotes.length,1);assert.equal(state.quickNotes[0].id,second.id);assert.equal(state.quickNoteDraft.body,'还没整理好的想法');
  quickNoteClick(a,{quickNoteEdit:second.id});quickNoteInput(a,'body','待保存修改');quickNoteClick(a,{quickNoteDelete:second.id});
  state=JSON.parse(a.storage.value);assert.equal(state.quickNotes.length,0);assert.equal(state.quickNoteDraft.editingId,null);assert.equal(state.quickNoteDraft.body,'');
});

test('notebook search preserves drafts and global search links to saved records',()=>{
  const a=app(progress({quickNotes:[quickNoteFixture(),quickNoteFixture({id:'note-2',title:'时间',body:'demain'})]}),'#notebook');
  quickNoteInput(a,'body','正在写的草稿');
  a.main.listeners.input({target:{id:'quick-note-search',value:'MARCHE',dataset:{}}});
  assert.ok(a.elements['quick-note-list'].innerHTML.includes('note-1'));assert.ok(!a.elements['quick-note-list'].innerHTML.includes('note-2'));
  a.elements.search.listeners.input({target:{value:'demain'}});
  assert.ok(a.elements['search-results'].innerHTML.includes('#notebook/note-2'));assert.equal(JSON.parse(a.storage.value).quickNoteDraft.body,'正在写的草稿');
  a.context.location.hash='#notebook/note-2';a.context.events.hashchange({oldURL:'https://example.test/#notebook'});
  assert.ok(a.main.innerHTML.includes('quick-note-note-2'));assert.equal(a.elements['quick-note-note-2'].scrolled,true);
});

test('learning backup exports and imports quick notes plus drafts and remains compatible with older backups',async()=>{
  const a=app(progress({quickNotes:[quickNoteFixture()],quickNoteDraft:{title:'明天',body:'待继续',editingId:null},notes:{'lesson-14':'旧笔记'}}),'#settings','paper');
  let exported;
  a.context.Blob=class {constructor(parts){exported=JSON.parse(parts[0]);}};
  a.context.URL={createObjectURL:()=> 'blob:test',revokeObjectURL(){}};
  quickNoteClick(a,{},'export');
  assert.equal(exported.quickNotes[0].body,'Ça marche !\n好的，没问题。');assert.equal(exported.quickNoteDraft.body,'待继续');
  const backup=JSON.stringify(exported),other=app(null,'#notebook');
  await other.main.listeners.change({target:{id:'import',files:[{size:backup.length,text:async()=>backup}]}});
  assert.equal(JSON.parse(other.storage.value).quickNotes[0].id,'note-1');assert.equal(JSON.parse(other.storage.value).quickNoteDraft.body,'待继续');
  const old=progress({completed:[14],notes:{'lesson-14':'更早的备份'}});
  await a.main.listeners.change({target:{id:'import',files:[{size:old.length,text:async()=>old}]}});
  assert.equal(a.storage.theme,'paper');assert.equal(JSON.parse(a.storage.value).quickNotes.length,0);assert.equal(JSON.parse(a.storage.value).notes['lesson-14'],'更早的备份');
});

test('malformed quick-note backups are rejected without replacing personal data',async()=>{
  const a=app(progress({quickNotes:[quickNoteFixture()]}),'#notebook');const saved=a.storage.value;
  for(const invalid of [
    {quickNotes:{}},{quickNotes:[null]},
    {quickNotes:[quickNoteFixture({id:'" onclick="x'})]},
    {quickNotes:[quickNoteFixture(),quickNoteFixture()]},
    {quickNotes:[quickNoteFixture({body:5})]},
    {quickNotes:[quickNoteFixture({body:' '})]},
    {quickNotes:[quickNoteFixture({updatedAt:'not a date'})]},
    {quickNoteDraft:{title:'a',body:'b',editingId:'missing'}},
    {quickNoteDraft:null}
  ]) {
    const backup=progress(invalid);
    await a.main.listeners.change({target:{id:'import',files:[{size:backup.length,text:async()=>backup}]}});
    assert.equal(a.storage.value,saved);assert.ok(a.elements.notice.textContent.includes('有效'));
  }
});

test('storage failures retain the draft and existing records until saving succeeds',()=>{
  const a=app(progress({quickNotes:[quickNoteFixture()]}),'#notebook');
  quickNoteInput(a,'body','不能丢失的草稿');const saved=a.storage.value;
  a.storage.failSave=true;quickNoteSubmit(a);
  assert.equal(a.storage.value,saved);assert.ok(a.main.innerHTML.includes('记一笔'));
  assert.ok(a.elements['quick-note-status'].textContent.includes('未能保存'));
  a.storage.failSave=false;quickNoteSubmit(a);
  assert.equal(JSON.parse(a.storage.value).quickNotes.length,2);assert.equal(JSON.parse(a.storage.value).quickNotes[0].body,'不能丢失的草稿');
});

test('failed backup persistence does not replace existing quick notes or claim a successful import',async()=>{
  const a=app(progress({quickNotes:[quickNoteFixture()]}),'#notebook');const saved=a.storage.value;
  a.storage.failSave=true;
  const backup=progress({quickNotes:[quickNoteFixture({id:'imported-1',body:'导入的记录'})]});
  await a.main.listeners.change({target:{id:'import',files:[{size:backup.length,text:async()=>backup}]}});
  assert.equal(a.storage.value,saved);assert.ok(!a.elements.notice.textContent.includes('已导入'));
  a.storage.failSave=false;quickNoteInput(a,'body','保留现有数据');quickNoteSubmit(a);
  const state=JSON.parse(a.storage.value);
  assert.equal(state.quickNotes.length,2);assert.ok(state.quickNotes.some(n=>n.id==='note-1'));
  assert.ok(!state.quickNotes.some(n=>n.id==='imported-1'));
});

test('clearing or escaping search restores the original page without replacing its DOM',()=>{
  const a=app(null,'#lesson/14'),original=a.main.innerHTML,label=a.elements['page-location'].textContent;
  a.context.scrollY=2800;
  a.elements.search.listeners.input({target:{value:'faire'}});
  assert.equal(a.main.innerHTML,original);assert.equal(a.main.hidden,true);assert.equal(a.elements['search-results'].hidden,false);
  a.elements.search.listeners.input({target:{value:''}});
  assert.equal(a.main.hidden,false);assert.equal(a.main.innerHTML,original);assert.equal(a.elements['search-results'].hidden,true);
  assert.equal(a.elements['page-location'].textContent,label);
  a.elements.search.listeners.input({target:{value:'faire'}});
  a.elements.search.listeners.keydown({key:'Escape',preventDefault(){}});
  assert.equal(a.main.hidden,false);assert.equal(a.main.innerHTML,original);
});

test('same-lesson search result navigation preserves the page and reveals the selected section',()=>{
  const a=app(null,'#lesson/14'),original=a.main.innerHTML;
  a.elements.search.listeners.input({target:{value:'faire'}});
  a.context.location.hash='#lesson/14/faire';a.context.events.hashchange({oldURL:'https://example.test/#lesson/14'});
  assert.equal(a.main.innerHTML,original);assert.equal(a.main.hidden,false);assert.equal(a.elements['lesson14-faire'].scrolled,true);
  a.elements.search.listeners.input({target:{value:'faire'}});
  a.elements['search-results'].listeners.click({preventDefault(){},target:{closest:selector=>selector==='a'?{getAttribute:()=>a.context.location.hash}:null}});
  assert.equal(a.main.innerHTML,original);assert.equal(a.main.hidden,false);
});

test('reading controls appear only in long lessons and directory navigation preserves page state',()=>{
  const a=app(null,'#lesson/14'),original=a.main.innerHTML;
  assert.equal(a.elements['reading-tools'].hidden,true);
  a.context.scrollY=2000;a.context.events.scroll();assert.equal(a.elements['reading-tools'].hidden,false);
  assert.equal(a.elements['reading-toc'].attributes.href,'#lesson/14/toc');
  a.context.location.hash='#lesson/14/toc';a.context.events.hashchange({oldURL:'https://example.test/#lesson/14'});
  assert.equal(a.main.innerHTML,original);assert.equal(a.elements['lesson14-toc'].scrolled,true);assert.equal(a.elements['lesson14-toc'].focused,true);
  a.elements.search.listeners.input({target:{value:'faire'}});assert.equal(a.elements['reading-tools'].hidden,true);
  const placeholder=app(null,'#lesson/17');placeholder.context.scrollY=2000;placeholder.context.events.scroll();assert.equal(placeholder.elements['reading-tools'].hidden,true);
});

test('mobile menu exposes its expansion state and closes with navigation or Escape',()=>{
  const a=app();assert.equal(a.elements['navigation-toggle'].attributes['aria-expanded'],'false');
  a.elements['navigation-toggle'].listeners.click();assert.equal(a.elements['navigation-toggle'].attributes['aria-expanded'],'true');
  a.elements.navigation.listeners.click({target:{closest:()=>({})}});assert.equal(a.elements['navigation-toggle'].attributes['aria-expanded'],'false');
  a.elements['navigation-toggle'].listeners.click();a.elements.sidebar.listeners.keydown({key:'Escape'});
  assert.equal(a.elements['navigation-toggle'].attributes['aria-expanded'],'false');assert.equal(a.elements['navigation-toggle'].focused,true);
});
function undoQuickNote(a) {a.main.listeners.click({target:{closest:()=>({dataset:{},hasAttribute:name=>name==='data-quick-note-undo'})}});}

test('undo restores a deleted record while retaining other notes and the current draft',()=>{
  const entry=quickNoteFixture({title:'<script>test</script>'}),a=app(progress({quickNotes:[entry,quickNoteFixture({id:'note-2'})]}),'#notebook');
  quickNoteClick(a,{quickNoteDelete:entry.id});assert.ok(a.main.innerHTML.includes('data-quick-note-undo'));assert.ok(a.main.innerHTML.includes('&lt;script&gt;test&lt;/script&gt;'));
  quickNoteInput(a,'body','删除后继续写的新草稿');undoQuickNote(a);
  const saved=JSON.parse(a.storage.value);assert.equal(saved.quickNotes.length,2);assert.deepEqual(saved.quickNotes.find(n=>n.id===entry.id),entry);
  assert.equal(saved.quickNoteDraft.body,'删除后继续写的新草稿');assert.ok(!a.main.innerHTML.includes('data-quick-note-undo'));
  assert.equal(JSON.parse(app(a.storage.value,'#notebook').storage.value).quickNotes.length,2);
});

test('undo recovers unsaved edits of the deleted record and retries after a storage failure',()=>{
  const entry=quickNoteFixture(),a=app(progress({quickNotes:[entry]}),'#notebook');
  quickNoteClick(a,{quickNoteEdit:entry.id});quickNoteInput(a,'body','这份修改还未保存');quickNoteClick(a,{quickNoteDelete:entry.id});
  a.storage.failSave=true;undoQuickNote(a);assert.equal(JSON.parse(a.storage.value).quickNotes.length,0);assert.ok(a.main.innerHTML.includes('data-quick-note-undo'));
  a.storage.failSave=false;undoQuickNote(a);const saved=JSON.parse(a.storage.value);
  assert.equal(saved.quickNotes[0].body,entry.body);assert.equal(saved.quickNoteDraft.editingId,entry.id);assert.equal(saved.quickNoteDraft.body,'这份修改还未保存');
});

test('a successful backup import clears deletion recovery from the previous notebook',async()=>{
  const a=app(progress({quickNotes:[quickNoteFixture()]}),'#notebook');quickNoteClick(a,{quickNoteDelete:'note-1'});
  const replacement=progress({quickNotes:[quickNoteFixture({id:'imported'})]});
  await a.main.listeners.change({target:{id:'import',files:[{size:replacement.length,text:async()=>replacement}]}});
  undoQuickNote(a);assert.equal(JSON.parse(a.storage.value).quickNotes.length,1);assert.equal(JSON.parse(a.storage.value).quickNotes[0].id,'imported');
});

test('selecting or completing a chapter resets the browsed unit to match the current chapter',async()=>{
  const a=app(progress({currentLesson:14}));quickNoteClick(a,{unit:'9'});
  await a.main.listeners.change({target:{id:'learning-course',value:'15'}});
  assert.ok(a.main.innerHTML.includes('data-unit="4" aria-pressed="true"'));assert.ok(a.main.innerHTML.includes('href="#lesson/15" class="chapter-card current'));
  quickNoteClick(a,{unit:'9'});clickComplete(a,15);
  assert.ok(a.main.innerHTML.includes('data-unit="4" aria-pressed="true"'));assert.ok(a.main.innerHTML.includes('href="#lesson/16" class="chapter-card current'));
});

test('searching the current lesson title and returning to its base route retains page state',()=>{
  const a=app(null,'#lesson/14/faire'),original=a.main.innerHTML;
  a.elements.search.listeners.input({target:{value:'Le dimanche'}});
  a.context.location.hash='#lesson/14';a.context.events.hashchange({oldURL:'https://example.test/#lesson/14/faire'});
  assert.equal(a.main.innerHTML,original);assert.equal(a.main.hidden,false);assert.equal(a.elements['search-results'].hidden,true);
  a.context.location.hash='#lesson/14/toc';a.context.events.hashchange({oldURL:'https://example.test/#lesson/14'});
  a.context.location.hash='#lesson/14';a.context.events.hashchange({oldURL:'https://example.test/#lesson/14/toc'});
  assert.equal(a.main.innerHTML,original);
});

test('lesson 15 explicitly teaches the three communicative goals in full and skill pages',()=>{
  const a=app(null,'#lesson/15');
  const targets=['询问正在进行的活动','询问习惯性活动','说出所从事的运动'];
  for(const kind of ['lesson','grammar','speaking','writing']){
    const page=app(null,`#${kind}/15`);
    for(const goal of targets)assert.ok(page.main.innerHTML.includes(goal),`${kind}: ${goal}`);
  }
  assert.ok(a.main.innerHTML.includes('#lesson/15/communicate'));
  for(const [term,href] of [['询问正在进行的活动','#lesson/15/communicate'],['réveillons','#lesson/15/reflexive'],['s’appellent','#lesson/15/reflexive']]){
    a.elements.search.listeners.input({target:{value:term}});assert.ok(a.elements['search-results'].innerHTML.includes(href),term);
  }
});

test('lesson 15 contains six present-tense persons for all seven verb pairs and the critical spellings',()=>{
  const a=app(null,'#lesson/15');
  const html=a.main.innerHTML;
  const critical={laver:['je lave','nous nous lavons'],reposer:['tu reposes','vous vous reposez'],réveiller:['je me réveille','nous nous réveillons','ils / elles se réveillent'],habiller:['j’habille','je m’habille','vous vous habillez'],coucher:['je me couche','nous nous couchons'],appeler:['j’appelle','tu t’appelles','nous appelons','vous vous appelez','ils / elles s’appellent'],lever:['je me lève','nous nous levons','vous vous levez','ils / elles se lèvent']};
  for(const [verb,forms] of Object.entries(critical)){
    const table=html.match(new RegExp(`<table data-conjugation="${verb}">([\\s\\S]*?)</table>`))?.[1];assert.ok(table,verb);
    assert.equal((table.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].match(/<tr>/g)||[]).length,6,verb);
    for(const form of forms)assert.ok(table.includes(form),`${verb}: ${form}`);
  }
  assert.ok(app(null,'#vocabulary/15').main.innerHTML.includes('data-conjugation="réveiller"'));
  assert.ok(app(null,'#speaking/15').main.innerHTML.includes('data-conjugation="appeler"'));
});

test('lesson 15 extends practice with matched answers and retains the existing quiz identifiers',()=>{
  const a=app(null,'#lesson/15'),course=a.context.COURSE_LIBRARY.lessons.find(c=>c.number===15);
  assert.equal(course.sections.length,13);assert.equal(course.quickQuestions.length,42);
  assert.deepEqual(Array.from(course.quickQuestions.slice(0,30),q=>q.id),Array.from({length:30},(_,i)=>'l15-q'+String(i+1).padStart(2,'0')));
  let count=0;
  for(const exercise of course.exercises){const [question,answer]=exercise.html.split('<details>');const n=(question.match(/<li>/g)||[]).length;assert.equal((answer.match(/<li>/g)||[]).length,n,exercise.id);count+=n;}
  assert.equal(count,103);assert.equal(course.exercises.length,10);
});

test('new lesson 15 quizzes persist in review alongside older progress and explain all three goals',()=>{
  const a=app(progress({completed:[1],wrong:['l15-q01'],favorites:[15],notes:{'lesson-15':'原有笔记'}}),'#lesson/15');
  for(const id of ['l15-q31','l15-q33','l15-q38','l15-q39','l15-q40']){
    const q=a.context.COURSE_LIBRARY.lessons.find(c=>c.number===15).quickQuestions.find(q=>q.id===id);
    const feedback={};const form={dataset:{question:id},answer:String((q.answer+1)%q.options.length),querySelector:()=>feedback};
    a.main.listeners.submit({preventDefault(){},target:{closest:()=>form}});
    assert.ok(JSON.parse(a.storage.value).wrong.includes(id));assert.ok(feedback.textContent.includes(q.explanation));
    const restored=app(a.storage.value,'#review');assert.ok(restored.main.innerHTML.includes(`data-question="${id}"`));
    form.answer=String(q.answer);a.main.listeners.submit({preventDefault(){},target:{closest:()=>form}});assert.ok(!JSON.parse(a.storage.value).wrong.includes(id));
  }
  const saved=JSON.parse(a.storage.value);assert.ok(saved.wrong.includes('l15-q01'));assert.equal(saved.notes['lesson-15'],'原有笔记');assert.ok(saved.favorites.includes(15));assert.deepEqual(saved.completed,[1]);
});

test('lesson 16 follows the journal and daily-schedule goals with full verb paradigms',()=>{
  const c=JSON.parse(fs.readFileSync(path.join(root,'lessons/16.json'),'utf8'));
  assert.equal(c.sections.length,13);
  const scope=c.sections.find(s=>s.id==='scope').html;
  for(const text of ['第52—53页','简单报刊文章','采访','历史语境','原创'])assert.ok(scope.includes(text),text);
  const verbs=c.sections.find(s=>s.id==='verbs').html;
  const tables=[...verbs.matchAll(/<table data-conjugation="([^"]+)">([\s\S]*?)<\/table>/g)];
  assert.equal(tables.length,11);
  for(const [,verb,html]of tables){
    const rows=html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
    assert.equal((rows.match(/<tr>/g)||[]).length,6,verb);
    for(const subject of ['je','tu','il / elle / on','nous','vous','ils / elles'])assert.ok(rows.includes('<td>'+subject+'</td>'),verb+' '+subject);
  }
  for(const text of ['nous prenons','ils / elles reprennent','nous nageons','nous recommençons','nous nous entraînons','vous vous détendez','elle / on se termine'])assert.ok(verbs.includes(text),text);
  const training=tables.find(t=>t[1]==='s’entraîner')[2];
  for(const form of ['je m’entraîne','tu t’entraînes','il / elle / on s’entraîne','nous nous entraînons','vous vous entraînez','ils / elles s’entraînent'])assert.ok(training.includes('<td>'+form+'</td>'),form);
  assert.ok(!verbs.includes('nous n’entraînons'));assert.ok(!verbs.includes('vous v’entraînez'));
  const reading=app(null,'#reading/16').main.innerHTML;
  for(const text of ['原创虚构人物','未提及','se réveille','vers six heures','两小时','sœur不说明年龄'])assert.ok(reading.includes(text),text);
  assert.ok(app(null,'#pronunciation/16').main.innerHTML.includes('没有单列新的语音专题'));
});

test('lesson 16 routes, search and practice preserve meaning across all skills',()=>{
  const a=app(progress({currentLesson:16}));
  assert.ok(homeHero(a).includes('Une journée avec Laure Manaudou'));
  assert.ok(!a.main.innerHTML.includes('本单元未提供详细讲义'));
  assert.ok(a.main.innerHTML.includes('第1—16课已提供详细讲义'));
  a.elements.search.listeners.input({target:{value:'recommençons'}});
  assert.ok(a.elements['search-results'].innerHTML.includes('#lesson/16/verbs'));
  const c=a.context.COURSE_LIBRARY.lessons.find(c=>c.number===16);
  assert.equal(c.quickQuestions.length,42);
  const body=c.sections.find(s=>s.id==='practice').html;
  const groups=[...body.matchAll(/<h3>([A-J])\. (.*?)<\/h3>([\s\S]*?)(?=<h3>|$)/g)];
  assert.equal(groups.length,10);let count=0;
  for(const [,letter,,html]of groups){const[q,ans]=html.split('<details>');const n=(q.match(/<li>/g)||[]).length;assert.equal((ans.match(/<li>/g)||[]).length,n,letter);count+=n;}
  assert.equal(count,104);
  for(const[kind,title]of [['grammar','A. 现在时'],['vocabulary','C. 词汇'],['reading','G. 阅读'],['speaking','E. 采访'],['writing','F. 写作'],['pronunciation','H. 语音']])assert.ok(app(null,'#'+kind+'/16').main.innerHTML.includes(title),kind);
  for(const q of c.quickQuestions){assert.equal(new Set(q.options).size,q.options.length);assert.ok(q.answer>=0&&q.answer<q.options.length);assert.ok(q.explanation);}
});

test('lesson 16 replaces its notebook placeholder without losing notes or earlier review',()=>{
  const saved=progress({currentLesson:16,completed:[15],favorites:[16],notes:{'lesson-16':'补充前写的教材笔记','lesson-15':'旧讲义笔记'},wrong:['l15-q01'],attempts:{'l15-q01':false}});
  const a=app(saved,'#lesson/16');assert.ok(a.main.innerHTML.includes('补充前写的教材笔记'));
  const q=a.context.COURSE_LIBRARY.lessons.find(c=>c.number===16).quickQuestions.find(q=>q.id==='l16-q09');
  const form={dataset:{question:q.id},answer:String((q.answer+1)%3),querySelector:()=>({})};
  a.main.listeners.submit({preventDefault(){},target:{closest:()=>form}});
  const review=app(a.storage.value,'#review');assert.ok(review.main.innerHTML.includes('data-question="l16-q09"'));assert.ok(review.main.innerHTML.includes('data-question="l15-q01"'));
  const restored=JSON.parse(review.storage.value);assert.equal(restored.notes['lesson-16'],'补充前写的教材笔记');assert.deepEqual(restored.favorites,[16]);assert.deepEqual(restored.completed,[15]);
  form.answer=String(q.answer);a.main.listeners.submit({preventDefault(){},target:{closest:()=>form}});
  assert.deepEqual(JSON.parse(a.storage.value).wrong,['l15-q01']);
});
