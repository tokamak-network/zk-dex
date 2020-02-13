const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const router = require('./router');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
router(app);

module.exports = app;
