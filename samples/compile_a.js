"use strict";
const fs = require("fs");

const v8 = require("node:v8");
v8.setFlagsFromString("--no-lazy");
v8.setFlagsFromString("--no-flush-bytecode");

const vm = require("node:vm");

const code = fs.readFileSync("./samples/a.js", "utf-8");
console.log('bytecode cache', code.length);
const vmsc = new vm.Script(code, {
  produceCachedData: true,
  filename: "a.js",
  lineOffset: 0,
  displayErrors: true,
});
const cached = vmsc.createCachedData();
fs.writeFileSync("./samples/c.jsc", cached);
