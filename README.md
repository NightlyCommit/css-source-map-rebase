# css-source-map-rebase

[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Coverage percentage][coveralls-image]][coveralls-url]

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
let {Rebaser} = require('css-source-map-rebase');

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
        let stream = new Readable({
            encoding: 'utf8'
        });
        
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

* opts.rebase:
    
    Handles when the rebaser encounters an asset that may need rebasing.
  
    * Type: `Function`
    * Default: `undefined`
    * Signature:
        * `{source, url, resolved}` - an object containing the following properties:
            * `source (URL)` - the [URL](https://nodejs.org/api/url.html) of the source file where the asset was found.
            * `url (URL)` - the [URL](https://nodejs.org/api/url.html) of the asset in the source file.
            * `resolved (URL)` - the resolved [URL](https://nodejs.org/api/url.html) of the asset - i.e. the [URL](https://nodejs.org/api/url.html) of the asset relative to the source file.
        * `done (Function)` - a callback function to invoke on completion. Accepts either `false`, `null`, `undefined` or an [URL](https://nodejs.org/api/url.html) as parameter. When called with `false`, the asset will not be rebased. When called with either `null` or `undefined`, the asset will be rebased using the [default rebasing logic](#rebasing-logic). When called with an [URL](https://nodejs.org/api/url.html), the asset will be rebased to that [URL](https://nodejs.org/api/url.html).

## <a name="rebasing-logic"></a>Rebasing logic

When css-source-map-rebase encounters an asset that may need rebasing, it first checks if it is a remote or a local asset. In the former case, the asset is not rebased at all. In the latter case, the asset is rebased be resolving the asset path relatively to the path of the source it's coming from.

For example, a `foo/bar.png` asset coming from `lorem/ipsum/index.scss` would be rebased to `lorem/ipsum/foo/bar.png`.

## Events

In addition to the usual events emitted by node.js streams, css-source-map-rebase emits the following events:

### rebaser.on('rebase', function({raw: URL, resolved: URL, rebased: URL}) {})

Every time an asset is rebased, this event fires with an object containing the following properties:

* `raw` - the [URL](https://nodejs.org/api/url.html) of the asset in the source file.
* `resolved` - the resolved [URL](https://nodejs.org/api/url.html) of the asset - i.e. the [URL](https://nodejs.org/api/url.html) of the asset relative to the source file.
* `rebased` - the rebased [URL](https://nodejs.org/api/url.html) of the asset.

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
[coveralls-image]: https://coveralls.io/repos/github/ericmorand/css-source-map-rebase/badge.svg
[coveralls-url]: https://coveralls.io/github/ericmorand/css-source-map-rebase