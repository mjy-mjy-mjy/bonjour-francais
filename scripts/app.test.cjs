const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'data/draws.json'), 'utf8'));

function app(saved, hash = '#route') {
  const elements = {};
  const storage = {value: saved || null};
  function element(id) {
    return elements[id] ||= {innerHTML: '', value: '', textContent: '', listeners: {},
      classList: {add() {}, remove() {}},
      scrollIntoView() {this.scrolled = true;}, querySelector() {return null;}, querySelectorAll() {return [];},
      addEventListener(name, callback) {this.listeners[name] = callback;},
      insertAdjacentHTML(_, text) {this.innerHTML = text + this.innerHTML;}};
  }
  const context = vm.createContext({
    console, location: {hash},
    document: {getElementById: element, createElement: () => ({click() {}})},
    localStorage: {getItem: () => storage.value, setItem: (_, value) => {storage.value = value;}},
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
  return {context, elements, storage, main: element('main')};
}

test('every learning page renders; invalid lesson numbers are rejected', () => {
  for (const page of ['route','lesson/14','lesson/13','pronunciation','vocabulary','grammar',
                      'listening','speaking','reading','writing','review','resources','settings']) {
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
  assert.equal(a.main.innerHTML, expected.main.innerHTML);
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
  assert.ok(app(null, '#pronunciation').main.innerHTML.includes('informaticienne /'));
  assert.ok(app(null, '#vocabulary').main.innerHTML.includes('un ingénieur'));
  assert.ok(app(null, '#grammar').main.innerHTML.includes('rentre-t-elle'));
  assert.ok(app(null, '#reading').main.innerHTML.includes('Claire est informaticienne'));
  assert.ok(app(null, '#writing').main.innerHTML.includes('F. 翻译'));
});

test('search finds detailed knowledge and links to the correct lesson section', () => {
  const a = app();
  a.elements.search.listeners.input({target: {value: 'commençons'}});
  assert.ok(a.main.innerHTML.includes('#lesson/14/verbs'));
  assert.ok(a.main.innerHTML.includes('commençons'));
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
  assert.ok(a.main.innerHTML.includes('#lesson/1/questions'));
  assert.ok(!app(null, '#lesson/15').main.innerHTML.includes('即时小测'));
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
  assert.ok(a.main.innerHTML.includes('#lesson/2/places'));
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
  assert.ok(a.main.innerHTML.includes('#lesson/3/possessives'));
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
  assert.ok(a.main.innerHTML.includes('#lesson/4/words'));
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
  12:['Marseille','住房','旅游','未提及','港口','路线','资料']
};
const authoredCourseChecks=JSON.parse(fs.readFileSync(path.join(root,'lessons/catalog.json'),'utf8')).filter(c=>c.number>=5&&c.number<=12&&fs.existsSync(path.join(root,'lessons',String(c.number).padStart(2,'0')+'.json')));
for(const {number:n} of authoredCourseChecks)test(`lesson ${n}: verified core, skill routes and persistent review`,()=>{
  const a=app(null,'#lesson/'+n);
  for(const text of authoredCoverage[n])assert.ok(a.main.innerHTML.includes(text),text);
  assert.equal((a.main.innerHTML.match(/data-question=/g)||[]).length,30);
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
