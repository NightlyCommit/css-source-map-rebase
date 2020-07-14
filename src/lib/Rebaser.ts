import {isAbsolute, posix, dirname, relative} from "path";
import {parse, Url, fileURLToPath} from "url";
import {SourceMapConsumer, SourceNode} from "source-map";
import {fromSource} from "convert-source-map";
import {EventEmitter} from "events";

export type Result = {
  css: Buffer,
  map: Buffer
};

export type RebaseHandlerCallback =
/**
 * @param rebasedPath The rebased path of the asset. When `false`, the asset will not be rebased. When either `null` or `undefined`, the asset will be rebased using the default rebasing logic. When a `string`, the asset will be rebased to that string.
 */
  (rebasedPath?: false | null | string) => void;

export type RebaseHandler =
/**
 * @param source The source file where the asset was encountered.
 * @param resolvedPath The resolved path of the asset - i.e. the path of the asset relative to the source file.
 * @param done The callback function to invoke on completion.
 */
  (source: string, resolvedPath: string, done: RebaseHandlerCallback) => void;

export type Options = {
  /**
   * The source map that should be used to resolve the assets. Takes precedence over the embedded source map of the stylesheet.
   */
  map?: Buffer,
  /**
   * The handler invoked to resolve the rebased path of the asset. Takes precedence over the default rebasing logic.
   */
  rebase?: RebaseHandler
};

export interface Rebaser {
  on(event: "rebase", listener: (rebasedPath: string, resolvedPath: string) => void): this;

  /**
   * Emitted whenever an asset is rebased.
   *
   * @param event
   * @param rebasedPath The rebased path of the asset.
   * @param resolvedPath The resolved path of the asset.
   * @event
   */
  emit(event: "rebase", rebasedPath: string, resolvedPath: string): boolean;
}

export class Rebaser extends EventEmitter {
  private readonly _options: Options;

  constructor(options: Options = {}) {
    super();

    this._options = options;
  }

  /**
   * @param css The stylesheet whose assets need to be rebased.
   */
  rebase(css: Buffer): Promise<Result> {
    const isRebasable: (url: Url) => boolean = (url) => {
      return !isAbsolute(url.href) && (url.host === null) && ((url.hash === null) || (url.path !== null));
    };

    type UrlToRebase = {
      sourceMapNode: SourceNode,
      originalPath: string,
      rebasedPath: string,
      resolvedPath: string
    };

    return new Promise((resolve, reject) => {
      try {
        let originalCss = css.toString();

        let map = this._options.map;
        let rebase = this._options.rebase;

        // retrieve inline map
        if (!map) {
          let converter = fromSource(originalCss);

          if (converter) {
            map = Buffer.from(converter.toJSON());
          }
        }

        if (!map) {
          throw new Error("A map is required, either inline or explicitly passed as an option.");
        }

        let urlsToRebase: Array<UrlToRebase> = [];
        let urlRegExp: RegExp = /url\('(.*?)'\)|url\("(.*?)"\)|url\((.*?)\)/mg;

        new SourceMapConsumer(map.toString()).then((consumer) => {
          let sourceMapNode = SourceNode.fromStringWithSourceMap(originalCss, consumer);

          const handleNode = (node: SourceNode) => {
            if (node.children) {
              for (let child of node.children) {
                if (typeof child === 'string') {
                  let match: RegExpExecArray;

                  while ((match = urlRegExp.exec(child)) != null) {
                    let urlStr: string = match[1] || match[2] || match[3];
                    let url: Url = parse(urlStr);

                    if (isRebasable(url)) {
                      let nodeSourceUrl = parse(node.source);

                      let nodeSource: string;

                      if (nodeSourceUrl.protocol === 'file:') {
                        nodeSource = fileURLToPath(node.source);
                      } else {
                        nodeSource = node.source;
                      }

                      nodeSource = relative('.', nodeSource);

                      let resolvedPath = posix.join(dirname(nodeSource), url.pathname);

                      const done: RebaseHandlerCallback = (rebasedPath) => {
                        if (rebasedPath !== false) {
                          if (!rebasedPath) { // default rebasing
                            rebasedPath = resolvedPath;
                          }

                          urlsToRebase.push({
                            sourceMapNode: node,
                            originalPath: urlStr,
                            rebasedPath: rebasedPath,
                            resolvedPath: resolvedPath
                          })
                          ;
                        }
                      };

                      if (!rebase) {
                        rebase = (node, path, done) => {
                          done();
                        };
                      }

                      rebase(nodeSource, resolvedPath, done);
                    }
                  }
                }

                handleNode(child);
              }
            }
          };

          handleNode(sourceMapNode);

          for (let urlToRebase of urlsToRebase) {
            urlToRebase.sourceMapNode.replaceRight(urlToRebase.originalPath, urlToRebase.rebasedPath);

            this.emit("rebase", urlToRebase.rebasedPath, urlToRebase.resolvedPath);
          }

          let codeWithSourceMap = sourceMapNode.toStringWithSourceMap();

          resolve({
            css: Buffer.from(codeWithSourceMap.code),
            map: Buffer.from(codeWithSourceMap.map.toString())
          })
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}