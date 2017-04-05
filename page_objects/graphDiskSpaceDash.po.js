 'use strict';

module.exports = {
  graphPage: {
    mntPntUsgChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint Usage"]')),
    mntPntChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint /"]')),
    mntHostnameChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint /etc/hostname"]')),
    mntHostsChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint /etc/hosts"]')),
    mntNginxChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint /etc/nginx/ssl"]')),
    mntResolvChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint /etc/resolv.conf"]')),
    mntConsulChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint /opt/consul-data"]')),
    mntPromethChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint /opt/prometheus/data"]')),
    mntMysqlChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint /var/lib/mysql"]')),
  },

    getMntPntUsgTitle: function() {
      return this.graphPage.mntPntUsgChart;
    },

    getMntPntTitle: function() {
      return this.graphPage.mntPntChart;
    },

    getHostnameTitle: function() {
      return this.graphPage.mntHostnameChart;
    },

    getHostsTitle: function() {
      return this.graphPage.mntHostsChart;
    },

    getNginxTitle: function() {
      return this.graphPage.mntNginxChart;
    },

    getResolvTitle: function() {
      return this.graphPage.mntResolvChart;
    },

    getConsulTitle: function() {
      return this.graphPage.mntConsulChart;
    },

    getPromethTitle: function() {
      return this.graphPage.mntPromethChart;
    },

    getMysqlTitle: function() {
      return this.graphPage.mntMysqlChart;
    },
};
