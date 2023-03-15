#!/usr/bin/env node

require("ses");
const prompt = require("prompt-sync")();
const { writeFileSync } = require("fs");

const { freeze, create, hasOwnProperty } = Object;
const { log } = console;

const knownProxies = new WeakMap();

const requireProxy = (target, thisArg, argumentsList) => {
  const y = prompt(`Run real require(${argumentsList[0]})? [y/N]`);
  if (y === "y") {
    return require(argumentsList[0]);
  } else {
    return mkCatcher(`require(${argumentsList[0]})`);
  }
};

const functionProxy = (PATH) => (target, thisArg, argumentsList) => {
  log("=>" + PATH + "(", ...argumentsList, ")");
  return mkCatcher(PATH + "=>");
};

function mkCatcher(PATH = "global", appl) {
  const cache = new Set();
  let target = {};
  if (appl) {
    target = () => {};
  }
  const prox = new Proxy(target, {
    has: (_, name) => {
      if (cache.has(name)) {
        return false;
      }
      if (name === "require" && PATH === "global") {
        return true;
      }
      const y = prompt(`Access real ${PATH}.${name}? [a=always/y/N]`);
      if (y === "a") {
        cache.add(name);
        return false;
      }
      return !(y === "y");
    },
    get: (me, name) => {
      if (typeof name === "symbol" && PATH === "global") {
        return undefined;
      }
      if (hasOwnProperty.call(me, name)) {
        return me[name];
      }
      if (name === "require" && PATH === "global") {
        return mkCatcher("global.require", requireProxy);
      }

      const what = prompt(`Get ${PATH}.${name} as [p/f/n/l/s/U]`);
      switch (what) {
        case "p":
          return mkCatcher(PATH + "." + name);
        case "f":
          return mkCatcher(PATH + "." + name, functionProxy(PATH + "." + name));
        case "n":
          return () => {};
        case "l":
          return freeze(log);
        case "s":
          return `string${Math.random().toFixed(7).substring(2)}`
        default:
          return undefined;
      }
    },
    set: (me, name, value) => {
      if (typeof name === "symbol") {
        return undefined;
      }

      const what = prompt(`Set ${PATH}.${name} [y/N]`);
      if (what === "y") {
        me[name] = value;
        return true;
      }
    },
    apply: appl,
    construct: functionProxy(PATH),
  });
  knownProxies.set(prox,PATH);
  return prox;
}

log(`Return values from proxy:
 p: proxy-prompt
 n: noop function
 l: console.log
 f: function=>proxy-prompt
 s: random string
 U: undefined
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
module.exports = (sourceCode) => {
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
              if(knownProxies.has(code)) {
                return log("A proxy you returned ended up passed into eval:", knownProxies.get(code))
              }
              const stamp = "eval" + Date.now();
              log(stamp, ":", code.substring(0, 20) + "…");
              writeFileSync(stamp, code);
            });
          }
        },
      })
    ),
    scopeGuard: mkCatcher(),
  });
  lockdown({
    errorTaming: "unsafe"
  });
  return evaluate.call(create(null), sourceCode);
};
