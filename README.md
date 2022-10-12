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
 0: undefined
```

## Examples

These are outputs from running the samples present in the repo.  
obfuscated-a.js was created using highest level of https://obfuscator.io/

```
## Running "samples/a.js" ##
Access real global.console? [a=always/y/N]y
this is a demo sample
Access real global.URL? [a=always/y/N]y
Access real global.require? [a=always/y/N]
Get global.require as [p/n/l/f/0]f
=>global.require( [Arguments] { '0': 'fs' } )
Get global.require=>{}.readFileSync as [p/n/l/f/0]n
Run real EVAL? [y/N]
returning console.log instead of eval
example_payload
```

Note this is not the first pass. On a first pass one should not allow real `Function`
```
## Running "samples/obfuscated-a.js" ##
Access real global.parseInt? [a=always/y/N]a
Access real global.undefined? [a=always/y/N]a
Access real global.RegExp? [a=always/y/N]a
Access real global.Boolean? [a=always/y/N]a
Access real global.String? [a=always/y/N]a
Access real global.decodeURIComponent? [a=always/y/N]a
Access real global.Function? [a=always/y/N]y
Access real global.window? [a=always/y/N]
Get global.window as [p/n/l/f/0]p
Get global.window.console as [p/n/l/f/0]p
Get global.window.console.log as [p/n/l/f/0]l
Get global.window.console.warn as [p/n/l/f/0]l
Get global.window.console.info as [p/n/l/f/0]l
Get global.window.console.error as [p/n/l/f/0]l
Get global.window.console.exception as [p/n/l/f/0]l
Get global.window.console.table as [p/n/l/f/0]l
Get global.window.console.trace as [p/n/l/f/0]l
Access real global.console? [a=always/y/N]y
this is a demo sample
Access real global.URL? [a=always/y/N]y
Access real global.Function? [a=always/y/N]
Get global.Function as [p/n/l/f/0]l
return (function() {}.constructor("return this")( ));
Access real global.window? [a=always/y/N]
Get global.window as [p/n/l/f/0]p
Get global.window.setInterval as [p/n/l/f/0]l
{} 4000
Access real global.require? [a=always/y/N]
Get global.require as [p/n/l/f/0]f
=>global.require( [Arguments] { '0': 'fs' } )
Get global.require=>{}.readFileSync as [p/n/l/f/0]n
Run real EVAL? [y/N]
returning console.log instead of eval
example_payload
```

Annotated with explanations
```
## Running "samples/obfuscated-a.js" ##
Access real global.parseInt? [a=always/y/N]a
Access real global.undefined? [a=always/y/N]a
Access real global.RegExp? [a=always/y/N]a
Access real global.Boolean? [a=always/y/N]a
Access real global.String? [a=always/y/N]a
Access real global.decodeURIComponent? [a=always/y/N]a
Access real global.Function? [a=always/y/N]y
Access real global.window? [a=always/y/N]
^^^ tools used to undo obfuscation
Get global.window as [p/n/l/f/0]p
Get global.window.console as [p/n/l/f/0]p
Get global.window.console.log as [p/n/l/f/0]l
Get global.window.console.warn as [p/n/l/f/0]l
Get global.window.console.info as [p/n/l/f/0]l
Get global.window.console.error as [p/n/l/f/0]l
Get global.window.console.exception as [p/n/l/f/0]l
Get global.window.console.table as [p/n/l/f/0]l
Get global.window.console.trace as [p/n/l/f/0]l
^^^ looks like polyfilling
Access real global.console? [a=always/y/N]y
^^^ actual console usage from the obfuscated script
this is a demo sample
^^^ output of that concole.log
Access real global.URL? [a=always/y/N]y
^^^ actual URL reference for the obfuscated script
Access real global.Function? [a=always/y/N]
Get global.Function as [p/n/l/f/0]l
return (function() {}.constructor("return this")( ));
^^^ attempt at getting the real global
Access real global.window? [a=always/y/N]
^^^ fallback to window
Get global.window as [p/n/l/f/0]p
Get global.window.setInterval as [p/n/l/f/0]l
^^^ getting setInterval, we replace it with a log
{} 4000
^^^ looks like a deobfuscation prevention
vvv all of the obfuscated script now running
Access real global.require? [a=always/y/N]
Get global.require as [p/n/l/f/0]f
=>global.require( [Arguments] { '0': 'fs' } )
Get global.require=>{}.readFileSync as [p/n/l/f/0]n
Run real EVAL? [y/N]
returning console.log instead of eval
example_payload
```