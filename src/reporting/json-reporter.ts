import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { EvalReport } from '../types.js';

/**
 * Generate a timestamped filename for the JSON report.
 */
function generateFilename(timestamp: string): string {
  const sanitized = timestamp.replace(/[:.]/g, '-').replace(/[T ]/g, '_');
  return `eval-report_${sanitized}.json`;
}

/**
 * Write an EvalReport to a JSON file in the specified output directory.
 * Returns the full path to the written file.
 */
export async function writeJsonReport(report: EvalReport, outputDir: string): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const filename = generateFilename(report.metadata.timestamp);
  const filePath = join(outputDir, filename);
  const json = JSON.stringify(report, null, 2);

  await writeFile(filePath, json + '\n', 'utf-8');

  return filePath;
}
