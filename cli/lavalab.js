#!/usr/bin/env node

const dns = require("dns");
require("ses");
const { readFileSync, } = require("fs");

const { log } = console;

const run = require('./evaluator.js');

log("Making sure we're offline...");
dns.lookupService("8.8.8.8", 53, function (err) {
  if (!err) {
    console.error("Refusing to run with internet access.");
    process.exit(112);
  }
  const file = process.argv[2];
  log(`## Running "${file}" ##`);

  run(readFileSync(file, "utf-8"), { file });
});
