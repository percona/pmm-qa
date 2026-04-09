import { test, expect } from '@playwright/test';

class PipeAssertions {
  private command: string;
  private readonly pipeName: string;
  text: string;
  private readonly lines: string[];

  constructor(command: string, pipeName: string, pipeOutput: string) {
    this.command = command;
    this.pipeName = pipeName;
    this.text = pipeOutput;
    this.lines = this.text.trim().split('\n').filter((item) => item.trim().length > 0);
  }

  getLines(): string[] {
    return this.lines;
  }

  async equals(expectedValue: string) {
    expect(this.text, `Verify ${this.pipeName} equals ${expectedValue}!`).toBe(expectedValue);
  }

  async contains(expectedValue: string) {
    expect(this.text, `Verify ${this.pipeName} contains ${expectedValue}!`).toContain(expectedValue);
  }

  async containsMany(expectedValues: string[]) {
    for (const val of expectedValues) {
      expect.soft(this.text, `Verify ${this.pipeName} contains '${val}'`).toContain(val);
    }
    console.log(test.info().errors.length);
    const errorMsg = test.info().errors.length === 0
      ? ''
      : ` But got ${test.info().errors.length} error(s):\n${this.getErrors()}`;
    expect(
      test.info().errors,
      `'Contains all elements' should have 0 errors.${errorMsg}`,
    ).toHaveLength(0);
  }

  private getErrors(): string {
    const errors: string[] = [];
    for (const obj of test.info().errors) {
      errors.push(`\t${obj.message!.split('\n')[0]}`);
    }
    return errors.join('\n');
  }

  async isEmpty() {
    expect(this.text, 'Verify there is no errors').toBeFalsy();
  }
}

export default PipeAssertions;
