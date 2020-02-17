const io = require('socket.io-client');
const { events } = require('./zkdex-service');

const PORT = process.env.PORT || 3000;
const url = `http://localhost:${PORT}`;

const socket = io.connect(url);

Object.values(events).forEach(function (event) {
  console.log('listening zk-dex-service', event);
  socket.on(event, function (data) {
    console.log(event, data)
    ;
  });
});
