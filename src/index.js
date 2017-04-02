const fs = require('fs');
const path = require('path');
const unquote = require('unquote');
const Transform = require('stream').Transform;
const Url = require('url');
const SourceMapConsumer = require('source-map').SourceMapConsumer;
const SourceNode = require('source-map').SourceNode;

class Rebaser extends Transform {
  constructor(options) {
    options = options || {};

    super(options);

    this.map = options.map;
  }

  _transform(chunk, encoding, callback) {
    try {
      let self = this;

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

          let contentNodeContent = unquote(contentNode.content);

          let sourceMapNode = sourceMapConsumer.originalPositionFor({
            line: nodeStartLine,
            column: nodeStartColumn
          });

          if (sourceMapNode && sourceMapNode.source) {
            let url = Url.parse(contentNodeContent);

            if (!url.host && !path.isAbsolute(contentNodeContent)) {
              contentNode.content = path.join(path.dirname(sourceMapNode.source), contentNodeContent);

              self.emit('rebase', contentNode.content);
            }
          }
        });
      }

      self.push(parseTree.toString());

      callback();
    }
    catch (err) {
      callback(err);
    }
  }
}

module.exports = Rebaser;