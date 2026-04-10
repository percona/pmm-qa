import { test, expect } from '@playwright/test';
import PipeAssertions from '@support/types/pipe-assertions.class';

class ExecReturn {
  command: string;
  code: number;
  stdout: string;
  stderr: PipeAssertions;

  constructor(command: string, exitCode: number, stdOut: string, stdErr: string) {
    this.command = command;
    this.code = exitCode;
    this.stdout = stdOut;
    this.stderr = new PipeAssertions(command, 'Stderr', stdErr);
  }

  getStdOutLines(): string[] {
    return this.stdout.trim().split('\n').filter((item) => item.trim().length > 0);
  }

  logError() {
    if (this.code !== 0) {
      console.log(`"${this.command}" exited with error: "${this.stderr.text || this.stdout}"`);
    }
  }

  async assertSuccess() {
    const errorMsg = this.code === 0 ? '' : ` Error: "${this.stderr.text || this.stdout}"`;
    expect(this.code, `Verify "${this.command}" exited with 0!${errorMsg}"`).toEqual(0);
    return this;
  }

  async exitCodeEquals(expectedValue: number) {
    await test.step(`Verify "${this.command}" command exit code is ${expectedValue}`, async () => {
      expect(this.code, `"${this.command}" expected to exit with ${expectedValue}! Output: "${this.stdout}"`).toEqual(expectedValue);
    });
  }

  async outEquals(expectedValue: string) {
    expect(this.stdout, `Verify Stdout equals ${expectedValue}!`).toBe(expectedValue);
  }

  async outContains(expectedValue: string, customString = '') {
    await test.step(`Verify command output contains ${expectedValue}`, async () => {
      expect(this.stdout.replace(/ +(?= )/g, ''), `Stdout does not contain ${expectedValue}, ${customString}!`).toContain(expectedValue);
    });
  }

  async outNotContains(expectedValue: string) {
    await test.step(`Verify command output contains ${expectedValue}`, async () => {
      expect(this.stdout, `Stdout does not contain ${expectedValue}!`).not.toContain(expectedValue);
    });
  }

  async outContainsNormalizedMany(expectedValues: string[]) {
    for (const val of expectedValues) {
      expect.soft(this.stdout.replace(/ +(?= )/g, ''), `Verify Stdout contains '${val}'`).toContain(val);
    }
    const errorMsg = test.info().errors.length === 0
      ? ''
      : ` But got ${test.info().errors.length} error(s):\n${this.getErrors()}`;
    expect(
      test.info().errors,
      `'Contains all elements' should have 0 errors.${errorMsg}`,
    ).toHaveLength(0);
  }

  async outContainsMany(expectedValues: string[]) {
    for (const val of expectedValues) {
      expect.soft(this.stdout, `Verify Stdout contains '${val}'`).toContain(val);
    }
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
}

export default ExecReturn;
