#!/usr/bin/env node

require("ses");
const { basename, dirname, join } = require("path");
const { writeFileSync, readFileSync, existsSync } = require("fs");
const prompts = require("prompt-sync")();

let HISTORYFILE;
const history = [];
let pendingPlayback = [];
let fastForward = false;
const prompt = (msg) => {
  let res = null;
  if (pendingPlayback && pendingPlayback.length > 0) {
    const item = pendingPlayback.shift();
    if (item[0] === msg) {
      res = item[1];
      if (!fastForward) {
        const FF = prompts(`Replaying: "${msg}" -> ${res}`);
        if (FF === "ff") {
          fastForward = true;
        }
      }
    } else {
      console.log("Mismatched history, playback stopped.");
    }
  }
  if (res === null) {
    res = prompts(msg);
  }
  history.push([msg, res]);
  writeFileSync(
    HISTORYFILE,
    "[" + history.map((i) => JSON.stringify(i)).join(",\n") + "]"
  );
  return res;
};

const loadHistory = ({ file }) => {
  HISTORYFILE = join(dirname(file), "." + basename(file) + ".history");
  if (existsSync(HISTORYFILE)) {
    const hist = JSON.parse(readFileSync(HISTORYFILE));
    console.log("+-- previous run");
    console.log(
      hist.map((item, num) => `| ${num}: ${item[0]}${item[1]}`).join("\n")
    );
    console.log("+--");
    const num = ~~prompts("replay up to which step? [0-don't]");
    if (num > 0) {
      pendingPlayback = hist.slice(0, num);
    }
  }
};

const { freeze, create, hasOwnProperty } = Object;
const { log, clear } = console;

const knownProxies = new WeakMap();

const visible = create(null);
const addPath = (path = [], value) => {
  let current = visible;
  let redraw = false;
  for (const segment of path) {
    if (!hasOwnProperty.call(current, segment)) {
      redraw = true;
      current[segment] = value || create(null);
    }
    current = current[segment];
  }
  if (redraw) {
    clear();
    console.log(JSON.stringify(visible, null, 2));
  }
};

const requireProxy = (target, thisArg, argumentsList) => {
  const y = prompt(`Run real require(${argumentsList[0]})? [y/N]`);
  if (y === "y") {
    return require(argumentsList[0]);
  } else {
    return mkCatcher(["require", `(${argumentsList[0]})`]);
  }
};

const functionProxy = (PATH) => (target, thisArg, argumentsList) => {
  // PATH+=`(${argumentsList.map(a=>JSON.stringify(a)).join(",")})`;
  // addPath(PATH + "=>", argumentsList);
  return mkCatcher([
    ...PATH,
    `(${argumentsList.map((a) => JSON.stringify(a)).join(",")})`,
  ]);
};

function mkCatcher(PATH = [], appl) {
  addPath(PATH);
  const cache = new Set();
  let target = {};
  if (appl) {
    target = () => {};
  }
  const prox = new Proxy(target, {
    has: (_, name) => {
      addPath([...PATH, name]);
      if (cache.has(name)) {
        return false;
      }
      if (name === "require" && PATH.length === 0) {
        return true;
      }
      const y = prompt(`Access real ${PATH.join(".")}.${name}? [a=always/y/N]`);
      if (y === "a") {
        cache.add(name);
        return false;
      }
      return !(y === "y");
    },
    get: (me, name) => {
      addPath([...PATH, name]);
      if (typeof name === "symbol" && PATH.length === 0) {
        return undefined;
      }
      if (hasOwnProperty.call(me, name)) {
        return me[name];
      }
      if (name === "require" && PATH.length === 0) {
        return mkCatcher(["require"], requireProxy);
      }

      const what = prompt(`Get ${PATH.join(".")}.${name} as [p/f/n/l/s/U]`);
      switch (what) {
        case "p":
          return mkCatcher([...PATH, name]);
        case "f":
          return mkCatcher([...PATH, name], functionProxy([...PATH, name]));
        case "n":
          return () => {};
        case "l":
          return freeze(log);
        case "s":
          return `string${Math.random().toFixed(7).substring(2)}`;
        default:
          return undefined;
      }
    },
    set: (me, name, value) => {
      addPath([...PATH, name]);
      if (typeof name === "symbol") {
        return undefined;
      }

      const what = prompt(`Set ${PATH.join(".")}.${name} [y/N]`);
      if (what === "y") {
        me[name] = value;
        return true;
      }
    },
    apply: appl,
    construct: functionProxy(PATH),
  });
  knownProxies.set(prox, PATH);
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
module.exports = (sourceCode, { file } = {}) => {
  loadHistory({ file });
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
              if (knownProxies.has(code)) {
                return log(
                  "A proxy you returned ended up passed into eval:",
                  knownProxies.get(code)
                );
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
    errorTaming: "unsafe",
  });
  return evaluate.call(create(null), sourceCode);
};