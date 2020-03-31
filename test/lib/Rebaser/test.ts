import {renderSync} from "node-sass";
import {Rebaser} from "../../../src/lib/Rebaser";
import {resolve as resolvePath, posix, dirname} from "path";
import * as tape from "tape";
import {SourceMapConsumer, MappingItem} from "source-map";

let render = (entry: string, sourceMapEmbed: boolean = false) => {
  return renderSync({
    file: entry,
    sourceMap: true,
    sourceMapEmbed: sourceMapEmbed,
    omitSourceMapUrl: !sourceMapEmbed,
    outFile: "index.css",
    outputStyle: "expanded"
  });
};

tape("Rebaser", (test) => {
  test.test("throws an error when no source map is found", (test) => {
    let rebaser = new Rebaser();

    rebaser.rebase(Buffer.from(`.foo {}`))
      .then(() => {
        test.fail("Should throw an error");
        test.end();
      })
      .catch((err) => {
        test.same(err.message, "A map is required, either inline or explicitly passed as an option.");
        test.end();
      });
  });

  test.test("supports well-formed map", (test) => {
    let sassRenderResult = render(resolvePath("test/fixtures/index.scss"));

    let rebaser = new Rebaser({
      map: sassRenderResult.map
    });

    rebaser.rebase(sassRenderResult.css)
      .then(result => {
        test.equal(result.css.toString(), `@font-face {
  font-family: Foo;
  src: url("test/fixtures/partials/assets/bar.eot"), url("test/fixtures/partials/assets/bar.eot") format("embedded-opentype");
  src: url("test/fixtures/partials/assets/bar.woff") format("woff");
}

.foo {
  background: url("test/fixtures/assets/foo.png");
}

.bar {
  background: url(test/fixtures/mixins/assets/bar.png);
}
`);
        test.end();
      })
      .catch(err => {
        test.fail(err.message);
        test.end();
      });
  });

  test.test("supports embedded map", (test) => {
    let sassRenderResult = render(resolvePath("test/fixtures/index.scss"), true);

    let rebaser = new Rebaser();

    rebaser.rebase(sassRenderResult.css)
      .then(result => {
        test.pass();
        test.end();
      })
      .catch(err => {
        test.fail(err.message);
        test.end();
      });
  });

  test.test("throws an error on badly formed map", (test) => {
    let rebaser = new Rebaser({
      map: Buffer.from("foo")
    });

    rebaser.rebase(Buffer.from(`.foo {}`))
      .then(() => {
        test.fail("Should throw an error");
        test.end();
      })
      .catch((err) => {
        test.pass(err.message);
        test.end();
      });
  });

  test.test("emits \"rebase\" event", (test) => {
    let sassRenderResult = render(resolvePath("test/fixtures/index.scss"));

    let rebaser = new Rebaser({
      map: sassRenderResult.map
    });

    let rebasedAssets: Array<string> = [];

    rebaser.on("rebase", (rebasedPath) => {
      rebasedAssets.push(rebasedPath);
    });

    rebaser.rebase(sassRenderResult.css)
      .then(result => {
        test.same(rebasedAssets.sort(), [
          "test/fixtures/assets/foo.png",
          "test/fixtures/mixins/assets/bar.png",
          "test/fixtures/partials/assets/bar.eot",
          "test/fixtures/partials/assets/bar.eot",
          "test/fixtures/partials/assets/bar.woff"
        ].sort());

        test.end();
      });
  });

  test.test("bypasses remote, absolute and hash-only paths", (test) => {
    let sassRenderResult = render(resolvePath("test/fixtures/remote-and-absolute/index.scss"));

    let rebaser = new Rebaser({
      map: sassRenderResult.map,
      rebase: (source, path, done) => {
        done('foo');
      }
    });

    rebaser.rebase(sassRenderResult.css)
      .then(result => {
        test.equal(result.css.toString(), `.foo {
  background: url("/foo/bar");
}

.bar {
  background: url("//foo/bar");
}

.foo-bar {
  background: url("http://foo/bar");
}

.svg-id {
  fill: url(#foo);
}
`);

        test.end();
      });
  });

  test.test("supports map and css not belonging to each other", (test) => {
    let sassRenderResultCss = render(resolvePath("test/fixtures/map-and-css-not-belonging-to-each-other/index.scss"));
    let otherRenderResultCss = render(resolvePath("test/fixtures/map-and-css-not-belonging-to-each-other/other.scss"));

    let rebaser = new Rebaser({
      map: otherRenderResultCss.map
    });

    rebaser.rebase(sassRenderResultCss.css)
      .then(result => {
        test.equal(result.css.toString(), `.foo {
  background: url("../assets/foo.png");
}
`);
        test.end();
      })
      .catch(err => {
        test.fail(err.message);
        test.end();
      });
  });

  test.test("supports \"rebase\" callback", (test) => {
    let sassRenderResult = render(resolvePath("test/fixtures/index.scss"));

    test.test("signature", (test) => {
      let actualSource: string = null;
      let actualResolved: string = null;

      let rebaser = new Rebaser({
        map: sassRenderResult.map,
        rebase: (source, resolvedPath, done) => {
          actualSource = source;
          actualResolved = resolvedPath;

          done();
        }
      });

      rebaser.rebase(sassRenderResult.css)
        .then(result => {
          test.same(actualSource, "test/fixtures/mixins/_bar.scss", "node contains the path of the source file");
          test.same(actualResolved, "test/fixtures/mixins/assets/bar.png", "resolvedPath contains the resolved path of the asset");

          test.end();
        });
    });

    test.test("done", (test) => {
      test.test("supports being called with false", (test) => {
        let rebasingDidHappen = false;

        let rebaser = new Rebaser({
          map: sassRenderResult.map,
          rebase: (node, path, done) => {
            done(false);
          }
        });

        rebaser.on("rebase", () => {
          rebasingDidHappen = true;
        }).rebase(sassRenderResult.css)
          .then(result => {
            test.false(rebasingDidHappen, "rebasing did not happen");

            test.end();
          });
      });

      test.test("supports being called with undefined", (test) => {
        let actualRebasedPath: string;

        let rebaser = new Rebaser({
          map: sassRenderResult.map,
          rebase: (node, path, done) => {
            done();
          }
        });

        rebaser.on("rebase", (rebasedPath) => {
          actualRebasedPath = rebasedPath;
        }).rebase(sassRenderResult.css)
          .then(result => {
            test.same(actualRebasedPath, "test/fixtures/mixins/assets/bar.png", "rebasing happened with default logic");

            test.end();
          });
      });

      test.test("supports being called with null", (test) => {
        let actualRebasePath: string;

        let rebaser = new Rebaser({
          map: sassRenderResult.map,
          rebase: (node, path, done) => {
            done(null);
          }
        });

        rebaser.on("rebase", (rebasePath) => {
          actualRebasePath = rebasePath;
        }).rebase(sassRenderResult.css)
          .then(result => {
            test.same(actualRebasePath, "test/fixtures/mixins/assets/bar.png", "rebasing happened with default logic");

            test.end();
          });
      });

      test.test("supports being called with a value", (test) => {
        let actualRebasePath: string;

        let rebaser = new Rebaser({
          map: sassRenderResult.map,
          rebase: (node, path, done) => {
            done("foo/bar");
          }
        });

        rebaser.on("rebase", (rebasedPath) => {
          actualRebasePath = rebasedPath;
        }).rebase(sassRenderResult.css)
          .then(result => {
            test.same(actualRebasePath, "foo/bar", "rebasing happened using the provided value");

            test.end();
          });
      });

      test.end();
    });

    test.end();
  });

  test.test("emits source map", (test) => {
    let sassRenderResult = render(resolvePath("test/fixtures/source-map/basic.scss"));

    let rebaser = new Rebaser({
      map: sassRenderResult.map,
      rebase: (source, path, done) => {
        done(posix.join(dirname(source), 'foo1'));
      }
    });

    rebaser.rebase(sassRenderResult.css)
      .then(result => {
        new SourceMapConsumer(result.map.toString()).then(consumer => {
          let mappings: Array<MappingItem> = [];

          consumer.eachMapping(mapping => {
            mappings.push(mapping);
          });

          mappings.pop();

          let mapping = mappings.pop();

          test.same(mapping.generatedColumn, 50);

          test.end();
        });
      });
  });

  test.end();
});