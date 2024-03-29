const { run, runBytecode } = require("./evaluator.js");

const code = `
console.log("this is a demo sample");
new URL("https://github.com");
const fs = require("fs");
const a = fs.readFileSync("./payload");
eval(a || "example_payload");
`;

// run(code, { file: "samples/demo" });

const v8 = require("node:v8");
v8.setFlagsFromString("--no-lazy");
v8.setFlagsFromString("--no-flush-bytecode");

const vm = require("node:vm");

const vmsc = new vm.Script(code, {
  produceCachedData: true,
  filename: "a.js",
  lineOffset: 0,
  displayErrors: true,
});
const cached = vmsc.createCachedData();

runBytecode(cached, { file: "samples/demo" });
