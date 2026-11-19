'use strict';

const { MongoBinary } = require('mongodb-memory-server');

/** Download the in-memory MongoDB binary once, before parallel test workers start. */
module.exports = async function globalSetup() {
  await MongoBinary.getPath();
};
