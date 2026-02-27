import { Command } from 'commander';

const program = new Command();

program
  .name('pf-migration-eval')
  .description('PatternFly 5-to-6 Migration Evaluation Suite')
  .version('0.1.0');

program
  .option('--golden-pr <url>', 'GitHub PR URL for the golden (reference) migration')
  .option('--migration-pr <url>', 'GitHub PR URL for the migration to evaluate')
  .option('--golden-dir <path>', 'Local directory for the golden (reference) migration')
  .option('--migration-dir <path>', 'Local directory for the migration to evaluate')
  .option('--output-dir <path>', 'Directory for output reports', './results')
  .option('--verbose', 'Print detailed detection results during analysis', false);

program.action(async (options) => {
  const { goldenPr, migrationPr, goldenDir, migrationDir, outputDir, verbose } = options;

  const hasPrInput = goldenPr && migrationPr;
  const hasDirInput = goldenDir && migrationDir;

  if (!hasPrInput && !hasDirInput) {
    console.error(
      'Error: Provide either --golden-pr and --migration-pr, or --golden-dir and --migration-dir.',
    );
    process.exit(1);
  }

  // TODO: Wire up the full pipeline in US-022
  console.log('PF Migration Eval');
  console.log(`Output directory: ${outputDir}`);
  console.log(`Verbose: ${verbose}`);

  if (hasPrInput) {
    console.log(`Golden PR: ${goldenPr}`);
    console.log(`Migration PR: ${migrationPr}`);
  } else {
    console.log(`Golden dir: ${goldenDir}`);
    console.log(`Migration dir: ${migrationDir}`);
  }
});

program.parse();
