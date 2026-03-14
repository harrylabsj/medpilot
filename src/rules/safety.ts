import type { Event, Medication, Metric } from '../models/types.js';
import { createId } from '../core/id.js';
import { nowIso } from '../utils/time.js';

export function evaluateMetric(metric: Metric, medications: Medication[]): Event[] {
  const relatedMedicationIds = medications.map((m) => m.id);
  const events: Event[] = [];

  if (metric.type === 'blood_pressure') {
    const systolic = Number(metric.values.systolic ?? 0);
    const diastolic = Number(metric.values.diastolic ?? 0);
    const hasHeadache = String(metric.values.symptom ?? '').includes('头痛');

    if ((systolic >= 180 || diastolic >= 120) && hasHeadache) {
      events.push({
        id: createId('evt'),
        patientId: metric.patientId,
        eventType: 'risk_alert',
        severity: 'emergency',
        title: '血压极高且伴症状',
        description: `血压 ${systolic}/${diastolic} mmHg，并伴随头痛等症状`,
        relatedIds: { metricIds: [metric.id], medicationIds: relatedMedicationIds, intakeLogIds: [] },
        actionSuggestion: '建议立即就医；如伴胸痛、气促、肢体无力或言语不清，应立即急诊。',
        ruleCode: 'BP_EMERGENCY_WITH_SYMPTOM',
        status: 'open',
        createdAt: nowIso(),
      });
    } else if (systolic >= 160 || diastolic >= 100) {
      events.push({
        id: createId('evt'),
        patientId: metric.patientId,
        eventType: 'risk_alert',
        severity: 'urgent',
        title: '血压明显升高',
        description: `家庭血压记录 ${systolic}/${diastolic} mmHg`,
        relatedIds: { metricIds: [metric.id], medicationIds: relatedMedicationIds, intakeLogIds: [] },
        actionSuggestion: '建议尽快联系医生并持续记录；若伴胸痛、气促、肢体无力、言语不清等请立即就医。',
        ruleCode: hasHeadache ? 'BP_URGENT_WITH_SYMPTOM' : 'BP_URGENT',
        status: 'open',
        createdAt: nowIso(),
      });
    }
  }

  if (metric.type === 'blood_glucose') {
    const glucose = Number(metric.values.glucose ?? 0);
    const fasting = Boolean(metric.values.fasting ?? false);
    if (fasting && glucose >= 7.0) {
      events.push({
        id: createId('evt'),
        patientId: metric.patientId,
        eventType: 'abnormal_metric',
        severity: 'followup',
        title: '空腹血糖偏高',
        description: `空腹血糖 ${glucose} mmol/L`,
        relatedIds: { metricIds: [metric.id], medicationIds: relatedMedicationIds, intakeLogIds: [] },
        actionSuggestion: '建议继续记录并复诊时与医生确认当前用药及饮食控制情况。',
        ruleCode: 'GLUCOSE_FASTING_HIGH',
        status: 'open',
        createdAt: nowIso(),
      });
    }
  }

  return events;
}
