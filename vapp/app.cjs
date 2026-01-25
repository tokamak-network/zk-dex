const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/circuits', require('./router/circuits.cjs'));
app.use('/vk', require('./router/vk.cjs'));
app.use('/accounts', require('./router/accounts.cjs'));
app.use('/notes', require('./router/notes.cjs'));
app.use('/orders', require('./router/orders.cjs'));

app.use(function (err, req, res, next) {
  console.error('Server error:', err.stack);
  res.status(500).json({
    message: err.message,
  });
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
