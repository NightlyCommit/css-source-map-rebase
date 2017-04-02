# css-source-map-rebase

[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url] [![Coverage percentage][coveralls-image]][coveralls-url]

Rebase your CSS assets based on its belonging source map.

## Installation

```bash
npm install css-source-map-rebase
```

## API

`let Rebaser = require('css-source-map-rebase')`

### rebaser = new Rebaser(opts={})

Return an object transform stream `rebaser` that expects entry filenames.

Optionally pass in some opts:

* opts.map:
  
  The belonging source map in the form of a JSON string. Defaults to `null`.

## Events

In addition to the usual events emitted by node.js streams, css-source-map-rebase emits the following events:

### rebaser.on('rebase', function(file) {})

Every time an asset is rebased, this event fires with the rebased path.

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