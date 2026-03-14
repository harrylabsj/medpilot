import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MedPilotWorkflow } from '../src/services/workflow.js';
import { registerPatient, authenticatePatient } from '../src/services/auth.js';

test('patient auth and isolation works', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medpilot-'));
  const workflow = new MedPilotWorkflow(baseDir);
  const store = workflow.getStore();
  const p1 = registerPatient(store, 'A');
  const p2 = registerPatient(store, 'B');
  assert.equal(authenticatePatient(store, p1.id, p1.token), true);
  assert.equal(authenticatePatient(store, p1.id, p2.token), false);
});

test('confirm and replace order stop old reminders', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medpilot-'));
  const workflow = new MedPilotWorkflow(baseDir);
  const p = registerPatient(workflow.getStore(), 'A');
  const initial = workflow.ingestOrder(p.id, '氯沙坦钾片 50mg，每天早饭后 1 次，每次 1 片');
  workflow.confirmOrder(p.id, initial.order.id);
  const replaced = workflow.replaceOrder(p.id, initial.order.id, '阿托伐他汀 20mg，每晚睡前 1 次，每次 1 片');
  const db = workflow.getStore().load();
  const oldReminders = db.reminders.filter(r => initial.order.medicationIds.includes(r.medicationId));
  assert.ok(oldReminders.every(r => r.status === 'stopped'));
  assert.equal(replaced.reminders[0].status, 'active');
});

test('scheduler triggers and backups/audits exist', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medpilot-'));
  const workflow = new MedPilotWorkflow(baseDir);
  const p = registerPatient(workflow.getStore(), 'A');
  const order = workflow.ingestOrder(p.id, '氯沙坦钾片 50mg，每天早饭后 1 次，每次 1 片');
  workflow.confirmOrder(p.id, order.order.id);
  const changed = workflow.runReminderScheduler('2026-03-15T09:00:00+08:00');
  assert.ok(changed.length >= 1);
  const db = workflow.getStore().load();
  assert.ok(db.auditLogs.length >= 2);
  const backupDir = path.join(baseDir, 'data', 'backups');
  assert.equal(fs.existsSync(backupDir), true);
});
