import chalk from 'chalk';

let verboseEnabled = false;

export function setVerbose(enabled: boolean): void {
  verboseEnabled = enabled;
}

export function info(message: string): void {
  console.log(chalk.blue('info'), message);
}

export function warn(message: string): void {
  console.log(chalk.yellow('warn'), message);
}

export function error(message: string): void {
  console.log(chalk.red('error'), message);
}

export function verbose(message: string): void {
  if (verboseEnabled) {
    console.log(chalk.gray('verbose'), message);
  }
}

export function success(message: string): void {
  console.log(chalk.green('success'), message);
}
