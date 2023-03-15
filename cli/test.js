const run = require("./evaluator.js");

run(
  `
console.log("this is a demo sample");
new URL("https://github.com");
const fs = require("fs");
const a = fs.readFileSync("./payload");
eval(a || "example_payload");
`,
  { file: "samples/demo" }
);
