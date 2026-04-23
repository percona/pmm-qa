const Helper = codecept_helper;

class PerformanceHelper extends Helper {
  async getPageTimeToLoad(page) {
    await page.waitForLoadState('load');
    const performanceTimingJson = await page.evaluate(() => JSON.stringify(window.performance.timing));
    const performanceTiming = JSON.parse(performanceTimingJson);
    const startToInteractive = performanceTiming.domInteractive - performanceTiming.navigationStart;

    return startToInteractive;
  }
}

module.exports = PerformanceHelper;
