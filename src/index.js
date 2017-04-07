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

      let shouldBeRebased = function(uri) {
        if (path.isAbsolute(uri)) {
          return false;
        }

        let url = Url.parse(uri);

        // if the url consists of only a hash, it is a reference to an id
        if (url.hash) {
          if (!url.path) {
            return false;
          }
        }

        // if the url host is set, it is a remote uri
        if (url.host) {
          return false;
        }

        return true;
      };

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
            if (shouldBeRebased(contentNodeContent)) {
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