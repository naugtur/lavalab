# lavalab

Not a malware research lab.

> **Warning** this is an experiment. It doesn't utilize the full protection of SES. It's not claiming to be applicable or useful for actual malware analysis.

> **Warning** no ESM `import` support

## Usage

Requires docker present and working.  
Runs a no-network container in which malware can be gradually detonated.

- put your sample in ./samples/
- run `lab.sh`
- inside the container, run your sample: `lavalab samples/a.js`
- when in doubt, kill the container

lavalab instruments running code with proxies starting at `global` and prompts synchronously to ask what to return.
```
Return values from proxy:
 p: proxy-prompt
 n: noop function
 l: console.log
 f: function=>proxy-prompt
 s: random string
 U: undefined
```
## Browser

There's a browser variant, even more barebones and experimental. See `browser/index.html`


----

> Samples zip file may contain actual malware samples historically available from NPM. It's intended only for author's own usage. Author is allowing opening the zip file by people who figure out how to open the zip file. 😄 The password is not too strong.