const {Rebaser} = require('../src');
const tap = require('tap');
const fs = require('fs');
const path = require('path');
const through = require('through2');
const cleanCSS = require('./lib/clean-css');
const nodeSass = require('node-sass');
const Readable = require('stream').Readable;
const Url = require('url');
const {SourceMapGenerator} = require('source-map');

let render = function (entry, sourceMapEmbed = true) {
  return nodeSass.renderSync({
    file: entry,
    sourceMap: true,
    sourceMapEmbed: sourceMapEmbed,
    outFile: 'index.css'
  });
};

tap.test('rebaser', function (test) {
  test.test('should throw an error when no source map is found', function (test) {
    let sassRenderResult = render(path.resolve('test/fixtures/index.scss'), false);

    let rebaser = new Rebaser();

    let stream = new Readable({
      encoding: 'utf8'
    });

    stream
      .pipe(rebaser)
      .on('finish', function () {
        test.fail();

        test.end();
      })
      .on('error', function (err) {
        test.same(err.message, 'A map is required, either inline or explicitly passed as an option.');

        test.end();
      })
    ;

    stream.push(sassRenderResult.css);
    stream.push(null);
  });

  test.test('should handle well-formed map', function (test) {
    let sassRenderResult = render(path.resolve('test/fixtures/index.scss'));

    let rebaser = new Rebaser();

    let data = null;
    let stream = new Readable();

    stream
      .pipe(rebaser)
      .pipe(through(function (chunk, enc, cb) {
        data = chunk;

        cb();
      }))
      .on('finish', function () {
        fs.readFile(path.resolve('test/fixtures/wanted.css'), function (err, readData) {
          test.equal(data.toString(), readData.toString());

          test.end();
        });
      })
      .on('error', function (err) {
        test.fail(err);

        test.end();
      });

    stream.push(sassRenderResult.css);
    stream.push(null);
  });

  test.test('should emit "error" event on badly formed map', function (test) {
    let sassRenderResult = render(path.resolve('test/fixtures/index.scss'));

    let rebaser = new Rebaser({
      map: 'foo'
    });

    let data = null;
    let stream = new Readable();

    rebaser.on('error', function (err) {
      test.ok(err);

      test.end();
    });

    stream
      .pipe(rebaser)
      .pipe(through(function (chunk, enc, cb) {
        data = chunk;

        cb();
      }))
      .on('finish', function () {
        test.fail();

        test.end();
      });

    stream.push(sassRenderResult.css);
    stream.push(null);
  });

  test.test('should emit "rebase" event', function (test) {
    let sassRenderResult = render(path.resolve('test/fixtures/index.scss'));

    let rebaser = new Rebaser();

    let rawAssets = [];
    let resolvedAssets = [];
    let rebasedAssets = [];
    let stream = new Readable();

    rebaser.on('rebase', function ({raw, resolved, rebased}) {
      rawAssets.push(raw.href);
      resolvedAssets.push(resolved.href);
      rebasedAssets.push(rebased.href);
    });

    stream
      .pipe(rebaser)
      .pipe(through(function (chunk, enc, cb) {
        data = chunk;

        cb();
      }))
      .on('finish', function () {
        test.same(rawAssets.sort(), [
          './assets/foo.png',
          './assets/bar.png',
          './assets/bar.eot',
          './assets/bar.eot#bar',
          './assets/bar.woff'
        ].sort());

        test.same(resolvedAssets.sort(), [
          'test/fixtures/assets/foo.png',
          'test/fixtures/mixins/assets/bar.png',
          'test/fixtures/partials/assets/bar.eot',
          'test/fixtures/partials/assets/bar.eot#bar',
          'test/fixtures/partials/assets/bar.woff'
        ].sort());

        test.same(rebasedAssets.sort(), [
          'test/fixtures/assets/foo.png',
          'test/fixtures/mixins/assets/bar.png',
          'test/fixtures/partials/assets/bar.eot',
          'test/fixtures/partials/assets/bar.eot#bar',
          'test/fixtures/partials/assets/bar.woff'
        ].sort());

        test.end();
      });

    stream.push(sassRenderResult.css);
    stream.push(null);
  });

  test.test('should handle remote and absolute paths', function (test) {
    let sassRenderResult = render(path.resolve('test/fixtures/remote-and-absolute/index.scss'));

    let rebaser = new Rebaser();

    let data = null;

    let stream = new Readable();

    stream
      .pipe(rebaser)
      .pipe(through(function (chunk, enc, cb) {
        data = chunk;

        cb();
      }))
      .on('finish', function () {
        fs.readFile(path.resolve('test/fixtures/remote-and-absolute/wanted.css'), function (err, readData) {
          test.equal(cleanCSS(data), cleanCSS(readData.toString()));

          test.end();
        });
      })
      .on('error', function (err) {
        test.fail(err);

        test.end();
      });

    stream.push(sassRenderResult.css);
    stream.push(null);
  });

  test.test('should handle map and css not belonging to each other', function (test) {
    let sassRenderResultCss = render(path.resolve('test/fixtures/map-and-css-not-belonging-to-each-other/index.scss'));

    let rebaser = new Rebaser({
      map: new SourceMapGenerator().toString()
    });

    let data = null;
    let stream = new Readable();

    stream
      .pipe(rebaser)
      .pipe(through(function (chunk, enc, cb) {
        data = chunk;

        cb();
      }))
      .on('finish', function () {
        fs.readFile(path.resolve('test/fixtures/map-and-css-not-belonging-to-each-other/wanted.css'), function (err, readData) {
          test.equal(cleanCSS(data), cleanCSS(readData.toString()));

          test.end();
        });
      })
      .on('error', function (err) {
        test.fail(err);

        test.end();
      });

    stream.push(sassRenderResultCss.css);
    stream.push(null);
  });

  test.test('should support rebase callback', function (test) {
    let sassRenderResult = render(path.resolve('test/fixtures/index.scss'));

    test.test('{source, url, resolved}', function (test) {
      let actualSource = null;
      let actualUrl = null;
      let actualResolved = null;

      let rebaser = new Rebaser({
        rebase: ({source, url, resolved}, done) => {
          actualSource = source;
          actualUrl = url;
          actualResolved = resolved;

          done();
        }
      });

      let stream = new Readable({
        encoding: 'utf8'
      });

      stream
        .pipe(rebaser)
        .on('finish', function () {
          test.same(actualSource.href, 'test/fixtures/mixins/_bar.scss', 'source contains the URL of the source file');
          test.same(actualUrl.href, './assets/bar.png', 'url contains the raw URL of the asset');
          test.same(actualResolved.href, 'test/fixtures/mixins/assets/bar.png', 'resolved contains the resolved URL of the asset');

          test.end();
        })
      ;

      stream.push(sassRenderResult.css);
      stream.push(null);
    });

    test.test('done', function (test) {
      test.test('supports being called with false', (test) => {
        let rebasingDidHappen = false;

        let rebaser = new Rebaser({
          rebase: ({}, done) => {
            done(false);
          }
        });

        rebaser.on('rebase', () => {
          rebasingDidHappen = true;
        });

        let stream = new Readable({
          encoding: 'utf8'
        });

        stream
          .pipe(rebaser)
          .on('finish', function () {
            test.false(rebasingDidHappen, 'rebasing does not happen');

            test.end();
          })
        ;

        stream.push(sassRenderResult.css);
        stream.push(null);
      });

      test.test('supports being called with undefined', (test) => {
        let rebasedUrl = null;

        let rebaser = new Rebaser({
          rebase: ({}, done) => {
            done();
          }
        });

        rebaser.on('rebase', ({rebased}) => {
          rebasedUrl = rebased;
        });

        let stream = new Readable({
          encoding: 'utf8'
        });

        stream
          .pipe(rebaser)
          .on('finish', function () {
            test.same(rebasedUrl.href, 'test/fixtures/mixins/assets/bar.png', 'rebasing happens with default logic');

            test.end();
          })
        ;

        stream.push(sassRenderResult.css);
        stream.push(null);
      });

      test.test('supports being called with null', (test) => {
        let rebasedUrl = null;

        let rebaser = new Rebaser({
          rebase: ({}, done) => {
            done(null);
          }
        });

        rebaser.on('rebase', ({rebased}) => {
          rebasedUrl = rebased;
        });

        let stream = new Readable({
          encoding: 'utf8'
        });

        stream
          .pipe(rebaser)
          .on('finish', function () {
            test.same(rebasedUrl.href, 'test/fixtures/mixins/assets/bar.png', 'rebasing happens with default logic');

            test.end();
          })
        ;

        stream.push(sassRenderResult.css);
        stream.push(null);
      });

      test.test('supports being called with a value', (test) => {
        let rebasedUrl = null;

        let rebaser = new Rebaser({
          rebase: ({}, done) => {
            done(Url.parse('foo/bar'));
          }
        });

        rebaser.on('rebase', ({rebased}) => {
          rebasedUrl = rebased;
        });

        let stream = new Readable({
          encoding: 'utf8'
        });

        stream
          .pipe(rebaser)
          .on('finish', function () {
            test.same(rebasedUrl.href, 'foo/bar', 'rebasing happen using the provided value');

            test.end();
          })
        ;

        stream.push(sassRenderResult.css);
        stream.push(null);
      });

      test.end();
    });

    test.end();
  });

  test.end();
});