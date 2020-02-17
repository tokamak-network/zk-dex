// implements websocket communication
const debug = require('debug')('socket');

// zk-dex-service events to forward
const { events } = require('./zkdex-service');

// connect express app and zk-dex-service to socket.io
module.exports = (server, zkdexService) => {
  const io = require('socket.io')(server);

  // forward events from zk-dex-service to websocket client
  Object.values(events).forEach((event) => {
    zkdexService.on(event, (err, data) => {
      let errMsg = '';
      if (err && err.stack && err.message) {
        errMsg = err.message;
      }
      const params = [errMsg, data].map(arg => JSON.stringify(arg, null, 0));
      debug(event, params);
      io.emit(event, params);
    });
  });

  debug('forward zk-dex-service event');

  return io;
};
