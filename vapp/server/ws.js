// implements websocket communication

const debug = require('debug')('socket');
const socket = require('socket.io');
const http = require('http');

// zk-dex-service events to forward
const events = [
  'note',
  'order',
  'order:taken',
  'order:settled',
];

// connect express app and zk-dex-service to socket.io
module.exports = (app, zkdexService) => {
  const io = socket(http.createServer(app));

  // forward events from zk-dex-service to websocket client
  const forward = event => zkdexService.on(event, (...args) => {
    // console.log(...args);
    debug(event, ...args.map(arg => JSON.stringify(arg, null, 0)));

    io.emit(event, [...args.map(arg => JSON.stringify(arg, null, 0))]);
  });

  events.forEach(forward);

  debug('forward zk-dex-service event');

  return io;
};
