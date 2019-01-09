const path = require('path');
const unquote = require('unquote');
const {Transform} = require('stream');
const {parse} = require('url');
const {SourceMapConsumer} = require('source-map');

exports.Rebaser = class extends Transform {
  constructor(options) {
    options = options || {};

    super(options);

    this.map = options.map;
    this.rebase = options.rebase;
  }

  _transform(chunk, encoding, callback) {
    try {
      let self = this;
      let rebase = this.rebase;

      let parseTree = require('gonzales-pe').parse(chunk.toString(), {
        syntax: 'css'
      });

      if (self.map) {
        let sourceMapConsumer = new SourceMapConsumer(self.map);

        parseTree.traverseByType('uri', function (node) {
          let nodeStartLine = node.start.line;
          let nodeStartColumn = node.start.column;

          let contentNode = node.first('string');

          if (!contentNode) {
            contentNode = node.first('raw');
          }

          let url = parse(unquote(contentNode.content));

          let sourceMapNode = sourceMapConsumer.originalPositionFor({
            line: nodeStartLine,
            column: nodeStartColumn
          });

          if (sourceMapNode && sourceMapNode.source) {
            let resolvedUrl;

            if (path.isAbsolute(url.href) || url.host || (url.hash && !url.path)) {
              resolvedUrl = url;
            } else {
              resolvedUrl = parse(path.join(path.dirname(sourceMapNode.source), url.href));
            }

            let done = (rebasedUrl) => {
              if (rebasedUrl !== false) {
                if (!rebasedUrl) { // default rebasing
                  rebasedUrl = resolvedUrl;
                }

                contentNode.content = rebasedUrl.href;

                self.emit('rebase', {
                  raw: url,
                  resolved: resolvedUrl,
                  rebased: rebasedUrl
                });
              }
            };

            if (!rebase) {
              rebase = ({}, done) => {
                done();
              };
            }

            rebase({
              url: url,
              source: parse(sourceMapNode.source),
              resolved: resolvedUrl
            }, done);
          }
        });
      }

      self.push(parseTree.toString());

      callback();
    } catch (err) {
      callback(err);
    }
  }
};