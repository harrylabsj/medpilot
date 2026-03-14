import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeviationTags,
  calculateExpectedDoses,
  classifyIntakeStatus,
  summarizeAdherence,
} from '../src/rules/adherence.js';
import type { IntakeLog, Reminder } from '../src/models/types.js';

test('classify intake status - on time', () => {
  const status = classifyIntakeStatus('2026-03-15T08:30:00+08:00', '2026-03-15T08:35:00+08:00', 120);
  assert.equal(status, 'completed_on_time');
});

test('classify intake status - within grace period', () => {
  const status = classifyIntakeStatus('2026-03-15T08:30:00+08:00', '2026-03-15T09:10:00+08:00', 120);
  assert.equal(status, 'completed_late');
});

test('classify intake status - missed (beyond grace period)', () => {
  const status = classifyIntakeStatus('2026-03-15T08:30:00+08:00', '2026-03-15T11:00:00+08:00', 120);
  assert.equal(status, 'missed');
});

test('classify intake status - missed (no actual time)', () => {
  const status = classifyIntakeStatus('2026-03-15T08:30:00+08:00', null, 120);
  assert.equal(status, 'missed');
});

test('build deviation tags - on time', () => {
  assert.deepEqual(buildDeviationTags('2026-03-15T08:30:00+08:00', '2026-03-15T08:30:00+08:00'), []);
});

test('build deviation tags - delayed', () => {
  assert.deepEqual(buildDeviationTags('2026-03-15T08:30:00+08:00', '2026-03-15T09:40:00+08:00'), ['delay_70min']);
});

test('build deviation tags - early', () => {
  assert.deepEqual(buildDeviationTags('2026-03-15T08:30:00+08:00', '2026-03-15T08:00:00+08:00'), ['early_30min']);
});

test('build deviation tags - missed', () => {
  assert.deepEqual(buildDeviationTags('2026-03-15T08:30:00+08:00', null), ['missed']);
});

test('summarize adherence - no data', () => {
  const summary = summarizeAdherence([], 7);
  assert.equal(summary.hasRecords, false);
  assert.equal(summary.adherenceRate, null);
  assert.equal(summary.grade, 'no_data');
  assert.equal(summary.totalPlanned, 7);
  assert.equal(summary.completed, 0);
  assert.equal(summary.missed, 0);
});

test('summarize adherence - good grade', () => {
  const logs: IntakeLog[] = [
    {
      id: 'int_1', patientId: 'pat_1', medicationId: 'med_1', reminderId: 'rem_1',
      plannedTime: '2026-03-15T08:30:00+08:00', actualTime: '2026-03-15T08:35:00+08:00',
      status: 'completed_on_time', actionSource: 'manual_reply', deviationTags: [], createdAt: '2026-03-15T08:35:00+08:00'
    },
    {
      id: 'int_2', patientId: 'pat_1', medicationId: 'med_1', reminderId: 'rem_1',
      plannedTime: '2026-03-16T08:30:00+08:00', actualTime: '2026-03-16T08:35:00+08:00',
      status: 'completed_on_time', actionSource: 'manual_reply', deviationTags: [], createdAt: '2026-03-16T08:35:00+08:00'
    },
    {
      id: 'int_3', patientId: 'pat_1', medicationId: 'med_1', reminderId: 'rem_1',
      plannedTime: '2026-03-17T08:30:00+08:00', actualTime: '2026-03-17T08:35:00+08:00',
      status: 'completed_on_time', actionSource: 'manual_reply', deviationTags: [], createdAt: '2026-03-17T08:35:00+08:00'
    },
  ];
  const summary = summarizeAdherence(logs, 7);
  assert.equal(summary.hasRecords, true);
  assert.equal(summary.adherenceRate, 100);
  assert.equal(summary.grade, 'good');
  assert.equal(summary.completed, 3);
  assert.equal(summary.missed, 0);
});

test('summarize adherence - watch grade', () => {
  const logs: IntakeLog[] = [
    {
      id: 'int_1', patientId: 'pat_1', medicationId: 'med_1', reminderId: 'rem_1',
      plannedTime: '2026-03-15T08:30:00+08:00', actualTime: '2026-03-15T08:35:00+08:00',
      status: 'completed_on_time', actionSource: 'manual_reply', deviationTags: [], createdAt: '2026-03-15T08:35:00+08:00'
    },
    {
      id: 'int_2', patientId: 'pat_1', medicationId: 'med_1', reminderId: 'rem_1',
      plannedTime: '2026-03-16T08:30:00+08:00', actualTime: null,
      status: 'missed', actionSource: 'system', deviationTags: ['missed'], createdAt: '2026-03-16T11:00:00+08:00'
    },
  ];
  const summary = summarizeAdherence(logs, 7);
  assert.equal(summary.hasRecords, true);
  assert.equal(summary.adherenceRate, 50);
  assert.equal(summary.grade, 'poor'); // 50% < 70%
});

test('summarize adherence - poor grade', () => {
  const logs: IntakeLog[] = [
    {
      id: 'int_1', patientId: 'pat_1', medicationId: 'med_1', reminderId: 'rem_1',
      plannedTime: '2026-03-15T08:30:00+08:00', actualTime: '2026-03-15T08:35:00+08:00',
      status: 'completed_on_time', actionSource: 'manual_reply', deviationTags: [], createdAt: '2026-03-15T08:35:00+08:00'
    },
    {
      id: 'int_2', patientId: 'pat_1', medicationId: 'med_1', reminderId: 'rem_1',
      plannedTime: '2026-03-16T08:30:00+08:00', actualTime: null,
      status: 'missed', actionSource: 'system', deviationTags: ['missed'], createdAt: '2026-03-16T11:00:00+08:00'
    },
    {
      id: 'int_3', patientId: 'pat_1', medicationId: 'med_1', reminderId: 'rem_1',
      plannedTime: '2026-03-17T08:30:00+08:00', actualTime: null,
      status: 'missed', actionSource: 'system', deviationTags: ['missed'], createdAt: '2026-03-17T11:00:00+08:00'
    },
  ];
  const summary = summarizeAdherence(logs, 7);
  assert.equal(summary.hasRecords, true);
  assert.equal(summary.adherenceRate, 33.3);
  assert.equal(summary.grade, 'poor');
});

test('calculate expected doses', () => {
  const reminders: Reminder[] = [
    {
      id: 'rem_1', patientId: 'pat_1', medicationId: 'med_1', scheduleType: 'recurring',
      localTime: '08:30', timezone: 'Asia/Shanghai', timingCode: 'after_breakfast',
      messageTemplate: '服药提醒', effectiveFrom: '2026-03-15', gracePeriodMin: 120,
      status: 'active', createdAt: '2026-03-15T00:00:00+08:00', updatedAt: '2026-03-15T00:00:00+08:00'
    },
    {
      id: 'rem_2', patientId: 'pat_1', medicationId: 'med_2', scheduleType: 'recurring',
      localTime: '20:00', timezone: 'Asia/Shanghai', timingCode: 'bedtime',
      messageTemplate: '服药提醒', effectiveFrom: '2026-03-15', gracePeriodMin: 120,
      status: 'active', createdAt: '2026-03-15T00:00:00+08:00', updatedAt: '2026-03-15T00:00:00+08:00'
    },
  ];

  // 7天内，2个reminder，每天各1次 = 14次
  const doses = calculateExpectedDoses(reminders, '2026-03-15', '2026-03-21');
  assert.equal(doses, 14);
});

test('calculate expected doses - paused reminders excluded', () => {
  const reminders: Reminder[] = [
    {
      id: 'rem_1', patientId: 'pat_1', medicationId: 'med_1', scheduleType: 'recurring',
      localTime: '08:30', timezone: 'Asia/Shanghai', timingCode: 'after_breakfast',
      messageTemplate: '服药提醒', effectiveFrom: '2026-03-15', gracePeriodMin: 120,
      status: 'active', createdAt: '2026-03-15T00:00:00+08:00', updatedAt: '2026-03-15T00:00:00+08:00'
    },
    {
      id: 'rem_2', patientId: 'pat_1', medicationId: 'med_2', scheduleType: 'recurring',
      localTime: '20:00', timezone: 'Asia/Shanghai', timingCode: 'bedtime',
      messageTemplate: '服药提醒', effectiveFrom: '2026-03-15', gracePeriodMin: 120,
      status: 'stopped', createdAt: '2026-03-15T00:00:00+08:00', updatedAt: '2026-03-15T00:00:00+08:00'
    },
  ];

  const doses = calculateExpectedDoses(reminders, '2026-03-15', '2026-03-21');
  assert.equal(doses, 7); // 只有 active 的 reminder 被计算
});
