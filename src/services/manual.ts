import fs from 'node:fs';
import path from 'node:path';
import type { Attachment, ManualIndex } from '../models/types.js';

export class HealthManualService {
  constructor(private readonly baseDir: string) {}

  ensureBaseStructure(): void {
    const sections = [
      '01_医嘱与处方',
      '02_监测记录',
      '03_检查检验',
      '04_异常事件',
      '05_周报与复诊摘要',
    ];

    for (const section of sections) {
      fs.mkdirSync(path.join(this.baseDir, section), { recursive: true });
    }
  }

  archiveAttachment(attachment: Attachment): string {
    const targetPath = path.join(this.baseDir, attachment.storagePath.replace(/^HealthManual\//, ''));
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (!fs.existsSync(targetPath)) {
      fs.writeFileSync(targetPath, `Placeholder for ${attachment.fileName}\n`, 'utf8');
    }
    return targetPath;
  }

  writeSummary(index: ManualIndex): string {
    const targetPath = path.join(this.baseDir, index.storagePath.replace(/^HealthManual\//, ''));
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const body = `# ${index.title}\n\n${index.summary}\n\nTags: ${index.tags.join(', ')}\n`;
    fs.writeFileSync(targetPath, body, 'utf8');
    return targetPath;
  }
}
