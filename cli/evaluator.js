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
        const FF = prompts(`▒ ${msg} -> ${res}`);
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
    let num = prompts("replay up to which step? [0-don't, default all]");
    if (num === "") {
      num = Infinity;
    } else {
      num = Number(num);
    }
    addPath([], null, !!"force drawing");
    if (num > 0) {
      pendingPlayback = hist.slice(0, num);
    }
  }
};

const { freeze, create, hasOwnProperty } = Object;
const { log, clear } = console;

const knownProxies = new WeakMap();

const visible = create(null);
const addPath = (path = [], value, force) => {
  let current = visible;
  let redraw = false;
  let last = {};
  for (const segment of path) {
    if (!hasOwnProperty.call(current, segment)) {
      redraw = true;
      current[segment] = value || create(null);
    }
    current = current[segment];
    last = current;
  }
  if (force) {
    redraw = true;
    if (value) {
      last.toJSON = () => value;
    }
  }

  if (redraw) {
    // prompts(); // pause to see the output
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
  return mkGetTrap(PATH)(
    {},
    `(${argumentsList.map((a) => JSON.stringify(a)).join(",")})`
  );
};
const callbackCaller = (PATH) => (target, thisArg, argumentsList) => {
  addPath([...PATH, "(cb)"]);
  const cb = argumentsList[argumentsList.length - 1];
  if (typeof cb === "function") {
    cb(mkGetTrap([...PATH, "(cb)"])({}, "arg1"));
  }
  return thisArg;
};

let stringSequence = 0;

const PROXYCACHE = new Map();

function mkCatcher(PATH = [], { callable, globalThisTarget } = {}) {
  addPath(PATH);
  const cacheKeyFromPath = PATH.join(".");
  if (PROXYCACHE.has(cacheKeyFromPath)) {
    return PROXYCACHE.get(cacheKeyFromPath);
  }
  const realAccessCache = new Set();
  let target = {};
  if (callable) {
    target = function () {};
  }
  if (globalThisTarget) {
    target = globalThisTarget;
  }
  const prox = new Proxy(target, {
    has: (_, name) => {
      addPath([...PATH, name]);
      if (globalThisTarget) {
        return true;
      }
      if (realAccessCache.has(name)) {
        return false;
      }
      if (name === "require" && PATH.length === 0) {
        return true;
      }
      const y = prompt(`Access real ${PATH.join(".")}.${name}? [a=always/y/N]`);
      if (y === "a") {
        realAccessCache.add(name);
        return false;
      }
      return !(y === "y");
    },
    get: mkGetTrap(PATH),
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
    apply: callable,
    construct: functionProxy(PATH),
  });
  PROXYCACHE.set(cacheKeyFromPath, prox);
  knownProxies.set(prox, PATH);
  return prox;
}

function mkGetTrap(PATH) {
  return (me, name) => {
    addPath([...PATH, name]);
    if (typeof name === "symbol" && PATH.length === 0) {
      return undefined;
    }
    if (name === "require" && PATH.length === 0) {
      return mkCatcher(["require"], { callable: requireProxy });
    }
    const NEWPATH = [...PATH, name];
    const pathString = `${NEWPATH.join(".")}`;
    let what;
    if (PROXYCACHE.has(pathString)) {
      what = "p";
    } else {
      what = prompt(`Get ${pathString} as [p/f/cb/n/l/s/-/U]`);
    }

    switch (what) {
      case "-":
        return me[name];
      case "p":
        return mkCatcher(NEWPATH);
      case "f":
        return mkCatcher(NEWPATH, { callable: functionProxy(NEWPATH) });
      case "cb":
        return mkCatcher(NEWPATH, { callable: callbackCaller(NEWPATH) });
      case "l":
        return freeze(log);
      case "s":
        const s = `string${stringSequence++}`;
        addPath(NEWPATH, s, !!"force");
        return s;
      default:
        return undefined;
    }
  };
}

log(`Return values from proxy:
 p: proxy-prompt
 l: console.log
 f: function=>proxy-prompt
 cb: function=>calls last arg
 s: a string
 -: value from proxy target
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
module.exports.run = (sourceCode, { file } = {}) => {
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
              log(stamp, ":", code.substring(0, 20) + "… (written to a file)");
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
    overrideTaming: "severe"
  });
  return evaluate.call(create(null), sourceCode);
};

module.exports.runBytecode = (bytecode, { file } = {}) => {
  const vm = require("node:vm");
  let success;
  for (let length = 0; length < bytecode.length; length++) {
    const fakeCode = " ".repeat(length);

    const rebuilt = new vm.Script(fakeCode, {
      cachedData: bytecode,
      filename: "a.js",
      lineOffset: 0,
      displayErrors: true,
    });
    if (!rebuilt.cachedDataRejected) {
      success = rebuilt;
      console.log("guessed", length);
      break;
    }
  }
  if (success) {
    loadHistory({ file });
    lockdown({
      errorTaming: "unsafe",
      overrideTaming: "severe"
    });

    // TODO maybe: run in new context, execute lockdown and run in current context within that.
    success.runInNewContext(mkCatcher([], { globalThisTarget: globalThis }));
  } else {
    console.log("Failed to guess", bytecode.length);
  }
};
