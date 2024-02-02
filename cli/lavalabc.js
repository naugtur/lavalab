#!/usr/bin/env node

const dns = require("dns");
require("ses");
const { readFileSync } = require("fs");

const { log } = console;

const { runBytecode } = require("./evaluator.js");

log("Making sure we're offline...");
dns.lookupService("8.8.8.8", 53, function (err) {
  if (!err) {
    console.error("Refusing to run with internet access.");
    process.exit(112);
  }
  const file = process.argv[2];
  log(`## Running "${file}" ##`);

  const v8 = require("node:v8");
  v8.setFlagsFromString("--no-lazy");
  v8.setFlagsFromString("--no-flush-bytecode");

  runBytecode(readFileSync(file), { file });
});
