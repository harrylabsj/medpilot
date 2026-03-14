export type SourceType = 'text' | 'image' | 'voice' | 'pdf' | 'mixed';
export type OrderStatus = 'draft' | 'active' | 'stopped' | 'expired' | 'superseded';
export type ParseStatus = 'pending' | 'needs_confirmation' | 'confirmed' | 'rejected';
export type MedicationStatus = 'active' | 'paused' | 'stopped' | 'completed';
export type TimingCode =
  | 'before_breakfast'
  | 'after_breakfast'
  | 'before_lunch'
  | 'after_lunch'
  | 'before_dinner'
  | 'after_dinner'
  | 'bedtime'
  | 'fasting'
  | 'custom';
export type IntakeStatus =
  | 'completed_on_time'
  | 'completed_late'
  | 'missed'
  | 'skipped_by_doctor'
  | 'skipped_by_patient'
  | 'unknown';
export type MetricType =
  | 'blood_pressure'
  | 'blood_glucose'
  | 'blood_lipid'
  | 'blood_test'
  | 'urine_test'
  | 'stool_test'
  | 'weight'
  | 'symptom_observation';
export type EventType =
  | 'reminder_missed'
  | 'medication_changed'
  | 'risk_alert'
  | 'abnormal_metric'
  | 'adverse_effect'
  | 'report_uploaded'
  | 'summary_generated';
export type Severity = 'info' | 'followup' | 'urgent' | 'emergency';

export interface Patient {
  id: string;
  displayName?: string;
  token: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  patientId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface Order {
  id: string;
  patientId: string;
  sourceType: SourceType;
  sourceText: string;
  issuer?: string;
  doctorName?: string;
  issuedAt?: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: OrderStatus;
  parseStatus: ParseStatus;
  confidence: number;
  medicationIds: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
export interface Medication {
  id: string;
  orderId: string;
  genericName: string;
  brandName?: string;
  form: 'tablet' | 'capsule' | 'liquid' | 'injection' | 'other';
  strength: string;
  doseAmount: number;
  doseUnit: string;
  route: 'oral' | 'topical' | 'injection' | 'other';
  frequency: 'daily' | 'weekly' | 'custom';
  timesPerDay: number;
  timingCode: TimingCode;
  timingText: string;
  startDate: string;
  endDate?: string | null;
  durationDays?: number | null;
  indication?: string;
  specialInstructions?: string;
  status: MedicationStatus;
  requiresConfirmation: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Reminder {
  id: string;
  patientId: string;
  medicationId: string;
  scheduleType: 'recurring';
  localTime: string;
  timezone: string;
  timingCode: TimingCode;
  messageTemplate: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  gracePeriodMin: number;
  status: 'active' | 'paused' | 'stopped';
  nextTriggerAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface IntakeLog {
  id: string;
  patientId: string;
  medicationId: string;
  reminderId: string;
  plannedTime: string;
  actualTime?: string | null;
  status: IntakeStatus;
  actionSource: 'manual_reply' | 'manual_entry' | 'system';
  doseTakenAmount?: number;
  doseTakenUnit?: string;
  deviationTags: string[];
  reason?: string;
  note?: string;
  createdAt: string;
}
export interface Metric {
  id: string;
  patientId: string;
  type: MetricType;
  subcategory?: string;
  collectedAt: string;
  values: Record<string, number | string | boolean | null>;
  unit?: string;
  sourceType: 'manual' | 'ocr' | 'voice' | 'imported';
  relatedMedicationIds: string[];
  interpretation?: { level: 'normal' | 'low' | 'high' | 'abnormal'; summary: string; };
  createdAt: string;
}
export interface Event {
  id: string;
  patientId: string;
  eventType: EventType;
  severity: Severity;
  title: string;
  description: string;
  relatedIds: { metricIds: string[]; medicationIds: string[]; intakeLogIds: string[]; };
  actionSuggestion: string;
  ruleCode: string;
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt?: string | null;
}
export interface Attachment {
  id: string;
  patientId: string;
  type: 'image' | 'pdf' | 'audio' | 'text';
  category: 'prescription' | 'report' | 'voice_note' | 'summary' | 'other';
  fileName: string;
  mimeType: string;
  storagePath: string;
  ocrText?: string | null;
  transcriptText?: string | null;
  linkedEntityType?: 'order' | 'metric' | 'event' | 'manual_index';
  linkedEntityId?: string;
  capturedAt?: string;
  createdAt: string;
}
export interface ManualIndex {
  id: string;
  patientId: string;
  sectionCode: string;
  sectionName: string;
  title: string;
  summary: string;
  attachmentIds: string[];
  relatedEntityIds: { orderIds: string[]; metricIds: string[]; eventIds: string[]; };
  storagePath: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
export interface AdherenceSummary {
  totalPlanned: number;
  completed: number;
  late: number;
  missed: number;
  adherenceRate: number | null;
  grade: 'good' | 'watch' | 'poor' | 'no_data';
  hasRecords: boolean;
}
export type ReminderState = 'scheduled' | 'triggered' | 'completed' | 'missed' | 'skipped_doctor' | 'skipped_patient';
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
