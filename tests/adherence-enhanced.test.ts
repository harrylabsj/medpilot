import test from 'node:test';
import assert from 'node:assert/strict';
import type { Reminder, IntakeLog } from '../src/models/types.js';
import { calculateExpectedDoses, summarizeAdherenceWithExpected } from '../src/rules/adherence.js';

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

test('calculate expected doses - full period', () => {
  const reminders = [mockReminder];
  const expected = calculateExpectedDoses(reminders, '2026-03-15', '2026-03-17');
  // 3 days * 1 dose per day = 3
  assert.equal(expected, 3);
});

test('calculate expected doses - partial overlap', () => {
  const reminder = { ...mockReminder, effectiveFrom: '2026-03-16' };
  const reminders = [reminder];
  const expected = calculateExpectedDoses(reminders, '2026-03-15', '2026-03-17');
  // Reminder starts on 03-16, so only 2 days (03-16, 03-17)
  assert.equal(expected, 2);
});

test('calculate expected doses - with effectiveTo', () => {
  const reminder = { ...mockReminder, effectiveTo: '2026-03-16' };
  const reminders = [reminder];
  const expected = calculateExpectedDoses(reminders, '2026-03-15', '2026-03-20');
  // Reminder ends on 03-16, so only 2 days (03-15, 03-16)
  assert.equal(expected, 2);
});

test('calculate expected doses - no overlap', () => {
  const reminder = { ...mockReminder, effectiveFrom: '2026-04-01' };
  const reminders = [reminder];
  const expected = calculateExpectedDoses(reminders, '2026-03-15', '2026-03-17');
  // No overlap
  assert.equal(expected, 0);
});

test('calculate expected doses - multiple reminders', () => {
  const reminder2 = { ...mockReminder, id: 'rem_2' };
  const reminders = [mockReminder, reminder2];
  const expected = calculateExpectedDoses(reminders, '2026-03-15', '2026-03-15');
  // 1 day: reminder1 (1 dose) + reminder2 (1 dose) = 2
  assert.equal(expected, 2);
});

test('calculate expected doses - paused reminders included', () => {
  const pausedReminder = { ...mockReminder, status: 'paused' as const };
  const reminders = [pausedReminder];
  const expected = calculateExpectedDoses(reminders, '2026-03-15', '2026-03-15');
  // Paused reminders are still counted in expected doses
  assert.equal(expected, 1);
});

test('summarize adherence with expected - no data', () => {
  const logs: IntakeLog[] = [];
  const summary = summarizeAdherenceWithExpected(logs, 7);
  assert.equal(summary.totalPlanned, 7);
  assert.equal(summary.completed, 0);
  assert.equal(summary.missed, 7);
  assert.equal(summary.adherenceRate, null);
  assert.equal(summary.grade, 'no_data');
  assert.equal(summary.hasRecords, false);
});

test('summarize adherence with expected - perfect adherence', () => {
  const logs: IntakeLog[] = [
    { id: '1', patientId: 'p1', medicationId: 'm1', reminderId: 'r1', plannedTime: '2026-03-15T08:30:00+08:00', actualTime: '2026-03-15T08:30:00+08:00', status: 'completed_on_time', actionSource: 'manual_reply', deviationTags: [], createdAt: '2026-03-15T08:30:00+08:00' },
    { id: '2', patientId: 'p1', medicationId: 'm1', reminderId: 'r1', plannedTime: '2026-03-16T08:30:00+08:00', actualTime: '2026-03-16T08:30:00+08:00', status: 'completed_on_time', actionSource: 'manual_reply', deviationTags: [], createdAt: '2026-03-16T08:30:00+08:00' },
  ];
  const summary = summarizeAdherenceWithExpected(logs, 2);
  assert.equal(summary.totalPlanned, 2);
  assert.equal(summary.completed, 2);
  assert.equal(summary.late, 0);
  assert.equal(summary.missed, 0);
  assert.equal(summary.adherenceRate, 100);
  assert.equal(summary.grade, 'good');
  assert.equal(summary.hasRecords, true);
});

test('summarize adherence with expected - with skipped by doctor', () => {
  const logs: IntakeLog[] = [
    { id: '1', patientId: 'p1', medicationId: 'm1', reminderId: 'r1', plannedTime: '2026-03-15T08:30:00+08:00', actualTime: '2026-03-15T08:30:00+08:00', status: 'completed_on_time', actionSource: 'manual_reply', deviationTags: [], createdAt: '2026-03-15T08:30:00+08:00' },
    { id: '2', patientId: 'p1', medicationId: 'm1', reminderId: 'r1', plannedTime: '2026-03-16T08:30:00+08:00', actualTime: null, status: 'skipped_by_doctor', actionSource: 'manual_entry', deviationTags: ['skipped_by_doctor'], reason: '手术前暂停', createdAt: '2026-03-16T08:30:00+08:00' },
  ];
  // Expected 2 doses, 1 completed, 1 skipped by doctor
  // Effective expected = 2 - 1 = 1
  // Adherence = 1/1 * 100 = 100%
  const summary = summarizeAdherenceWithExpected(logs, 2);
  assert.equal(summary.totalPlanned, 2);
  assert.equal(summary.completed, 1);
  assert.equal(summary.adherenceRate, 100);
  assert.equal(summary.grade, 'good');
});

test('summarize adherence with expected - poor grade', () => {
  const logs: IntakeLog[] = [
    { id: '1', patientId: 'p1', medicationId: 'm1', reminderId: 'r1', plannedTime: '2026-03-15T08:30:00+08:00', actualTime: '2026-03-15T08:30:00+08:00', status: 'completed_on_time', actionSource: 'manual_reply', deviationTags: [], createdAt: '2026-03-15T08:30:00+08:00' },
    { id: '2', patientId: 'p1', medicationId: 'm1', reminderId: 'r1', plannedTime: '2026-03-16T08:30:00+08:00', actualTime: null, status: 'missed', actionSource: 'manual_entry', deviationTags: ['missed'], createdAt: '2026-03-16T08:30:00+08:00' },
    { id: '3', patientId: 'p1', medicationId: 'm1', reminderId: 'r1', plannedTime: '2026-03-17T08:30:00+08:00', actualTime: null, status: 'missed', actionSource: 'manual_entry', deviationTags: ['missed'], createdAt: '2026-03-17T08:30:00+08:00' },
  ];
  // Expected 3 doses, 1 completed, 2 missed
  // Adherence = 1/3 * 100 = 33.3%
  const summary = summarizeAdherenceWithExpected(logs, 3);
  assert.equal(summary.totalPlanned, 3);
  assert.equal(summary.completed, 1);
  assert.equal(summary.missed, 2);
  assert.equal(summary.adherenceRate, 33.3);
  assert.equal(summary.grade, 'poor');
});

test('summarize adherence with expected - watch grade', () => {
  const logs: IntakeLog[] = [
    { id: '1', patientId: 'p1', medicationId: 'm1', reminderId: 'r1', plannedTime: '2026-03-15T08:30:00+08:00', actualTime: '2026-03-15T08:30:00+08:00', status: 'completed_on_time', actionSource: 'manual_reply', deviationTags: [], createdAt: '2026-03-15T08:30:00+08:00' },
    { id: '2', patientId: 'p1', medicationId: 'm1', reminderId: 'r1', plannedTime: '2026-03-16T08:30:00+08:00', actualTime: '2026-03-16T08:30:00+08:00', status: 'completed_on_time', actionSource: 'manual_reply', deviationTags: [], createdAt: '2026-03-16T08:30:00+08:00' },
    { id: '3', patientId: 'p1', medicationId: 'm1', reminderId: 'r1', plannedTime: '2026-03-17T08:30:00+08:00', actualTime: '2026-03-17T08:30:00+08:00', status: 'completed_on_time', actionSource: 'manual_reply', deviationTags: [], createdAt: '2026-03-17T08:30:00+08:00' },
    { id: '4', patientId: 'p1', medicationId: 'm1', reminderId: 'r1', plannedTime: '2026-03-18T08:30:00+08:00', actualTime: null, status: 'missed', actionSource: 'manual_entry', deviationTags: ['missed'], createdAt: '2026-03-18T08:30:00+08:00' },
  ];
  // Expected 4 doses, 3 completed, 1 missed
  // Adherence = 3/4 * 100 = 75%
  const summary = summarizeAdherenceWithExpected(logs, 4);
  assert.equal(summary.adherenceRate, 75);
  assert.equal(summary.grade, 'watch');
});
