import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMetric } from '../src/rules/safety.js';
import type { Medication, Metric } from '../src/models/types.js';

const medications: Medication[] = [{
  id: 'med_1',
  orderId: 'ord_1',
  genericName: '氯沙坦',
  form: 'tablet',
  strength: '50mg',
  doseAmount: 1,
  doseUnit: 'tablet',
  route: 'oral',
  frequency: 'daily',
  timesPerDay: 1,
  timingCode: 'after_breakfast',
  timingText: '早餐后',
  startDate: '2026-03-14',
  status: 'active',
  requiresConfirmation: false,
  createdAt: '2026-03-14T09:00:00+08:00',
  updatedAt: '2026-03-14T09:00:00+08:00',
}];

test('urgent blood pressure creates urgent event', () => {
  const metric: Metric = {
    id: 'met_1',
    patientId: 'pat_1',
    type: 'blood_pressure',
    collectedAt: '2026-03-15T07:10:00+08:00',
    values: { systolic: 168, diastolic: 102, symptom: '头痛' },
    unit: 'mmHg',
    sourceType: 'manual',
    relatedMedicationIds: ['med_1'],
    createdAt: '2026-03-15T07:12:00+08:00',
  };

  const events = evaluateMetric(metric, medications);
  assert.equal(events.length, 1);
  assert.equal(events[0].severity, 'urgent');
  assert.equal(events[0].ruleCode, 'BP_URGENT_WITH_SYMPTOM');
});
