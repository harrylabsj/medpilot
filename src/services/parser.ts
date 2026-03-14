import { createId } from '../core/id.js';
import type { Medication, Order, Reminder, TimingCode } from '../models/types.js';
import { nowIso } from '../utils/time.js';

const timingMap: Record<string, { code: TimingCode; time: string }> = {
  早饭后: { code: 'after_breakfast', time: '08:30' }, 早餐后: { code: 'after_breakfast', time: '08:30' }, 午饭后: { code: 'after_lunch', time: '12:30' }, 晚饭后: { code: 'after_dinner', time: '18:30' }, 睡前: { code: 'bedtime', time: '22:00' },
};
export interface ParsedOrderBundle { order: Order; medications: Medication[]; reminders: Reminder[]; }

export function parseInstructionText(patientId: string, sourceText: string): ParsedOrderBundle {
  const createdAt = nowIso();
  const parts = sourceText.split(/[；;]/).map((s) => s.trim()).filter(Boolean);
  const orderId = createId('ord');
  const medications: Medication[] = [];
  const reminders: Reminder[] = [];
  for (const part of parts) {
    const medicationId = createId('med');
    const matchedName = part.match(/^([^0-9，,；;]+?)(片|胶囊|注射液)?\s*([0-9]+mg)/);
    const genericName = matchedName?.[1]?.trim() || '待确认药物';
    const strength = matchedName?.[3] || '待确认';
    const timingKey = Object.keys(timingMap).find((key) => part.includes(key)) ?? '早餐后';
    const timing = timingMap[timingKey] ?? { code: 'custom', time: '09:00' };
    const medication: Medication = {
      id: medicationId, orderId, genericName, form: 'tablet', strength, doseAmount: 1, doseUnit: 'tablet', route: 'oral', frequency: 'daily', timesPerDay: 1, timingCode: timing.code, timingText: timingKey, startDate: createdAt.slice(0,10), status: 'active', requiresConfirmation: genericName === '待确认药物', createdAt, updatedAt: createdAt,
    };
    medications.push(medication);
    reminders.push({ id: createId('rem'), patientId, medicationId, scheduleType: 'recurring', localTime: timing.time, timezone: 'Asia/Shanghai', timingCode: timing.code, messageTemplate: `请服用${genericName} 1片（${strength}），${timingKey}`, effectiveFrom: createdAt.slice(0,10), gracePeriodMin: 120, status: medication.requiresConfirmation ? 'paused' : 'active', createdAt, updatedAt: createdAt });
  }
  const order: Order = { id: orderId, patientId, sourceType: 'text', sourceText, effectiveFrom: createdAt.slice(0,10), status: 'active', parseStatus: medications.some((m)=>m.requiresConfirmation) ? 'needs_confirmation' : 'confirmed', confidence: medications.some((m)=>m.requiresConfirmation) ? 0.4 : 0.9, medicationIds: medications.map((m)=>m.id), createdAt, updatedAt: createdAt };
  return { order, medications, reminders };
}
