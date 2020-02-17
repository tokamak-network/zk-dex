module.exports = {
  zkdexService: {
    // events from zkDEX contract
    contractEvents: [
      'NoteStateChange',
      'OrderTaken',
      'OrderSettled',
    ],
    // events from zk-dex-service
    events: {
      NOTE: 'note',
      ORDER: 'order',
      ORDER_CREATED: 'order:created',
      ORDER_TAKEN: 'order:taken',
      ORDER_SETTLED: 'order:settled',
    },
  },
};
