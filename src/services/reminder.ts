import { createId } from '../core/id.js';
import type { IntakeLog, Reminder } from '../models/types.js';
import { classifyIntakeStatus } from '../rules/adherence.js';
import { isoDate, nowIso } from '../utils/time.js';

export type ReminderState =
  | 'scheduled'      // 已安排，等待触发
  | 'triggered'      // 已触发，等待患者响应
  | 'completed'      // 已完成（患者已服药）
  | 'missed'         // 已漏服（超过宽限期）
  | 'skipped_doctor' // 医生要求跳过
  | 'skipped_patient'; // 患者主动跳过

export interface ReminderStateTransition {
  from: ReminderState | ReminderState[];
  to: ReminderState;
  condition: string;
  action?: (reminder: Reminder, data?: unknown) => void;
}

// 有效的状态流转规则
export const validTransitions: ReminderStateTransition[] = [
  { from: 'scheduled', to: 'triggered', condition: '到达提醒时间' },
  { from: 'triggered', to: 'completed', condition: '患者确认已服药' },
  { from: 'triggered', to: 'missed', condition: '超过宽限期未响应' },
  { from: ['scheduled', 'triggered'], to: 'skipped_patient', condition: '患者主动跳过' },
  { from: ['scheduled', 'triggered'], to: 'skipped_doctor', condition: '医生要求跳过' },
  // 允许从 scheduled 直接标记为 missed（系统检测到过期未触发的情况）
  { from: 'scheduled', to: 'missed', condition: '系统检测到已过期未触发' },
];

/**
 * 检查状态流转是否有效
 */
export function canTransition(from: ReminderState, to: ReminderState): boolean {
  return validTransitions.some(
    (t) =>
      (Array.isArray(t.from) ? t.from.includes(from) : t.from === from) &&
      t.to === to
  );
}

/**
 * 创建新的提醒实例（用于单次提醒追踪）
 */
export interface ReminderInstance {
  id: string;
  reminderId: string;
  patientId: string;
  medicationId: string;
  plannedTime: string;
  state: ReminderState;
  triggeredAt?: string;
  completedAt?: string;
  intakeLogId?: string;
  createdAt: string;
}

export function createReminderInstance(
  reminder: Reminder,
  plannedTime: string
): ReminderInstance {
  return {
    id: createId('remi'),
    reminderId: reminder.id,
    patientId: reminder.patientId,
    medicationId: reminder.medicationId,
    plannedTime,
    state: 'scheduled',
    createdAt: nowIso(),
  };
}

/**
 * 触发提醒
 */
export function triggerReminder(instance: ReminderInstance): ReminderInstance {
  if (!canTransition(instance.state, 'triggered')) {
    throw new Error(`无法从状态 ${instance.state} 触发提醒`);
  }
  return {
    ...instance,
    state: 'triggered',
    triggeredAt: nowIso(),
  };
}

/**
 * 完成提醒并创建 intake log
 */
export function completeReminder(
  instance: ReminderInstance,
  reminder: Reminder,
  actualTime?: string | null,
  note?: string
): { instance: ReminderInstance; intakeLog: IntakeLog } {
  if (!canTransition(instance.state, 'completed')) {
    throw new Error(`无法从状态 ${instance.state} 完成提醒`);
  }

  const finalActualTime = actualTime || nowIso();
  const intakeLog: IntakeLog = {
    id: createId('int'),
    patientId: instance.patientId,
    medicationId: instance.medicationId,
    reminderId: instance.reminderId,
    plannedTime: instance.plannedTime,
    actualTime: finalActualTime,
    status: classifyIntakeStatus(instance.plannedTime, finalActualTime, reminder.gracePeriodMin),
    actionSource: 'manual_reply',
    doseTakenAmount: 1,
    doseTakenUnit: 'tablet',
    deviationTags: [], // 由 adherence 规则计算
    note,
    createdAt: nowIso(),
  };

  const updatedInstance: ReminderInstance = {
    ...instance,
    state: 'completed',
    completedAt: nowIso(),
    intakeLogId: intakeLog.id,
  };

  return { instance: updatedInstance, intakeLog };
}

/**
 * 标记为漏服
 */
export function markReminderMissed(instance: ReminderInstance): ReminderInstance {
  if (!canTransition(instance.state, 'missed')) {
    throw new Error(`无法从状态 ${instance.state} 标记为漏服`);
  }
  return {
    ...instance,
    state: 'missed',
    completedAt: nowIso(),
  };
}

/**
 * 标记为跳过（医生或患者）
 */
export function skipReminder(
  instance: ReminderInstance,
  skippedBy: 'doctor' | 'patient',
  reason?: string
): { instance: ReminderInstance; intakeLog: IntakeLog } {
  const newState: ReminderState = skippedBy === 'doctor' ? 'skipped_doctor' : 'skipped_patient';

  if (!canTransition(instance.state, newState)) {
    throw new Error(`无法从状态 ${instance.state} 标记为${skippedBy === 'doctor' ? '医生跳过' : '患者跳过'}`);
  }

  const intakeLog: IntakeLog = {
    id: createId('int'),
    patientId: instance.patientId,
    medicationId: instance.medicationId,
    reminderId: instance.reminderId,
    plannedTime: instance.plannedTime,
    actualTime: null,
    status: skippedBy === 'doctor' ? 'skipped_by_doctor' : 'skipped_by_patient',
    actionSource: skippedBy === 'doctor' ? 'manual_entry' : 'manual_reply',
    deviationTags: [skippedBy === 'doctor' ? 'skipped_by_doctor' : 'skipped_by_patient'],
    reason,
    createdAt: nowIso(),
  };

  const updatedInstance: ReminderInstance = {
    ...instance,
    state: newState,
    completedAt: nowIso(),
    intakeLogId: intakeLog.id,
  };

  return { instance: updatedInstance, intakeLog };
}

/**
 * 检查提醒是否过期（用于定时任务）
 */
export function isReminderExpired(
  instance: ReminderInstance,
  reminder: Reminder,
  currentTime: string = nowIso()
): boolean {
  if (instance.state !== 'triggered') return false;

  const planned = new Date(instance.plannedTime).getTime();
  const current = new Date(currentTime).getTime();
  const gracePeriodMs = reminder.gracePeriodMin * 60 * 1000;

  return current > planned + gracePeriodMs;
}

/**
 * 生成周期内的所有提醒实例
 */
export function generateReminderInstances(
  reminder: Reminder,
  startDate: string,
  endDate: string
): ReminderInstance[] {
  const instances: ReminderInstance[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // 简单实现：每天生成一个实例
  // 实际项目中可能需要根据 frequency 和 timesPerDay 更复杂计算
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = isoDate(d.toISOString());
    const plannedTime = `${dateStr}T${reminder.localTime}:00${reminder.timezone === 'Asia/Shanghai' ? '+08:00' : ''}`;

    instances.push(createReminderInstance(reminder, plannedTime));
  }

  return instances;
}
