import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { finishedExecutions } from '@testdata/supportDiagnostics';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2521 - Verify a partial selection of finished results shows the select-all checkbox as partially checked in Support diagnostics @settings',
  async ({ mocks, page, supportDiagnosticsPage }) => {
    const { elements } = supportDiagnosticsPage;

    await pmmTest.step('Open the incident with finished executions', async () => {
      await mocks.mockSupportDiagnostics(finishedExecutions);
      await page.goto(supportDiagnosticsPage.incidentUrl);

      await expect(elements.collectHeading).toBeVisible();
      await expect(elements.resultsHeading).toBeVisible();
      await expect(elements.executionCheckboxes).toHaveCount(finishedExecutions.length);
    });

    await pmmTest.step('Verify the select-all checkbox is unchecked with nothing selected', async () => {
      await expect(elements.selectAllCheckbox).not.toBeChecked();
      await expect(elements.selectAllCheckbox).toHaveAttribute('data-indeterminate', 'false');
      await expect(elements.selectAllCheckbox).not.toHaveAttribute('aria-checked');
      await expect(elements.selectedCounter).toHaveText('0 selected');
    });

    await pmmTest.step(
      'Select one execution and verify the select-all checkbox is partially checked',
      async () => {
        await elements.executionCheckboxes.first().click();

        await expect(elements.selectedCounter).toHaveText('1 selected');
        await expect(elements.selectAllCheckbox).toHaveAttribute('data-indeterminate', 'true');
        await expect(elements.selectAllCheckbox).toHaveAttribute('aria-checked', 'mixed');
      },
    );

    await pmmTest.step(
      'Select all and verify every execution and the select-all checkbox are checked',
      async () => {
        await elements.selectAllCheckbox.click();

        await expect(elements.selectedCounter).toHaveText(`${finishedExecutions.length} selected`);
        await expect(elements.selectAllCheckbox).toBeChecked();
        await expect(elements.selectAllCheckbox).toHaveAttribute('data-indeterminate', 'false');
        await expect(elements.selectAllCheckbox).not.toHaveAttribute('aria-checked');

        for (const checkbox of await elements.executionCheckboxes.all()) {
          await expect(checkbox).toBeChecked();
        }
      },
    );

    await pmmTest.step(
      'Clear all and verify every execution and the select-all checkbox are unchecked',
      async () => {
        await elements.selectAllCheckbox.click();

        await expect(elements.selectedCounter).toHaveText('0 selected');
        await expect(elements.selectAllCheckbox).not.toBeChecked();
        await expect(elements.selectAllCheckbox).toHaveAttribute('data-indeterminate', 'false');
        await expect(elements.selectAllCheckbox).not.toHaveAttribute('aria-checked');

        for (const checkbox of await elements.executionCheckboxes.all()) {
          await expect(checkbox).not.toBeChecked();
        }
      },
    );
  },
);

pmmTest(
  'PMM-T2523 - Verify the date and time picker in a Support diagnostics collect form opens, accepts a value and starts the run @settings',
  async ({ mocks, page, supportDiagnosticsPage }) => {
    const { builders, buttons, elements, inputs, messages } = supportDiagnosticsPage;
    const { batchRequests } = await mocks.mockSupportDiagnostics();
    const consoleProblems: string[] = [];

    await pmmTest.step('Open the incident', async () => {
      await page.goto(supportDiagnosticsPage.incidentUrl);

      await expect(elements.collectHeading).toBeVisible();
      await expect(elements.resultsHeading).toBeVisible();
    });

    await pmmTest.step('Select the MongoDB Log Extractor script and verify its form', async () => {
      await supportDiagnosticsPage.selectScript('MongoDB', supportDiagnosticsPage.logExtractorTitle);

      await expect(inputs.executionHost).toBeVisible();
      await expect(inputs.issueTime).toBeVisible();
      await expect(inputs.minutes).toBeVisible();
      await expect(inputs.logFilePath).toBeVisible();
    });

    await pmmTest.step('Choose the execution host', async () => {
      await inputs.executionHost.click();
      await builders.hostOption(supportDiagnosticsPage.host).click();

      await expect(inputs.executionHost).toHaveValue(supportDiagnosticsPage.host);
    });

    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) consoleProblems.push(message.text());
    });
    page.on('pageerror', (error) => consoleProblems.push(error.message));

    await pmmTest.step('Open the Issue Time picker and verify its content', async () => {
      await supportDiagnosticsPage.openIssueTimePicker();

      await expect(builders.pickerMonth(supportDiagnosticsPage.getExpectedMonthLabel())).toBeVisible();
      await expect(builders.pickerDay('1')).toBeVisible();
      await expect(builders.pickerDay('28')).toBeVisible();
      await expect(builders.pickerListbox('hours')).toBeVisible();
      await expect(builders.pickerListbox('minutes')).toBeVisible();
      await expect(builders.pickerOption('meridiem', 'AM')).toBeVisible();
      await expect(builders.pickerOption('meridiem', 'PM')).toBeVisible();
      await expect(buttons.pickerOk).toBeVisible();
    });

    await pmmTest.step('Pick a day, an hour and a minute', async () => {
      await supportDiagnosticsPage.pickIssueTime();

      await expect(inputs.issueTime).toHaveValue(supportDiagnosticsPage.getExpectedIssueTime());
      await expect(
        builders.pickerOption('meridiem', supportDiagnosticsPage.pickedTime.meridiem),
      ).toHaveAttribute('aria-selected', 'true');
    });

    await pmmTest.step('Confirm with OK and verify the value is kept', async () => {
      await buttons.pickerOk.click();

      await expect(elements.dateTimePicker).toBeHidden();
      await expect(inputs.issueTime).toHaveValue(supportDiagnosticsPage.getExpectedIssueTime());
    });

    await pmmTest.step('Execute the batch and verify the run starts with the picked time', async () => {
      await buttons.executeBatch.click();

      await expect(messages.startedOneScript).toBeVisible();
      await expect(builders.executionRow(supportDiagnosticsPage.logExtractorTitle)).toBeVisible();
      expect(batchRequests).toHaveLength(1);
      expect(batchRequests[0].executor_host).toBe(supportDiagnosticsPage.host);
      expect(batchRequests[0].items[0].args.time).toBe(supportDiagnosticsPage.getExpectedRequestTime());
    });

    expect(
      consoleProblems.filter((text) => /MUI|picker/i.test(text)),
      'No MUI or date picker error or warning is logged',
    ).toEqual([]);
  },
);
