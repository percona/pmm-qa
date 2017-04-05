 'use strict';

module.exports = {
  graphPage: {
    ariaPageCache: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Aria Pagecache Reads/Writes"]')),
    ariaTransact: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Aria Transaction Log Syncs"]')),
    ariaPage: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Aria Pagecache Blocks"]')),
    innodbOnline: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "InnoDB Online DDL"]')),
    innodbDefr: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "InnoDB Defragmentation"]')),
    innodbCond: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Index Condition Pushdown"]')),
    innodbDead: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "InnoDB Deadlocks Detected"]')),
  },

    ariaPageCacheTitle: function() {
      return this.graphPage.ariaPageCache;
    },

    ariaTransactTitle: function() {
      return this.graphPage.ariaTransact;
    },

    ariaPageTitle: function() {
      return this.graphPage.ariaPage;
    },

    innodbOnlineTitle: function() {
      return this.graphPage.innodbOnline;
    },

    innodbDefrTitle: function() {
      return this.graphPage.innodbDefr;
    },

    innodbCondTitle: function() {
      return this.graphPage.innodbCond;
    },

    innodbDeadTitle: function() {
      return this.graphPage.innodbDead;
    },
};
