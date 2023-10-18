(function () {
  const THE_EVAL = eval;

  const { freeze, create, hasOwnProperty } = Object;
  const { log, clear } = console;

  const prompt = (msg) => {
    const y = window.prompt(msg);
    if (y === null) {
      throw new Error("User aborted");
    }
    return y;
  };

  const lockdownOnce = (() => {
    let hasRun = false;
    return () => {
      if (!hasRun) {
        hasRun = true;
        lockdown({
          errorTaming: "unsafe",
          overrideTaming: "severe",
        });
      }
    };
  })();

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
        const y = prompt(
          `Access real ${PATH.join(".")}.${name}? [a=always/y/N]`
        );
        if (y === "a") {
          cache.add(name);
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

        const what = prompt(`Set ${PATH.join(".")}.${name} [Y/n]`);
        if (what !== "n") {
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

  function mkGetTrap(PATH) {
    return (me, name) => {
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

      const what = prompt(`Get ${PATH.join(".")}.${name} as [p/f/cb/n/l/s/U]`);
      switch (what) {
        case "p":
          return mkCatcher([...PATH, name]);
        case "f":
          return mkCatcher([...PATH, name], functionProxy([...PATH, name]));
        case "cb":
          return mkCatcher([...PATH, name], callbackCaller([...PATH, name]));
        case "l":
          return freeze(log);
        case "s":
          const s = `string${stringSequence++}`;
          addPath([...PATH, name], s, !!"force");
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

  function createEvalOnce() {
    let once = true;
    return Object.freeze(
      Object.defineProperty(Object.create(null), "eval", {
        get: () => {
          if (once) {
            once = false;
            return THE_EVAL;
          }
          if ("y" === prompt(`Run real EVAL? [y/N]`)) {
            return THE_EVAL;
          } else {
            const nestedEvaluate = evaluator.call({
              evalOnce: createEvalOnce(),
              scopeGuard: mkCatcher(),
            });
            return freeze(function (code) {
              if (knownProxies.has(code)) {
                return log(
                  "A proxy you returned ended up passed into eval:",
                  knownProxies.get(code)
                );
              }
              return nestedEvaluate(code);
            });
          }
        },
      })
    );
  }
  window.lavalab = (sourceCode) => {
    const evaluatorContext = {
      evalOnce: createEvalOnce(),
      scopeGuard: mkCatcher(),
    };
    const evaluate = evaluator.call(evaluatorContext);
    lockdownOnce();
    return evaluate.call(create(null), sourceCode);
  };
})();
