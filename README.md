# css-source-map-rebase

[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url] [![Coverage percentage][coveralls-image]][coveralls-url]

Rebase your CSS assets relatively to the source file they were imported from.

## Example

Consider the following SASS sources:

index.scss

``` css
@import "partial/bar.scss";

.foo {
    background: url('./foo.png');
}
```

partial/bar.scss

``` css
.bar {
    background: url('./bar.png');
}
```

By rebasing the assets relatively to the file they were imported from, the resulting CSS would be:

``` css
.bar {
    background: url('partial/bar.png');
}

.foo {
    background: url('foo.png');
}
```

## How it works

css-source-map-rebase uses the mapping provided by source maps to resolve the original file the assets where imported from. That's why it *needs* a source map to perform its magic. Any tool able to generate a source map from a stylesheet source file (may it be SASS, LESS or any other pre-processor language) is appropriate. Here is how one could use node-sass and css-source-map-rebase together to render a stylesheet and rebase its assets.

``` javascript
let nodeSass = require('node-sass');
let Rebaser = require('css-source-map-rebase');

nodeSass.render({
    file: 'index.scss',
    sourceMap: true,
    outFile: 'index.css'
}, function(error, result) {
    if (error) {
        // do something on error
    }
    else {
        let css = result.css.toString();
        let map = JSON.stringify(result.map);
        
        let rebaser = new Rebaser({
            map: map
        });
        
        let data = '';
        let stream = new Readable();
        
        stream
            .pipe(rebaser)
            .pipe(through(function (chunk, enc, cb) {
                data += chunk;
        
                cb();
            }))
            .on('finish', function () {
                console.log(data); // data contains the rendered stylesheet with rebased assets
            })
        ;
        
        stream.push(css);
        stream.push(null);
    }
});
```

## API

`let Rebaser = require('css-source-map-rebase')`

### rebaser = new Rebaser(opts={})

Return an object transform stream `rebaser` that expects entry filenames.

Optionally pass in some opts:

* opts.map:
  
  The belonging source map in the form of a JSON string. Defaults to `null`. Note that this module basically does nothing without a source map.

## Events

In addition to the usual events emitted by node.js streams, css-source-map-rebase emits the following events:

### rebaser.on('rebase', function(file) {})

Every time an asset is rebased, this event fires with the rebased path.

## Installation

```bash
npm install css-source-map-rebase
```

## Contributing

* Fork the main repository
* Code
* Implement tests using [node-tap](https://github.com/tapjs/node-tap)
* Issue a pull request keeping in mind that all pull requests must reference an issue in the issue queue

## License

Apache-2.0 © [Eric MORAND]()

[npm-image]: https://badge.fury.io/js/css-source-map-rebase.svg
[npm-url]: https://npmjs.org/package/css-source-map-rebase
[travis-image]: https://travis-ci.org/ericmorand/css-source-map-rebase.svg?branch=master
[travis-url]: https://travis-ci.org/ericmorand/css-source-map-rebase
[daviddm-image]: https://david-dm.org/ericmorand/css-source-map-rebase.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/ericmorand/css-source-map-rebase
[coveralls-image]: https://coveralls.io/repos/github/ericmorand/css-source-map-rebase/badge.svg
[coveralls-url]: https://coveralls.io/github/ericmorand/css-source-map-rebase