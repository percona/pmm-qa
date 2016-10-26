var Utils = function {
// wait for & verify correct page is loaded

this.at = function() {
    var that = this;
    return browser.wait(function() {
        // call the page's pageLoaded method
        return that.pageLoaded();
    }, 5000);
};

// navigate to a page 
this.to = function() {
    browser.get(this.url, 5000);
    // wait and verify we're on the expected page
    return this.at();
};
}

