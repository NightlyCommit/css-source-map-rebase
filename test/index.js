const Rebaser = require('../src');
const tap = require('tap');
const fs = require('fs');
const path = require('path');
const through = require('through2');
const cleanCSS = require('./lib/clean-css');
const nodeSass = require('node-sass');
const Readable = require('stream').Readable;

let render = function (entry) {
  let sassRenderResult = nodeSass.renderSync({
    file: entry,
    sourceMap: true,
    outFile: 'index.css'
  });

  return sassRenderResult;
};

tap.test('rebaser', function (test) {
  test.plan(7);

  test.test('should handle well-formed map', function (test) {
    let sassRenderResult = render(path.resolve('test/fixtures/index.scss'));

    let rebaser = new Rebaser({
      map: sassRenderResult.map.toString()
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
        fs.readFile(path.resolve('test/fixtures/wanted.css'), function (err, readData) {
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

  test.test('should emit "error" event on badly formed css', function (test) {
    let rebaser = new Rebaser();

    let file = path.resolve('test/fixtures/error.css');
    let error = null;

    fs.createReadStream(file)
      .pipe(rebaser)
      .on('finish', function () {
        test.fail();

        test.end();
      })
      .on('error', function (err) {
          test.ok(err);

          test.end();
        }
      )
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

    let rebaser = new Rebaser({
      map: sassRenderResult.map.toString()
    });

    let rebased = [];
    let stream = new Readable();

    rebaser.on('rebase', function (file) {
      rebased.push(file);
    });

    stream
      .pipe(rebaser)
      .pipe(through(function (chunk, enc, cb) {
        data = chunk;

        cb();
      }))
      .on('finish', function () {
        test.same(rebased.sort(), [
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

    let rebaser = new Rebaser({
      map: sassRenderResult.map.toString()
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

  test.test('should support no map option', function (test) {
    let sassRenderResult = render(path.resolve('test/fixtures/no-map/index.scss'));

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
        fs.readFile(path.resolve('test/fixtures/no-map/wanted.css'), function (err, readData) {
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
    let sassRenderResultCss = render(path.resolve('test/fixtures/map-and-css-not-belonging-to-each-other/index-css.scss'));
    let sassRenderResultMap = render(path.resolve('test/fixtures/map-and-css-not-belonging-to-each-other/index-map.scss'));

    let rebaser = new Rebaser({
      map: sassRenderResultMap.map.toString()
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
});