const { I } = inject();

const mouseOverMenu = (locator, elementToWait) => {
  I.moveCursorTo(locator);
  I.waitForVisible(elementToWait, 2);
};

const formatElementId = (text) => text.toLowerCase().replace(/ /g, '-');

/**
 * The left navigation Grafana menu template. A top level "menu object".
 *
 * @param   name          name of the menu item appears as menu heading
 * @param   path          "expected" url path to be opened on click
 * @param   menuOptions   an object collection of {@link MenuOption} and/or {@link SubMenu}
 * @constructor
 */
function LeftMenu(name, path, menuOptions) {
  this.headingLocator = locate(`ul[aria-label="${name}"]`).find('a').withText(name);
  this.menuLocator = `ul[aria-label="${name}"]`;
  this.locator = `$navitem-${name.toLowerCase()}`;
  this.menu = {
    heading: new MenuOption(name, name, this.headingLocator, path),
  };
  if (menuOptions != null) {
    Object.entries(menuOptions).forEach(([key, value]) => {
      this.menu[key] = value;
    });
  }

  this.showMenu = () => {
    mouseOverMenu(this.locator, this.menuLocator);
  };
  this.click = () => {
    I.click(this.locator);
  };
}

/**
 * The search menu in the left navigation. It has dedicated markup since Grafana 8.
 *
 * @param   name          name of the menu item appears as menu heading
 * @param   path          "expected" url path to be opened on click
 * @param   menuOptions   an object collection of {@link MenuOption} and/or {@link SubMenu}
 * @constructor
 */
function LeftSearchMenu(name, path, menuOptions) {
  this.headingLocator = locate(`ul[aria-label="${name}"]`).find('button').withText(name);
  this.locator = `button[aria-label="${name}"]`;
  this.menu = {
    heading: new MenuOption(name, name, this.headingLocator, path),
  };
  if (menuOptions != null) {
    Object.entries(menuOptions).forEach(([key, value]) => {
      this.menu[key] = value;
    });
  }

  this.showMenu = () => {
    mouseOverMenu(this.locator, this.headingLocator);
  };
  this.click = () => {
    I.click(this.locator);
  };
}

/**
 * Internal menu option template for the left navigation Grafana menu
 * The only repeatable markup part is <li> on each level preceding the target menu option,
 * where the 1st level is top menu and the last is option to click.
 *
 * @param   menuName    required to handle interaction
 * @param   label       name of the option
 * @param   locator     locator to interact with the option
 * @param   path        "expected" url path to be opened on click
 * @param   menuLevel   required to handle interaction, optional for the top level
 * @constructor
 */
function MenuOption(menuName, label, locator, path, menuLevel = 1) {
  this.label = label;
  this.locator = locator;
  this.path = path;
  this.click = async () => {
    new LeftMenu(menuName, '').showMenu();

    /* top level menu options text is nested <div> and should be excluded from loop */
    for (let i = 2; i <= menuLevel; i++) {
      this.locator = `(//li[(@role="menuitem" or @role="menu") and .//a[text()="${label}"]])`;
      I.moveCursorTo(`${this.locator}[position()=${i - 1}]`);
    }

    /* top level menu options are handled without loop and locator from the argument */
    const elemToClick = this.locator === locator
      ? locator
      : `//li[(@role="menuitem" or @role="menu")]/.//a[text()="${label}"]`;

    I.waitForVisible(elemToClick, 2);
    I.moveCursorTo(elemToClick);

    // special check for 'Advisors' and 'Backup' because elemToClick locator matches more than one element
    if (label === 'Advisors' || label === 'Backup') {
      I.seeTextEquals(label, `.//ul[./@aria-label = '${label}']//div[text()="${label}"]`);
    } else {
      I.seeTextEquals(label, elemToClick);
    }

    I.click(elemToClick);
  };
}

/**
 * Encapsulates constant locator of {@link MenuOption} for the left navigation Grafana menu.
 * Just to keep constructor simple.
 *
 * @param   menuName    required to handle interaction
 * @param   label       name of the option
 * @param   path        "expected" url path to be opened on click
 * @param   menuLevel   required to handle interaction, optional for the top level
 * @returns             {MenuOption} instance
 */
const menuOption = (menuName, label, path, menuLevel = 1) => new MenuOption(menuName, label, locate('a').withDescendant(locate('div').withText(label)).inside('ul'), path, menuLevel);

/**
 * A sub level "menu object" of the Grafana menu. Should used in the {@link LeftMenu}
 *
 * @param   topMenuName    name of the top level menu
 * @param   name          name of the menu item appears as menu heading
 * @param   path          "expected" url path to be opened on click; '#' is non-clickable sub menu
 * @param   menuOptions   an object collection of {@link MenuOption} and/or {@link SubMenu}
 * @constructor
 */
// eslint-disable-next-line default-param-last
function SubMenu(topMenuName, name, path = '#', menuOptions) {
  this.menu = { };
  if (menuOptions != null) {
    Object.entries(menuOptions).forEach(([key, value]) => {
      this.menu[key] = value;
    });
  }

  if (path !== '#') {
    this.click = () => {
      menuOption(topMenuName, name, path).click();
    };
  }
}

module.exports = {
  LeftMenu, LeftSearchMenu, SubMenu, menuOption,
};
