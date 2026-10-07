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
  context.addEventListener = () => {};
  context.scrollTo = () => {};
  vm.runInContext(fs.readFileSync(path.join(root, 'content.js'), 'utf8'), context);
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
  a.main.listeners.click({target: {closest: () => ({dataset: {complete: '14'}})}});
  a.main.listeners.input({target: {dataset: {note: 'lesson-14'}, value: '<img src=x onerror=alert(1)>'}});
  const restored = app(a.storage.value, '#lesson/14');
  assert.ok(restored.main.innerHTML.includes('已完成'));
  assert.ok(restored.main.innerHTML.includes('&lt;img'));
  assert.ok(!restored.main.innerHTML.includes('<img src=x'));
});

test('French filter includes official versions and resets pagination', async () => {
  const a = app(null, '#draws');
  await new Promise(resolve => setImmediate(resolve));
  a.main.listeners.click({target: {closest: () => ({id: 'french-only', dataset: {}})}});
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
