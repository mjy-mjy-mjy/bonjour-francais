const test = require('node:test');
const assert = require('node:assert/strict');
const {freshGoal, readGoal, addEntry, undoEntry, editGoal, measures, percent, pace} = require('../assets/goal/goal.js');
const blank = freshGoal('2026-11-01');
const configured = {...blank, deadline: '2026-11-21'};
const at = day => new Date(day + 'T00:00:00');

test('separate counters record minutes exactly and undo only the displayed last entry', () => {
  const first = addEntry(blank, 60, 'first');
  const second = addEntry(first, 45, 'second');
  assert.equal(second.totalMinutes, 105);
  assert.throws(() => undoEntry(second, 'first'));
  assert.equal(undoEntry(second, 'second').totalMinutes, 60);
  assert.throws(() => addEntry(first, 0, 'invalid'));
  assert.deepEqual(readGoal({getItem: () => JSON.stringify(second)}, blank), second);
  assert.throws(() => readGoal({getItem: () => '{'}, blank));
});

test('editing dates keeps parallel study entries and rejects stale corrections', () => {
  const updated = addEntry(blank, 120, 'other-tab');
  assert.deepEqual(editGoal(updated, blank, configured), {...updated, deadline: configured.deadline});
  assert.throws(() => editGoal(updated, blank, {...blank, totalMinutes: 12}));
  assert.equal(editGoal(updated, updated, {...updated, totalMinutes: 30}).lastEntry, null);
  assert.throws(() => editGoal(blank, blank, {...blank, deadline: '2026-10-31'}));
});

test('blank, future, active, due and overdue date ranges stay bounded, including single-day plans', () => {
  assert.equal(measures(blank).remaining, null);
  assert.equal(measures(configured, at('2026-10-20')).remaining, 1);
  const halfway = measures(configured, at('2026-11-11'));
  assert.equal(halfway.days, 10);
  assert.equal(halfway.state, 'active');
  assert.ok(Math.abs(halfway.remaining - .5) < .003);
  assert.equal(measures(configured, at('2026-11-21')).state, 'due');
  assert.equal(measures(configured, at('2026-11-24')).remaining, 0);
  assert.equal(measures({...blank, deadline: blank.startDate}, at(blank.startDate)).remaining, 0);
});

test('over-target hours are retained and the display reserves 100% for a completed plan', () => {
  assert.equal(percent(.99999), '99.9');
  const over = addEntry(blank, blank.targetMinutes + 60, 'extra');
  assert.equal(over.totalMinutes, 60060);
  assert.equal(percent(measures(over).study), '100.0');
});

test('chase compares study progress to elapsed time and handles equality and an unset deadline', () => {
  assert.equal(pace(.42, null), null);
  assert.deepEqual(pace(.42, .5), {elapsed: .5, gap: '8.0', order: 'behind'});
  assert.deepEqual(pace(.62, .5), {elapsed: .5, gap: '12.0', order: 'ahead'});
  assert.equal(pace(.5004, .5).order, 'even');
  assert.deepEqual(pace(.98, 0), {elapsed: 1, gap: '2.0', order: 'behind'});
});
