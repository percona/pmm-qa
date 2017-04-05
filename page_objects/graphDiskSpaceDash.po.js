 'use strict';

module.exports = {
  graphPage: {
    mntPntUsgChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint Usage"]')),
    mntPntChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint /"]')),
    mntHostnameChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint /etc/hostname"]')),
    mntHostsChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint /etc/hosts"]')),
    mntNginxChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint /etc/nginx/ssl"]')),
    mntResolvChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint /etc/resolv.conf"]')),
    mntConsulChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint /etc/opt/consul-data"]')),
    mntPromethChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint /opt/prometheus"]')),
    mntMysqlChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint /var/lib/mysql"]')),
  },

    getMntPntUsgTitle: function() {
      return graphPage.mntPntUsgChart;
    },

    getMntPntTitle: function() {
      return graphPage.mntPntChart;
    },

    getHostnameTitle: function() {
      return this.graphPage.mntHostnameChart;
    },

    getHostsTitle: function() {
      return graphPage.mntHostsChart;
    },

    getNginxTitle: function() {
      return graphPage.mntNginxChart;
    },

    getResolvTitle: function() {
      return graphPage.mntResolvChart;
    },

    getConsulTitle: function() {
      return graphPage.mntConsulChart;
    },

    getPromethTitle: function() {
      return graphPage.mntPromethChart;
    },

    getMysqlTitle: function() {
      return graphPage.mntMysqlChart;
    },
};
