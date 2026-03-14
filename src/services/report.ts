import { createId } from '../core/id.js';
import type { Event, IntakeLog, ManualIndex, Medication, Metric, Order, Reminder } from '../models/types.js';
import { calculateExpectedDoses, summarizeAdherenceWithExpected } from '../rules/adherence.js';
import { isoDate, nowIso } from '../utils/time.js';

export interface WeeklyReportInput {
  patientId: string;
  orders: Order[];
  medications: Medication[];
  reminders: Reminder[];
  intakeLogs: IntakeLog[];
  metrics: Metric[];
  events: Event[];
  reportStartDate?: string;
  reportEndDate?: string;
}

export function buildWeeklyReport(input: WeeklyReportInput): { summary: string; manualIndex: ManualIndex } {
  // 确定报告周期（默认最近7天）
  const endDate = input.reportEndDate || isoDate(nowIso());
  const startDate = input.reportStartDate || isoDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  // 过滤报告周期内的 intake logs
  const periodLogs = input.intakeLogs.filter(
    (log) => isoDate(log.plannedTime) >= startDate && isoDate(log.plannedTime) <= endDate
  );

  // 计算预期服药次数
  const expectedDoses = calculateExpectedDoses(input.reminders, startDate, endDate);

  // 计算依从性（使用改进的统计方法）
  const adherence = summarizeAdherenceWithExpected(periodLogs, expectedDoses);

  const openEvents = input.events.filter((event) => event.status === 'open');
  const bpMetrics = input.metrics.filter((metric) => metric.type === 'blood_pressure');
  const recentBp = bpMetrics.slice(-3).map((metric) => `${metric.values.systolic}/${metric.values.diastolic}`).join('、') || '无';
  const activeMeds = input.medications.filter((med) => med.status === 'active').map((med) => med.genericName).join('、') || '无';

  // 构建依从性描述
  let adherenceText: string;
  if (!adherence.hasRecords) {
    adherenceText = '暂无记录';
  } else {
    adherenceText = `${adherence.adherenceRate}%（等级：${adherence.grade}）`;
  }

  const summary = [
    `当前用药：${activeMeds}`,
    `本周依从性：${adherenceText}`,
    `应服药次数：${adherence.totalPlanned}`,
    `实际记录次数：${periodLogs.length}`,
    `按时完成：${adherence.completed - adherence.late}次`,
    `延迟完成：${adherence.late}次`,
    `漏服次数：${adherence.missed}`,
    `最近血压记录：${recentBp}`,
    `未解决风险事件：${openEvents.length}`,
  ].join('\n');

  const date = nowIso().slice(0, 10);
  const manualIndex: ManualIndex = {
    id: createId('man'),
    patientId: input.patientId,
    sectionCode: 'followup_summary',
    sectionName: '复诊摘要',
    title: `${date} 复诊前摘要`,
    summary,
    attachmentIds: [],
    relatedEntityIds: {
      orderIds: input.orders.map((order) => order.id),
      metricIds: input.metrics.map((metric) => metric.id),
      eventIds: input.events.map((event) => event.id),
    },
    storagePath: `HealthManual/05_周报与复诊摘要/${date}_复诊前摘要.md`,
    tags: ['复诊', '周报', '慢病管理'],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  return { summary, manualIndex };
}
