import path from 'node:path';
import { createId } from '../core/id.js';
import type { Metric, Reminder, ReminderInstance } from '../models/types.js';
import { evaluateMetric } from '../rules/safety.js';
import { isoDate, nowIso } from '../utils/time.js';
import { HealthManualService } from './manual.js';
import { parseInstructionText } from './parser.js';
import { buildWeeklyReport } from './report.js';
import { JsonStore } from './store.js';
import { createIntakeLog } from './intake.js';
import { completeReminder, createReminderInstance, generateReminderInstances, isReminderExpired, markReminderMissed, skipReminder, triggerReminder } from './reminder.js';

export class MedPilotWorkflow {
  private readonly store: JsonStore;
  private readonly manual: HealthManualService;
  constructor(private readonly baseDir: string) { this.store = new JsonStore(path.join(baseDir, 'data', 'db.json')); this.manual = new HealthManualService(path.join(baseDir, 'HealthManual')); this.manual.ensureBaseStructure(); }
  getStore(): JsonStore { return this.store; }
  ingestOrder(patientId: string, sourceText: string) {
    const parsed = parseInstructionText(patientId, sourceText);
    this.store.transaction((db) => { db.orders.push(parsed.order); db.medications.push(...parsed.medications); db.reminders.push(...parsed.reminders); }, { actor: patientId, action: 'order.ingest', patientId, details: { orderId: parsed.order.id } });
    return parsed;
  }
  confirmOrder(patientId: string, orderId: string) {
    return this.store.transaction((db) => {
      const order = db.orders.find((o) => o.id === orderId && o.patientId === patientId); if (!order) throw new Error('Order not found');
      order.parseStatus = 'confirmed'; order.updatedAt = nowIso();
      db.medications.filter((m) => m.orderId === orderId).forEach((m) => { m.requiresConfirmation = false; m.updatedAt = nowIso(); });
      db.reminders.filter((r) => r.patientId === patientId && order.medicationIds.includes(r.medicationId)).forEach((r) => { r.status = 'active'; r.updatedAt = nowIso(); });
      return order;
    }, { actor: patientId, action: 'order.confirm', patientId, details: { orderId } });
  }
  replaceOrder(patientId: string, oldOrderId: string, sourceText: string) {
    return this.store.transaction((db) => {
      const oldOrder = db.orders.find((o) => o.id === oldOrderId && o.patientId === patientId); if (!oldOrder) throw new Error('Old order not found');
      oldOrder.status = 'superseded'; oldOrder.effectiveTo = isoDate(nowIso()); oldOrder.updatedAt = nowIso();
      db.medications.filter((m) => m.orderId === oldOrderId).forEach((m) => { m.status = 'stopped'; m.updatedAt = nowIso(); });
      db.reminders.filter((r) => r.patientId === patientId && oldOrder.medicationIds.includes(r.medicationId)).forEach((r) => { r.status = 'stopped'; r.updatedAt = nowIso(); });
      const parsed = parseInstructionText(patientId, sourceText);
      db.orders.push(parsed.order); db.medications.push(...parsed.medications); db.reminders.push(...parsed.reminders);
      return parsed;
    }, { actor: patientId, action: 'order.replace', patientId, details: { oldOrderId } });
  }
  recordIntake(input:{ patientId:string; medicationId:string; plannedTime:string; actualTime?:string|null; reason?:string; note?:string; }) {
    return this.store.transaction((db) => { const reminder = db.reminders.find((i) => i.medicationId===input.medicationId && i.status==='active'); if(!reminder) throw new Error('Active reminder not found for medication'); const intake=createIntakeLog({ patientId:input.patientId, medicationId:input.medicationId, reminder, plannedTime:input.plannedTime, actualTime:input.actualTime, reason:input.reason, note:input.note }); db.intakeLogs.push(intake); return intake; }, { actor: input.patientId, action: 'intake.record', patientId: input.patientId, details: { medicationId: input.medicationId } });
  }
  recordIntakeWithState(input:{ patientId:string; medicationId:string; plannedTime:string; actualTime?:string|null; note?:string; }) {
    return this.store.transaction((db)=>{ const reminder=db.reminders.find((i)=>i.medicationId===input.medicationId && i.status==='active'); if(!reminder) throw new Error('Active reminder not found for medication'); let instance=db.reminderInstances.find((ri)=>ri.reminderId===reminder.id && ri.plannedTime===input.plannedTime); if(!instance){ instance=createReminderInstance(reminder,input.plannedTime); db.reminderInstances.push(instance);} if(instance.state==='scheduled'){ Object.assign(instance, triggerReminder(instance)); } const { instance:updatedInstance, intakeLog } = completeReminder(instance, reminder, input.actualTime, input.note); Object.assign(instance, updatedInstance); db.intakeLogs.push(intakeLog); return { intakeLog, instance }; }, { actor: input.patientId, action: 'intake.record.stateful', patientId: input.patientId, details: { medicationId: input.medicationId } });
  }
  skipIntake(input:{ patientId:string; medicationId:string; plannedTime:string; skippedBy:'doctor'|'patient'; reason?:string; }) {
    return this.store.transaction((db)=>{ const reminder=db.reminders.find((i)=>i.medicationId===input.medicationId && i.status==='active'); if(!reminder) throw new Error('Active reminder not found for medication'); let instance=db.reminderInstances.find((ri)=>ri.reminderId===reminder.id && ri.plannedTime===input.plannedTime); if(!instance){ instance=createReminderInstance(reminder,input.plannedTime); db.reminderInstances.push(instance);} const { instance:updatedInstance, intakeLog } = skipReminder(instance,input.skippedBy,input.reason); Object.assign(instance,updatedInstance); db.intakeLogs.push(intakeLog); return { intakeLog, instance }; }, { actor: input.patientId, action: 'intake.skip', patientId: input.patientId, details: { skippedBy: input.skippedBy } });
  }
  markMissed(input:{ patientId:string; medicationId:string; plannedTime:string; }) {
    return this.store.transaction((db)=>{ const reminder=db.reminders.find((i)=>i.medicationId===input.medicationId && i.status==='active'); if(!reminder) throw new Error('Active reminder not found for medication'); let instance=db.reminderInstances.find((ri)=>ri.reminderId===reminder.id && ri.plannedTime===input.plannedTime); if(!instance){ instance=createReminderInstance(reminder,input.plannedTime); db.reminderInstances.push(instance);} const updatedInstance=markReminderMissed(instance); Object.assign(instance,updatedInstance); return { instance }; }, { actor: 'system', action: 'intake.missed', patientId: input.patientId, details: { medicationId: input.medicationId } });
  }
  runReminderScheduler(currentTime = nowIso()) {
    return this.store.transaction((db) => {
      const changed: ReminderInstance[] = [];
      const today = isoDate(currentTime);
      for (const reminder of db.reminders.filter((r) => r.status === 'active')) {
        const plannedTime = `${today}T${reminder.localTime}:00+08:00`;
        let instance = db.reminderInstances.find((ri) => ri.reminderId === reminder.id && ri.plannedTime === plannedTime);
        if (!instance) { instance = createReminderInstance(reminder, plannedTime); db.reminderInstances.push(instance); }
        if (instance.state === 'scheduled' && new Date(currentTime).getTime() >= new Date(plannedTime).getTime()) { Object.assign(instance, triggerReminder(instance)); changed.push(instance); }
        if (isReminderExpired(instance, reminder, currentTime)) { Object.assign(instance, markReminderMissed(instance)); changed.push(instance); }
      }
      return changed;
    }, { actor: 'system', action: 'scheduler.run' });
  }
  recordMetric(input:{ patientId:string; type:Metric['type']; values:Metric['values']; unit?:string; }) {
    return this.store.transaction((db)=>{ const metric:Metric={ id:createId('met'), patientId:input.patientId, type:input.type, collectedAt:nowIso(), values:input.values, unit:input.unit, sourceType:'manual', relatedMedicationIds:db.medications.filter((i)=>i.status==='active').map((i)=>i.id), interpretation:undefined, createdAt:nowIso() }; db.metrics.push(metric); const events=evaluateMetric(metric, db.medications.filter((i)=>i.status==='active')); db.events.push(...events); return { metric, events }; }, { actor: input.patientId, action: 'metric.record', patientId: input.patientId, details: { type: input.type } });
  }
  buildReport(patientId:string, options?:{ startDate?:string; endDate?:string; }) {
    return this.store.transaction((db)=>{ const endDate=options?.endDate || isoDate(nowIso()); const startDate=options?.startDate || isoDate(new Date(Date.now()-7*24*60*60*1000).toISOString()); const report=buildWeeklyReport({ patientId, orders:db.orders.filter((i)=>i.patientId===patientId), medications:db.medications.filter((i)=>db.orders.some((o)=>o.id===i.orderId && o.patientId===patientId)), reminders:db.reminders.filter((i)=>i.patientId===patientId), intakeLogs:db.intakeLogs.filter((i)=>i.patientId===patientId), metrics:db.metrics.filter((i)=>i.patientId===patientId), events:db.events.filter((i)=>i.patientId===patientId), reportStartDate:startDate, reportEndDate:endDate }); db.manualIndexes.push(report.manualIndex); this.manual.writeSummary(report.manualIndex); return report; }, { actor: patientId, action: 'report.build', patientId });
  }
  listActiveReminders(patientId:string): Reminder[] { const db=this.store.load(); return db.reminders.filter((i)=>i.patientId===patientId && i.status==='active'); }
  getExpectedIntakes(patientId:string, startDate:string, endDate:string): ReminderInstance[] { const db=this.store.load(); const reminders=db.reminders.filter((r)=>r.patientId===patientId && (r.status==='active' || r.status==='paused')); const instances:ReminderInstance[]=[]; for(const reminder of reminders){ instances.push(...generateReminderInstances(reminder,startDate,endDate)); } return instances; }
}
