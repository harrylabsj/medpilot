#!/usr/bin/env node
import { Command } from 'commander';
import path from 'node:path';
import { parseInstructionText } from './services/parser.js';
import { HealthManualService } from './services/manual.js';
import { MedPilotWorkflow } from './services/workflow.js';

const program = new Command();

program.name('medpilot').description('MedPilot MVP CLI').version('0.1.0');

program
  .command('parse-order')
  .requiredOption('--patient <id>', 'patient id')
  .requiredOption('--text <text>', 'instruction text')
  .action((options) => {
    const result = parseInstructionText(options.patient, options.text);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command('init-manual')
  .option('--dir <dir>', 'HealthManual directory', path.resolve(process.cwd(), 'HealthManual'))
  .action((options) => {
    const service = new HealthManualService(options.dir);
    service.ensureBaseStructure();
    console.log(`HealthManual initialized at ${options.dir}`);
  });

program
  .command('ingest-order')
  .requiredOption('--patient <id>', 'patient id')
  .requiredOption('--text <text>', 'instruction text')
  .option('--base-dir <dir>', 'project base dir', process.cwd())
  .action((options) => {
    const workflow = new MedPilotWorkflow(options.baseDir);
    const result = workflow.ingestOrder(options.patient, options.text);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command('record-metric')
  .requiredOption('--patient <id>', 'patient id')
  .requiredOption('--type <type>', 'metric type')
  .requiredOption('--values <json>', 'metric values json')
  .option('--unit <unit>', 'metric unit')
  .option('--base-dir <dir>', 'project base dir', process.cwd())
  .action((options) => {
    const workflow = new MedPilotWorkflow(options.baseDir);
    const result = workflow.recordMetric({
      patientId: options.patient,
      type: options.type,
      values: JSON.parse(options.values),
      unit: options.unit,
    });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command('record-intake')
  .requiredOption('--patient <id>', 'patient id')
  .requiredOption('--medication <id>', 'medication id')
  .requiredOption('--planned <iso>', 'planned time iso')
  .option('--actual <iso>', 'actual time iso')
  .option('--reason <reason>', 'reason')
  .option('--note <note>', 'note')
  .option('--base-dir <dir>', 'project base dir', process.cwd())
  .action((options) => {
    const workflow = new MedPilotWorkflow(options.baseDir);
    const result = workflow.recordIntake({
      patientId: options.patient,
      medicationId: options.medication,
      plannedTime: options.planned,
      actualTime: options.actual,
      reason: options.reason,
      note: options.note,
    });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command('build-report')
  .requiredOption('--patient <id>', 'patient id')
  .option('--base-dir <dir>', 'project base dir', process.cwd())
  .action((options) => {
    const workflow = new MedPilotWorkflow(options.baseDir);
    const result = workflow.buildReport(options.patient);
    console.log(JSON.stringify(result, null, 2));
  });

program.parse();
