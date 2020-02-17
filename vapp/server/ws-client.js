const io = require('socket.io-client');
const {
  zkdexService: {
    events, // zk-dex-service evnets
  },
} = require('./constants');

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
