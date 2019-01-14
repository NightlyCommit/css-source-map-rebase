const path = require('path');
const {Transform} = require('stream');
const {parse} = require('url');
const {SourceMapConsumer} = require('source-map');
const {fromSource} = require('convert-source-map');
const csstree = require('css-tree');

let regExp = /[\'\"]/;

/**
 * @param {string} string
 * @returns {{quote: string, value: string}}
 */
const unquote = (string) => {
    let quote = '';

    if (regExp.test(string.charAt(0))) {
        quote = string.charAt(0);
        string = string.substr(1)
    }

    if (regExp.test(string.charAt(string.length - 1))) {
        string = string.substr(0, string.length - 1)
    }

    return {
        quote: quote,
        value: string
    };
};

exports.Rebaser = class extends Transform {
    constructor(options = {}) {
        super(options);

        this.options = options;
    }

    _transform(chunk, encoding, callback) {
        try {
            let originalCss = chunk.toString();

            let map = this.options.map;
            let rebase = this.options.rebase;

            // retrieve inline map
            if (!map) {
                let converter = fromSource(originalCss);

                if (converter) {
                    map = converter.toJSON();
                }
            }

            if (!map) {
                throw new Error('A map is required, either inline or explicitly passed as an option.');
            }

            let sourceMapConsumer = null;
            let nodesToRebase = [];

            sourceMapConsumer = new SourceMapConsumer(map);

            let ast = csstree.parse(originalCss, {
                filename: sourceMapConsumer.file,
                positions: true
            });

            csstree.walk(ast, (node, item, list) => {
                if (node.type === 'Url') {
                    let sourceMapNode = sourceMapConsumer.originalPositionFor({
                        line: node.loc.start.line,
                        column: node.loc.start.column - 1
                    });

                    const valueNode = node.value;

                    let valueAndQuote = unquote(valueNode.value);

                    let url = parse(valueAndQuote.value);

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

                                nodesToRebase.push({
                                    node: valueNode,
                                    url: url,
                                    rebasedUrl: rebasedUrl,
                                    resolvedUrl: resolvedUrl,
                                    quote: valueAndQuote.quote
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

                }
            });

            // actual rebasing
            let rebasedCss = '';
            let cursor = 0;

            for (let nodeToRebase of nodesToRebase) {
                let start = nodeToRebase.node.loc.start;
                let end = nodeToRebase.node.loc.end;

                rebasedCss += [
                    originalCss.substring(cursor, start.offset),
                    nodeToRebase.quote,
                    nodeToRebase.rebasedUrl.href,
                    nodeToRebase.quote
                ].join('');

                cursor = end.offset;

                this.emit('rebase', {
                    raw: nodeToRebase.url,
                    resolved: nodeToRebase.resolvedUrl,
                    rebased: nodeToRebase.rebasedUrl
                });
            }

            rebasedCss += originalCss.substring(cursor);

            this.push(rebasedCss);

            callback();
        } catch (err) {
            callback(err);
        }
    }
};