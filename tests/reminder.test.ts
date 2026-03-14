import test from 'node:test';
import assert from 'node:assert/strict';
import type { Reminder } from '../src/models/types.js';
import {
  canTransition,
  completeReminder,
  createReminderInstance,
  generateReminderInstances,
  markReminderMissed,
  skipReminder,
  triggerReminder,
  validTransitions,
} from '../src/services/reminder.js';

const mockReminder: Reminder = {
  id: 'rem_1',
  patientId: 'pat_1',
  medicationId: 'med_1',
  scheduleType: 'recurring',
  localTime: '08:30',
  timezone: 'Asia/Shanghai',
  timingCode: 'after_breakfast',
  messageTemplate: '请服药',
  effectiveFrom: '2026-03-15',
  gracePeriodMin: 120,
  status: 'active',
  createdAt: '2026-03-15T00:00:00+08:00',
  updatedAt: '2026-03-15T00:00:00+08:00',
};

test('create reminder instance', () => {
  const instance = createReminderInstance(mockReminder, '2026-03-15T08:30:00+08:00');
  assert.equal(instance.reminderId, 'rem_1');
  assert.equal(instance.patientId, 'pat_1');
  assert.equal(instance.medicationId, 'med_1');
  assert.equal(instance.plannedTime, '2026-03-15T08:30:00+08:00');
  assert.equal(instance.state, 'scheduled');
  assert.ok(instance.id.startsWith('remi_'));
});

test('trigger reminder', () => {
  const instance = createReminderInstance(mockReminder, '2026-03-15T08:30:00+08:00');
  const triggered = triggerReminder(instance);
  assert.equal(triggered.state, 'triggered');
  assert.ok(triggered.triggeredAt);
});

test('complete reminder', () => {
  const instance = createReminderInstance(mockReminder, '2026-03-15T08:30:00+08:00');
  const triggered = triggerReminder(instance);
  const { instance: completed, intakeLog } = completeReminder(
    triggered,
    mockReminder,
    '2026-03-15T08:35:00+08:00'
  );

  assert.equal(completed.state, 'completed');
  assert.ok(completed.completedAt);
  assert.equal(completed.intakeLogId, intakeLog.id);
  assert.equal(intakeLog.status, 'completed_on_time');
  assert.equal(intakeLog.actualTime, '2026-03-15T08:35:00+08:00');
});

test('complete reminder - late', () => {
  const instance = createReminderInstance(mockReminder, '2026-03-15T08:30:00+08:00');
  const triggered = triggerReminder(instance);
  const { instance: completed, intakeLog } = completeReminder(
    triggered,
    mockReminder,
    '2026-03-15T09:10:00+08:00' // 40分钟后，在宽限期内
  );

  assert.equal(intakeLog.status, 'completed_late');
});

test('mark reminder missed', () => {
  const instance = createReminderInstance(mockReminder, '2026-03-15T08:30:00+08:00');
  const triggered = triggerReminder(instance);
  const missed = markReminderMissed(triggered);

  assert.equal(missed.state, 'missed');
  assert.ok(missed.completedAt);
});

test('skip reminder by doctor', () => {
  const instance = createReminderInstance(mockReminder, '2026-03-15T08:30:00+08:00');
  const { instance: skipped, intakeLog } = skipReminder(instance, 'doctor', '医生要求暂停');

  assert.equal(skipped.state, 'skipped_doctor');
  assert.equal(intakeLog.status, 'skipped_by_doctor');
  assert.equal(intakeLog.reason, '医生要求暂停');
});

test('skip reminder by patient', () => {
  const instance = createReminderInstance(mockReminder, '2026-03-15T08:30:00+08:00');
  const triggered = triggerReminder(instance);
  const { instance: skipped, intakeLog } = skipReminder(triggered, 'patient', '外出忘记带药');

  assert.equal(skipped.state, 'skipped_patient');
  assert.equal(intakeLog.status, 'skipped_by_patient');
  assert.equal(intakeLog.reason, '外出忘记带药');
});

test('canTransition - valid transitions', () => {
  assert.equal(canTransition('scheduled', 'triggered'), true);
  assert.equal(canTransition('triggered', 'completed'), true);
  assert.equal(canTransition('triggered', 'missed'), true);
  assert.equal(canTransition('triggered', 'skipped_patient'), true);
  assert.equal(canTransition('scheduled', 'skipped_doctor'), true);
});

test('canTransition - invalid transitions', () => {
  assert.equal(canTransition('scheduled', 'completed'), false); // 必须先触发
  assert.equal(canTransition('completed', 'missed'), false); // 已完成不能再标记漏服
  assert.equal(canTransition('missed', 'completed'), false); // 已漏服不能再完成
});

test('generate reminder instances', () => {
  const instances = generateReminderInstances(mockReminder, '2026-03-15', '2026-03-17');

  // 3天，每天1个
  assert.equal(instances.length, 3);
  assert.equal(instances[0].plannedTime, '2026-03-15T08:30:00+08:00');
  assert.equal(instances[1].plannedTime, '2026-03-16T08:30:00+08:00');
  assert.equal(instances[2].plannedTime, '2026-03-17T08:30:00+08:00');
});

test('triggerReminder throws on invalid state', () => {
  const instance = createReminderInstance(mockReminder, '2026-03-15T08:30:00+08:00');
  const triggered = triggerReminder(instance);
  const completed = completeReminder(triggered, mockReminder, '2026-03-15T08:35:00+08:00');

  assert.throws(() => triggerReminder(completed.instance), /无法从状态 completed 触发提醒/);
});

test('markReminderMissed from scheduled (system auto-detect)', () => {
  // 现在允许从 scheduled 直接标记为 missed（系统检测到过期未触发的情况）
  const instance = createReminderInstance(mockReminder, '2026-03-15T08:30:00+08:00');
  const missed = markReminderMissed(instance);
  assert.equal(missed.state, 'missed');
  assert.ok(missed.completedAt);
});

test('markReminderMissed throws on already completed', () => {
  const instance = createReminderInstance(mockReminder, '2026-03-15T08:30:00+08:00');
  const triggered = triggerReminder(instance);
  const { instance: completed } = completeReminder(triggered, mockReminder, '2026-03-15T08:35:00+08:00');

  // 已完成状态不能再标记为 missed
  assert.throws(() => markReminderMissed(completed), /无法从状态 completed 标记为漏服/);
});
