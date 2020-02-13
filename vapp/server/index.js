const debug = require('debug')('http');

const app = require('./app');
const { ZkDexService } = require('./zkdex-service');
const ws = require('./ws');

const zkdexService = new ZkDexService();

app.zkdexService = zkdexService;

const PORT = process.env.PORT || 3000;
const PROVIDER_URL = process.env.PROVIDER_URL || 'ws://localhost:8545';

app.listen(PORT, function () {
  debug(`zk-dex server listing on port ${PORT}`);
});


(async () => {
  await zkdexService.init(PROVIDER_URL);
  ws(app, zkdexService);
})();
