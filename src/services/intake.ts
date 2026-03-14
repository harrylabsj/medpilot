import { createId } from '../core/id.js';
import type { IntakeLog, Reminder } from '../models/types.js';
import { buildDeviationTags, classifyIntakeStatus } from '../rules/adherence.js';
import { nowIso } from '../utils/time.js';

export function createIntakeLog(input: {
  patientId: string;
  medicationId: string;
  reminder: Reminder;
  plannedTime: string;
  actualTime?: string | null;
  actionSource?: IntakeLog['actionSource'];
  reason?: string;
  note?: string;
}): IntakeLog {
  const actualTime = input.actualTime ?? null;
  return {
    id: createId('int'),
    patientId: input.patientId,
    medicationId: input.medicationId,
    reminderId: input.reminder.id,
    plannedTime: input.plannedTime,
    actualTime,
    status: classifyIntakeStatus(input.plannedTime, actualTime, input.reminder.gracePeriodMin),
    actionSource: input.actionSource ?? 'manual_entry',
    doseTakenAmount: actualTime ? 1 : undefined,
    doseTakenUnit: actualTime ? 'tablet' : undefined,
    deviationTags: buildDeviationTags(input.plannedTime, actualTime),
    reason: input.reason,
    note: input.note,
    createdAt: nowIso(),
  };
}
