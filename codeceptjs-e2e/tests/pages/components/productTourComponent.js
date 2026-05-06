const { I } = inject();

class ProductTourComponent {
  constructor() {
    this.productTourModal = locate('//h2[text()="Welcome to Percona Monitoring and Management (PMM)"]//ancestor::div[@role="dialog"]');
    this.skipButton = this.productTourModal.find('//span[text()="Skip"]');
    this.laterButton = this.productTourModal.find('//span[text()="Check later"]');
    this.closeButton = this.productTourModal.find('//button[@aria-label="Close"]');
    this.startTourButton = this.productTourModal.find('//span[text()="Start tour"]');
    this.nextStepButton = locate('//button[@aria-label="Next step"]');
    this.tourStepHeader = (headerText) => locate(`//div[@class="pmm-tour"]//strong[text()="${headerText}"]`);
    this.productTourCategories = ['Dashboards', 'PMM Dashboards', 'PMM Query Analytics', 'Explore', 'Alerting', 'Advisors', 'Backup', 'PMM Configuration Panel', 'Administration'];
    this.tourDoneButton = locate('//button//span[text()="Done"]');
  }

  async verifyProductTourSteps() {
    const lastStepHeaderText = this.productTourCategories[this.productTourCategories.length - 1];

    for (const headerText of this.productTourCategories) {
      I.waitForElement(this.tourStepHeader(headerText), 10);
      if (headerText === lastStepHeaderText) {
        I.dontSeeElement(this.nextStepButton);
        I.click(this.tourDoneButton);
      } else {
        I.dontSeeElement(this.tourDoneButton);
        I.click(this.nextStepButton);
      }
    }
  }
}

module.exports = new ProductTourComponent();
module.exports.ProductTourDialog = ProductTourComponent;
