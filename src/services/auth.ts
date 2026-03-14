import crypto from 'node:crypto';
import { createId } from '../core/id.js';
import type { Patient } from '../models/types.js';
import { nowIso } from '../utils/time.js';
import { JsonStore } from './store.js';

export function issueToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function registerPatient(store: JsonStore, displayName?: string): Patient {
  return store.transaction((db) => {
    const patient: Patient = { id: createId('pat'), displayName, token: issueToken(), createdAt: nowIso() };
    db.patients.push(patient);
    return patient;
  }, { actor: 'system', action: 'patient.register' });
}

export function authenticatePatient(store: JsonStore, patientId: string, token?: string): boolean {
  if (!token) return false;
  const db = store.load();
  return db.patients.some((p) => p.id === patientId && p.token === token);
}
