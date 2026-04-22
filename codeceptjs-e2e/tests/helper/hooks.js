/* eslint-disable func-names */
/* eslint-disable no-underscore-dangle */
const { event, container } = require('codeceptjs');

function getSelector(locator) {
  let selector = locator;

  if (!locator) return null;

  if (typeof locator === 'object') {
    if (locator.xpath) {
      selector = `xpath=${locator.xpath}`;
    } else if (locator.css) {
      selector = locator.css;
    } else if (locator.value && locator.type) {
      if (locator.type === 'xpath') {
        selector = `xpath=${locator.value}`;
      } else if (locator.type === 'css') {
        selector = locator.value;
      } else {
        selector = locator.value;
      }
    } else {
      selector = locator.toString();
    }
  }

  if (typeof selector === 'string') {
    if (selector.startsWith('{xpath:') && selector.endsWith('}')) {
      return `xpath=${selector.substring(7, selector.length - 1).trim()}`;
    }

    if (selector.startsWith('{css:') && selector.endsWith('}')) {
      return selector.substring(5, selector.length - 1).trim();
    }

    if (selector.startsWith('$')) {
      return `[data-testid="${selector.substring(1)}"]`;
    }
  }

  return selector;
}

async function switchToGrafana(helper) {
  const grafanaIframe = '#grafana-iframe';

  await helper.switchTo();
  if (helper.page) await helper.page.waitForLoadState('domcontentloaded');

  await helper.waitForVisible(grafanaIframe, 60);
  await helper.switchTo(grafanaIframe);

  if (helper.page) helper.context = helper.page.frameLocator(grafanaIframe);
}

async function resetContext(helper) {
  if (helper.browserContext) {
    const pages = helper.browserContext.pages();

    if (pages.length > 0) [helper.page] = pages;
  }

  await helper.switchTo();
  helper.context = null;
}

function applyOverride(helper, methodName, wrapperFunction) {
  const originalMethod = helper[methodName];

  helper[methodName] = async function pmmMethodWrapper(...args) {
    return wrapperFunction.apply(this, [originalMethod, ...args]);
  };
}

function applyContextOverride(helper, methodName, contextAction) {
  applyOverride(helper, methodName, async function (original, ...args) {
    if (helper.context) return contextAction.apply(this, args);

    return original.apply(this, args);
  });
}

module.exports = function pmmGrafanaIframeHook() {
  const helper = container.helpers('Playwright');
  const navigationMethods = ['amOnPage', 'refreshPage', 'openNewTab', 'switchToNextTab', 'switchToPreviousTab'];
  const noIframeMethods = ['openNewTab'];
  const noIframeUrls = ['login', 'logout', 'help', 'updates'];

  navigationMethods.forEach((methodName) => {
    applyOverride(helper, methodName, async function (original, ...args) {
      await resetContext(helper);
      await original.apply(this, args);

      if (methodName === 'amOnPage' && noIframeUrls.some((url) => args[0].includes(url))) return;

      if (noIframeMethods.includes(methodName)) return;

      await switchToGrafana(helper);
    });
  });
  applyOverride(helper, 'pressKey', async function (original, key) {
    function getPage() {
      if (helper.page && helper.page.keyboard) return helper.page;

      if (helper.browserContext) {
        const pages = helper.browserContext.pages();

        if (pages.length > 0) {
          const [firstPage] = pages;

          return firstPage;
        }
      }

      return helper.page;
    }

    const page = getPage();

    if (helper.context && page && page.keyboard) {
      const modifiers = ['Control', 'Command', 'Alt', 'Shift', 'Meta'];

      if (Array.isArray(key) && key.length === 2 && modifiers.includes(key[0])) {
        await page.keyboard.down(key[0]);
        await page.keyboard.press(key[1]);
        await page.keyboard.up(key[0]);
      } else if (Array.isArray(key)) {
        for (const keyItem of key) {
          await helper.pressKey(keyItem);
        }
      } else {
        await page.keyboard.press(key);
      }

      return;
    }

    await original.call(this, key);
  });
  applyOverride(helper, 'switchTo', async function (original, locator) {
    await original.apply(this, [locator]);

    if (!locator) {
      helper.context = null;

      return;
    }

    helper.context = helper.page.frameLocator(locator);
  });
  applyContextOverride(helper, 'grabTextFrom', async (locator) => helper.context.locator(getSelector(locator)).first().textContent());
  applyContextOverride(helper, 'grabTextFromAll', async (locator) => helper.context.locator(getSelector(locator)).allTextContents());
  applyContextOverride(helper, 'seeTextEquals', async (text, context = null) => {
    const selector = getSelector(context) || 'body';
    let actualText = await helper.context.locator(selector).first().textContent();

    if (actualText) {
      actualText = actualText.replace(/\u00a0/g, ' ');
    }

    if (actualText !== text) {
      throw new Error(`Expected text to be "${text}", but found "${actualText}"`);
    }
  });
  applyContextOverride(helper, 'waitForText', async (text, seconds = null, context = null) => {
    await helper.context.locator(getSelector(context) || 'body').filter({ hasText: text }).first().waitFor({
      state: 'visible',
      timeout: seconds ? seconds * 1000 : helper.options.waitForTimeout,
    });
  });
  applyContextOverride(helper, 'waitForDetached', async (locator, seconds = null) => {
    await helper.context
      .locator(getSelector(locator))
      .first()
      .waitFor({ state: 'detached', timeout: seconds ? seconds * 1000 : helper.options.waitForTimeout });
  });
  applyContextOverride(helper, 'waitForValue', async (field, value, seconds = null) => {
    const waitTimeout = seconds ? seconds * 1000 : helper.options.waitForTimeout;
    const locator = helper.context.locator(getSelector(field)).first();
    const startTime = Date.now();

    while (Date.now() < startTime + waitTimeout) {
      const inputValue = await locator.inputValue().catch(() => '');

      if (inputValue.includes(value)) return;

      await new Promise((resolve) => { setTimeout(resolve, 100); });
    }
    throw new Error(`Wait for value "${value}" failed for field ${field}`);
  });
  applyContextOverride(helper, 'waitForEnabled', async (locator, seconds = null) => {
    const waitTimeout = seconds ? seconds * 1000 : helper.options.waitForTimeout;
    const element = helper.context.locator(getSelector(locator)).first();
    const startTime = Date.now();

    await element.waitFor({ state: 'attached', timeout: waitTimeout });

    while (Date.now() < startTime + waitTimeout) {
      if (await element.isEnabled()) return;

      await new Promise((resolve) => { setTimeout(resolve, 100); });
    }
    throw new Error(`Element ${locator} was not enabled after ${seconds} seconds`);
  });
  applyContextOverride(helper, 'moveCursorTo', async (locator, offsetX = 0, offsetY = 0) => {
    const element = helper.context.locator(getSelector(locator)).first();

    await element.evaluate((elementInstance) => {
      elementInstance.scrollIntoView({ block: 'center', inline: 'center' });
    });
    await element.hover({ position: { x: offsetX, y: offsetY }, force: true });
  });
  applyOverride(helper, 'usePlaywrightTo', async function (original, description, callback) {
    return original.call(this, description, async (args) => {
      if (helper.context) {
        args.page = helper.context;

        if (!args.page.evaluate) {
          Object.defineProperty(args.page, 'evaluate', {
            async value(functionToExecute, argument) {
              return args.page.locator('body').evaluate(functionToExecute, argument);
            },
            writable: true,
            configurable: true,
          });
        }
      }

      return callback(args);
    });
  });

  event.dispatcher.on(event.test.before, resetContext.bind(null, helper));
  event.dispatcher.on(event.test.after, resetContext.bind(null, helper));
};
