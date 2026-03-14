import fs from 'node:fs';
import path from 'node:path';
import { createId } from '../core/id.js';
import type { Attachment, AuditLog, Event, IntakeLog, ManualIndex, Medication, Metric, Order, Patient, Reminder, ReminderInstance } from '../models/types.js';
import { nowIso } from '../utils/time.js';

export interface DatabaseSchema {
  patients: Patient[];
  orders: Order[];
  medications: Medication[];
  reminders: Reminder[];
  reminderInstances: ReminderInstance[];
  intakeLogs: IntakeLog[];
  metrics: Metric[];
  events: Event[];
  attachments: Attachment[];
  manualIndexes: ManualIndex[];
  auditLogs: AuditLog[];
}

export const emptyDb = (): DatabaseSchema => ({
  patients: [], orders: [], medications: [], reminders: [], reminderInstances: [], intakeLogs: [], metrics: [], events: [], attachments: [], manualIndexes: [], auditLogs: [],
});

export class JsonStore {
  constructor(private readonly filePath: string) {}
  private ensureDir(): void { fs.mkdirSync(path.dirname(this.filePath), { recursive: true }); }
  private backup(db: DatabaseSchema): void {
    const backupDir = path.join(path.dirname(this.filePath), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = nowIso().replace(/[.:]/g, '-');
    fs.writeFileSync(path.join(backupDir, `${stamp}.json`), JSON.stringify(db, null, 2), 'utf8');
  }
  load(): DatabaseSchema {
    this.ensureDir();
    if (!fs.existsSync(this.filePath)) { const initial = emptyDb(); this.save(initial, false); return initial; }
    const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<DatabaseSchema>;
    return { ...emptyDb(), ...raw };
  }
  save(db: DatabaseSchema, makeBackup = true): void {
    this.ensureDir();
    if (makeBackup && fs.existsSync(this.filePath)) { this.backup(JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as DatabaseSchema); }
    fs.writeFileSync(this.filePath, JSON.stringify(db, null, 2), 'utf8');
  }
  transaction<T>(fn: (db: DatabaseSchema) => T, audit?: { actor: string; action: string; patientId?: string; details?: Record<string, unknown> }): T {
    const db = this.load();
    const result = fn(db);
    if (audit) db.auditLogs.push({ id: createId('audit'), actor: audit.actor, action: audit.action, patientId: audit.patientId, details: audit.details, createdAt: nowIso() });
    this.save(db, true);
    return result;
  }
}
