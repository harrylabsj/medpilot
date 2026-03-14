import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MedPilotWorkflow } from '../src/services/workflow.js';

test('workflow persists order metric and report', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medpilot-'));
  const workflow = new MedPilotWorkflow(baseDir);

  const orderBundle = workflow.ingestOrder('pat_001', '氯沙坦钾片 50mg，每天早饭后 1 次，每次 1 片');
  const medicationId = orderBundle.medications[0].id;

  const intake = workflow.recordIntake({
    patientId: 'pat_001',
    medicationId,
    plannedTime: '2026-03-15T08:30:00+08:00',
    actualTime: '2026-03-15T09:00:00+08:00',
  });
  assert.equal(intake.status, 'completed_on_time');

  const metricResult = workflow.recordMetric({
    patientId: 'pat_001',
    type: 'blood_pressure',
    values: { systolic: 168, diastolic: 102, symptom: '头痛' },
    unit: 'mmHg',
  });
  assert.equal(metricResult.events.length, 1);

  const report = workflow.buildReport('pat_001');
  assert.match(report.summary, /本周依从性/);
  assert.ok(fs.existsSync(path.join(baseDir, 'HealthManual', '05_周报与复诊摘要')));
});

test('workflow report with no intake records shows no_data', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medpilot-'));
  const workflow = new MedPilotWorkflow(baseDir);

  workflow.ingestOrder('pat_002', '氯沙坦钾片 50mg，每天早饭后 1 次，每次 1 片');

  // 不记录任何 intake，直接生成报告
  const report = workflow.buildReport('pat_002');

  // 应该显示"暂无记录"而不是 0%
  assert.match(report.summary, /本周依从性：暂无记录/);
  assert.match(report.summary, /应服药次数：\d+/);
  assert.match(report.summary, /实际记录次数：0/);
});

test('workflow report with partial intake records', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medpilot-'));
  const workflow = new MedPilotWorkflow(baseDir);

  const orderBundle = workflow.ingestOrder('pat_003', '氯沙坦钾片 50mg，每天早饭后 1 次，每次 1 片');
  const medicationId = orderBundle.medications[0].id;

  // 记录 2 次服药，1 次按时，1 次延迟
  workflow.recordIntake({
    patientId: 'pat_003',
    medicationId,
    plannedTime: '2026-03-15T08:30:00+08:00',
    actualTime: '2026-03-15T08:35:00+08:00',
  });

  workflow.recordIntake({
    patientId: 'pat_003',
    medicationId,
    plannedTime: '2026-03-16T08:30:00+08:00',
    actualTime: '2026-03-16T09:10:00+08:00', // 延迟 40 分钟
  });

  const report = workflow.buildReport('pat_003', {
    startDate: '2026-03-15',
    endDate: '2026-03-21',
  });

  assert.match(report.summary, /按时完成：1次/);
  assert.match(report.summary, /延迟完成：1次/);
});

test('workflow skip intake by doctor', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medpilot-'));
  const workflow = new MedPilotWorkflow(baseDir);

  const orderBundle = workflow.ingestOrder('pat_004', '氯沙坦钾片 50mg，每天早饭后 1 次，每次 1 片');
  const medicationId = orderBundle.medications[0].id;

  const { intakeLog, instance } = workflow.skipIntake({
    patientId: 'pat_004',
    medicationId,
    plannedTime: '2026-03-15T08:30:00+08:00',
    skippedBy: 'doctor',
    reason: '手术前暂停',
  });

  assert.equal(intakeLog.status, 'skipped_by_doctor');
  assert.equal(instance.state, 'skipped_doctor');
  assert.equal(intakeLog.reason, '手术前暂停');
});

test('workflow skip intake by patient', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medpilot-'));
  const workflow = new MedPilotWorkflow(baseDir);

  const orderBundle = workflow.ingestOrder('pat_005', '氯沙坦钾片 50mg，每天早饭后 1 次，每次 1 片');
  const medicationId = orderBundle.medications[0].id;

  const { intakeLog, instance } = workflow.skipIntake({
    patientId: 'pat_005',
    medicationId,
    plannedTime: '2026-03-15T08:30:00+08:00',
    skippedBy: 'patient',
    reason: '外出忘记带药',
  });

  assert.equal(intakeLog.status, 'skipped_by_patient');
  assert.equal(instance.state, 'skipped_patient');
});

test('workflow record intake with state', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medpilot-'));
  const workflow = new MedPilotWorkflow(baseDir);

  const orderBundle = workflow.ingestOrder('pat_006', '氯沙坦钾片 50mg，每天早饭后 1 次，每次 1 片');
  const medicationId = orderBundle.medications[0].id;

  const { intakeLog, instance } = workflow.recordIntakeWithState({
    patientId: 'pat_006',
    medicationId,
    plannedTime: '2026-03-15T08:30:00+08:00',
    actualTime: '2026-03-15T08:35:00+08:00',
    note: '按时服药',
  });

  assert.equal(intakeLog.status, 'completed_on_time');
  assert.equal(instance.state, 'completed');
  assert.equal(intakeLog.note, '按时服药');
});

test('workflow mark missed', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medpilot-'));
  const workflow = new MedPilotWorkflow(baseDir);

  const orderBundle = workflow.ingestOrder('pat_007', '氯沙坦钾片 50mg，每天早饭后 1 次，每次 1 片');
  const medicationId = orderBundle.medications[0].id;

  // 先创建一个 triggered 状态的 instance
  workflow.recordIntakeWithState({
    patientId: 'pat_007',
    medicationId,
    plannedTime: '2026-03-15T08:30:00+08:00',
    actualTime: null,
  });

  // 标记为漏服
  const { instance } = workflow.markMissed({
    patientId: 'pat_007',
    medicationId,
    plannedTime: '2026-03-16T08:30:00+08:00',
  });

  assert.equal(instance.state, 'missed');
});

test('workflow get expected intakes', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medpilot-'));
  const workflow = new MedPilotWorkflow(baseDir);

  workflow.ingestOrder('pat_008', '氯沙坦钾片 50mg，每天早饭后 1 次，每次 1 片');

  const instances = workflow.getExpectedIntakes('pat_008', '2026-03-15', '2026-03-17');

  // 3天，每天1次
  assert.equal(instances.length, 3);
  assert.equal(instances[0].state, 'scheduled');
});
