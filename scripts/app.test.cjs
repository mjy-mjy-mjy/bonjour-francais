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
