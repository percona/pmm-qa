const I = actor();

module.exports = {

    fields : {
        table: "//app-qan-table//div[@class='ps-content']",
        filter: "//app-qan-filter//div[@class='ps-content']",
        search: "//app-qan-search//input",
        pagination: "//div[@class='pagination-tools']//ul[@class='ngx-pagination']",
        pmmImage: "//footer/img",
        pmmVersion: "//footer/small",
        paginationArrow: "(//ul[@class='ngx-pagination']/li)[last()]",
        addColumn: "//button[@class='add-column-btn']",
        total: "//span[contains(text(), 'TOTAL')]",
        columns: "//tbody//app-qan-table-header-cell",

        results: "//ng-select[@ng-reflect-items='10,50,100']",
        fifty: "//div[@id='ad0800a556c8']/span",
        hundred: "//div[@id='a305c6a9fc9e']"
    },

    viewElementExistence() {
        I.seeElement(this.fields.table);
        I.seeElement(this.fields.filter);
        I.seeElement(this.fields.search);
        I.seeElement(this.fields.pagination);
        I.seeElement(this.fields.pmmImage);
        I.seeElement(this.fields.pmmVersion);
        I.seeElement(this.fields.addColumn);
        I.seeElement(this.fields.total);

        I.seeElement(this.fields.columns + "[1]"); // load
        I.seeElement(this.fields.columns + "[2]"); // count
        I.seeElement(this.fields.columns + "[3]"); // time
    },

    checkForPagination() {
        I.click(this.fields.paginationArrow);
        I.wait(10);
        I.seeElement(this.fields.columns + "[1]"); // load
    },

    // checkChangeNumResults() {
    //     I.click(this.fields.results);
    //     I.click(this.fields.fifty);
    //     I.wait(20);
    //     I.seeElement(this.fields.columns + "[1]"); // load
    // }
};