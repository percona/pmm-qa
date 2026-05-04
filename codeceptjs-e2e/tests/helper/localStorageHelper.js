class LocalStorage extends Helper {
  // eslint-disable-next-line no-underscore-dangle
  async _before() {
    const { page } = this.helpers.Playwright;

    // TODO replace with better test to the tour
    await page.addInitScript(() => {
      if (window.localStorage.getItem('percona.tourTest') === true) {
        window.localStorage.removeItem('percona.showTour');
      } else {
        window.localStorage.setItem('percona.showTour', false);
      }
    });
  }
}

module.exports = LocalStorage;
