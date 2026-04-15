const locateOptions = locate('[data-testid="data-testid Select option"]');
const locateOption = (option) => locateOptions.withText(option);

module.exports = {
  locateOption,
  locateOptions,
};
