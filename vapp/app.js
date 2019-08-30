const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const router = require('./router');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(router());

app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(400).json({
    message: err.message,
  });
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
