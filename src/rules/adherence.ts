import type { AdherenceSummary, IntakeLog, Reminder } from '../models/types.js';
import { minutesBetween } from '../utils/time.js';

export function classifyIntakeStatus(
  plannedTime: string,
  actualTime: string | null | undefined,
  gracePeriodMin: number,
): IntakeLog['status'] {
  if (!actualTime) return 'missed';
  const delay = Math.abs(minutesBetween(plannedTime, actualTime));
  if (delay <= 30) return 'completed_on_time';
  if (delay <= gracePeriodMin) return 'completed_late';
  return 'missed';
}

export function buildDeviationTags(plannedTime: string, actualTime: string | null | undefined): string[] {
  if (!actualTime) return ['missed'];
  const delay = minutesBetween(plannedTime, actualTime);
  if (delay === 0) return [];
  return [delay > 0 ? `delay_${delay}min` : `early_${Math.abs(delay)}min`];
}

/**
 * 计算依从性统计
 * @param logs - 实际 intake 记录
 * @param expectedDoses - 预期应服药次数（基于 reminder 计算）
 * @returns 依从性摘要
 */
export function summarizeAdherence(
  logs: IntakeLog[],
  expectedDoses: number
): AdherenceSummary {
  // 无记录的情况
  if (logs.length === 0) {
    return {
      totalPlanned: expectedDoses,
      completed: 0,
      late: 0,
      missed: 0,
      adherenceRate: null,
      grade: 'no_data',
      hasRecords: false,
    };
  }

  const totalPlanned = logs.length;
  const completedOnTime = logs.filter((log) => log.status === 'completed_on_time').length;
  const late = logs.filter((log) => log.status === 'completed_late').length;
  const missed = logs.filter((log) => log.status === 'missed').length;
  const completed = completedOnTime + late;
  const adherenceRate = Number(((completed / totalPlanned) * 100).toFixed(1));

  let grade: AdherenceSummary['grade'];
  if (adherenceRate >= 90) {
    grade = 'good';
  } else if (adherenceRate >= 70) {
    grade = 'watch';
  } else {
    grade = 'poor';
  }

  return {
    totalPlanned,
    completed,
    late,
    missed,
    adherenceRate,
    grade,
    hasRecords: true,
  };
}

/**
 * 基于 reminder 计算预期应服药次数
 * 考虑每个 reminder 的生效时间范围和报告周期
 * @param reminders - 提醒列表
 * @param startDate - 统计开始日期（ISO 日期格式）
 * @param endDate - 统计结束日期（ISO 日期格式）
 * @returns 预期应服药次数
 */
export function calculateExpectedDoses(
  reminders: Reminder[],
  startDate: string,
  endDate: string
): number {
  const reportStart = new Date(startDate);
  const reportEnd = new Date(endDate);

  return reminders
    .filter((r) => r.status === 'active' || r.status === 'paused')
    .reduce((total, reminder) => {
      // 计算 reminder 在报告周期内的有效天数
      const reminderStart = new Date(reminder.effectiveFrom);
      const reminderEnd = reminder.effectiveTo ? new Date(reminder.effectiveTo) : reportEnd;

      // 取交集：报告周期和 reminder 生效周期的重叠部分
      const effectiveStart = reminderStart > reportStart ? reminderStart : reportStart;
      const effectiveEnd = reminderEnd < reportEnd ? reminderEnd : reportEnd;

      // 如果没有重叠，跳过
      if (effectiveStart > effectiveEnd) {
        return total;
      }

      // 计算重叠天数（包含起止日期）
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysDiff = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / msPerDay) + 1;

      // 每个 reminder 代表一次服药提醒
      // 实际项目中可能需要根据 medication.frequency 和 timesPerDay 更复杂计算
      return total + daysDiff;
    }, 0);
}

/**
 * 计算更准确的依从性统计
 * 基于预期应服药次数 vs 实际记录次数
 * @param logs - 实际 intake 记录
 * @param expectedDoses - 预期应服药次数
 * @returns 依从性摘要
 */
export function summarizeAdherenceWithExpected(
  logs: IntakeLog[],
  expectedDoses: number
): AdherenceSummary {
  // 无记录的情况
  if (logs.length === 0) {
    return {
      totalPlanned: expectedDoses,
      completed: 0,
      late: 0,
      missed: expectedDoses,
      adherenceRate: null,
      grade: 'no_data',
      hasRecords: false,
    };
  }

  const completedOnTime = logs.filter((log) => log.status === 'completed_on_time').length;
  const late = logs.filter((log) => log.status === 'completed_late').length;
  const skippedDoctor = logs.filter((log) => log.status === 'skipped_by_doctor').length;
  const skippedPatient = logs.filter((log) => log.status === 'skipped_by_patient').length;
  const missed = logs.filter((log) => log.status === 'missed').length;

  const completed = completedOnTime + late;
  const totalRecorded = logs.length;

  // 依从率 = (按时完成 + 延迟完成) / 预期应服药次数
  // 跳过的不算在分母中（医生/患者主动跳过的）
  const effectiveExpected = expectedDoses - skippedDoctor;
  const adherenceRate = effectiveExpected > 0
    ? Number(((completed / effectiveExpected) * 100).toFixed(1))
    : 100;

  let grade: AdherenceSummary['grade'];
  if (adherenceRate >= 90) {
    grade = 'good';
  } else if (adherenceRate >= 70) {
    grade = 'watch';
  } else {
    grade = 'poor';
  }

  return {
    totalPlanned: expectedDoses,
    completed,
    late,
    missed,
    adherenceRate,
    grade,
    hasRecords: true,
  };
}
