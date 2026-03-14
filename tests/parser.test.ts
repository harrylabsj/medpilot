import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInstructionText } from '../src/services/parser.js';

test('parse instruction text into order bundle', () => {
  const result = parseInstructionText('pat_1', '氯沙坦钾片 50mg，每天早饭后 1 次，每次 1 片');
  assert.equal(result.order.parseStatus, 'confirmed');
  assert.equal(result.medications[0].genericName, '氯沙坦钾');
  assert.equal(result.reminders[0].localTime, '08:30');
});
