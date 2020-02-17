const debug = require('debug')('http');
const http = require('http');

const app = require('./app');
const { ZkDexService } = require('./zkdex-service');
const ws = require('./ws');

const server = http.Server(app);

const zkdexService = new ZkDexService();
app.zkdexService = zkdexService;

const PORT = process.env.PORT || 3000;
const PROVIDER_URL = process.env.PROVIDER_URL || 'ws://localhost:8545';

// init zk-dex-service
zkdexService.init(PROVIDER_URL)
  .then(() => {
    ws(server, zkdexService);
  })
  .catch((err) => {
    throw err;
  });

// listen express app only if nodejs runs server
if (typeof require !== 'undefined' && require.main === module) {
  server.listen(PORT, function () {
    debug(`zk-dex server listing on port ${PORT}`);
  });
}

module.exports = {
  app,
  zkdexService,
  PORT,
  PROVIDER_URL,
};
