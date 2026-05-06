const { I } = inject();

module.exports = {
  url: 'graph/tickets',
  serviceNowUrl: 'perconadev.service-now.com/percona',
  elements: {
    ticketTable: '$table',
    ticketTableHead: '//*[@data-testid="table-thead"]//tr',
    ticketTableRows: '//*[@data-testid="table-tbody"]//tr',
    header: '//body//*[contains(text(), "List of tickets opened by Customer Organization")]',
    ticketsMenuIcon: '//*[contains(@href, "/graph/tickets")]',
    notPlatformUser: '$not-platform-user',
    noDataTable: '$table-no-data',
    ticketTableSpinner: '$spinner-wrapper',
    emptyBlock: '$empty-block',
  },
  fields: {},
  buttons: {},
  messages: {
    loginWithPercona: 'Login with Percona Account to access this content',
    notConnectedToThePortal: 'Not connected to Portal.',
    noTicketsFound: 'No tickets found',
  },
};
