#!/usr/bin/env node

const dns = require("dns");
require("ses");
const prompt = require("prompt-sync")();
const { readFileSync, writeFileSync } = require("fs");

const { freeze, create } = Object;
const { log } = console;

function mkCatcher(PATH = "global") {
  const cache = new Set();
  return new Proxy(
    {},
    {
      has: (_, name) => {
        if (cache.has(name)) {
          return false;
        }
        const y = prompt(`Access real ${PATH}.${name}? [a=always/y/N]`);
        if (y === "a") {
          cache.add(name);
          return false;
        }
        return !(y === "y");
      },
      get: (_, name) => {
        if (typeof name === "symbol") {
          return undefined;
        }

        const what = prompt(`Get ${PATH}.${name} as [p/n/l/f/0]`);
        switch (what) {
          case "p":
            return mkCatcher(PATH + "." + name);
          case "n":
            return () => {};
          case "l":
            return freeze(log);
          case "f":
            return freeze(function () {
              log("=>" + PATH + "." + name + "(", arguments, ")");
              return mkCatcher(PATH + "." + name + "=>{}");
            });
          default:
            return undefined;
        }
      },
    }
  );
}

log(`Return values from proxy:
 p: proxy-prompt
 n: noop function
 l: console.log
 f: function=>proxy-prompt
 0: undefined
`);

function evaluator() {
  with (this.scopeGuard) {
    with (this.evalOnce) {
      return function () {
        "use strict";
        return eval(arguments[0]);
      };
    }
  }
}
const run = (sourceCode) => {
  const THE_EVAL = eval;
  let once = true;
  const evaluate = evaluator.call({
    evalOnce: Object.freeze(
      Object.defineProperty(Object.create(null), "eval", {
        get: () => {
          if (once) {
            once = false;
            return THE_EVAL;
          }
          if ("y" === prompt(`Run real EVAL? [y/N]`)) {
            return THE_EVAL;
          } else {
            return freeze(function (code) {
              const stamp = "eval" + Date.now();
              log(stamp,":", code.substring(0, 20) + "…");
              writeFileSync(stamp, code);
            });
          }
        },
      })
    ),
    scopeGuard: mkCatcher(),
  });
  lockdown();
  return evaluate.call(create(null), sourceCode);
};

// const run2 = (sourceCode) => {
//   const globs = create(mkCatcher())
//   const comp = new Compartment(globs,{},{})
//   lockdown();
//   return comp.evaluate(sourceCode, {
//     sloppyGlobalsMode:true
//   });
// };

//   const file = process.argv[2];

// function evadeDirectEvalExpressions (source) {
//   /* eslint-disable-next-line prefer-regex-literals */
//   const someDirectEvalPattern = new RegExp('\\beval(\\s*\\()', 'g')

//   const replaceFn = (_, p1) => `(0,eval)${p1}`
//   return source.replace(someDirectEvalPattern, replaceFn)
// }

// const code = fs.readFileSync(file, "utf-8")
// run2(evadeDirectEvalExpressions(code));

log("Making sure we're offline...");
dns.lookupService("8.8.8.8", 53, function (err) {
  if (!err) {
    console.error("Refusing to run with internet access.");
    process.exit(112);
  }
  const file = process.argv[2];
  log(`## Running "${file}" ##`);

  run(readFileSync(file, "utf-8"));
});
