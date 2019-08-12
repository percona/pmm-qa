
Feature("To test if all nodes are checked in QAN");

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open PMM Inventory and Then check inside QAN Page Service Name', async(I) => {
    // Going to the PMM Inventory
    I.amOnPage("graph/d/pmm-inventory/pmm-inventory");
    await I.waitForElement("//div[@class='panel-content']//iframe");
    await I.switchTo("//div[@class='panel-content']//iframe");
    I.wait(10);

    // Extracting number of elements on the PMM Inventory List
    I.click("//a[contains(text(), ' Agents')]");
    I.wait(5);
    let numOfNodes = await I.grabNumberOfVisibleElements("//td[starts-with(text(), 'Qan')]");
    numOfNodes += await I.grabNumberOfVisibleElements("//td[starts-with(text(), 'QAN')]");

    // Going to PMM Query Analytics
    I.amOnPage("graph/d/7w6Q3PJmz/pmm-query-analytics");
    await I.waitForElement("//div[@class='panel-content']//iframe", 30);
    await I.switchTo("//div[@class='panel-content']//iframe");

    // Extracting number of elements on PMM QAN Page
    I.waitForElement("(//ng-select/div)[2]", 10);
    I.click("(//ng-select/div)[2]");
    I.wait(5);
    I.click("//div[@class='ng-option']");
    I.wait(5);
    let num = await I.grabNumberOfVisibleElements("//table/tr");
    num -= 2;

    // Checking if equal
    if(numOfNodes === num) throw new Error("The number of Elements under monitoring are not same in inventory and display");

});