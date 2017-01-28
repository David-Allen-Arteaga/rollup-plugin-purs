"use strict";

var $babel = require("babel-core");
var $utils = require("rollup-pluginutils");
var $path = require("path");
var $fs = require("fs");

var $convert = require("./src/convert");
var $uncurry = require("./src/uncurry");
var $inline = require("./src/inline");
var $rename = require("./src/rename");
var $propagate = require("./src/propagate");


function pursPath(options, path) {
  // TODO should this use resolve ?
  return $path.resolve($path.join(options.outputDir, path, "index.js"));
}


var entryPath = "\0rollup-plugin-purs:entry-point";


module.exports = function (options) {
  if (options == null) {
    options = {};
  }

  if (options.outputDir == null) {
    options.outputDir = "output";
  }

  if (options.runMain == null) {
    options.runMain = true;
  }

  if (options.uncurry == null) {
    options.uncurry = true;
  }

  if (options.inline == null) {
    options.inline = true;
  }

  var filter = $utils.createFilter(options.include, options.exclude);

  var entry = null;

  return {
    name: "purs",

    // TODO hacky
    options: function (rollup) {
      if (options.runMain &&
          rollup.entry != null &&
          rollup.entry !== entryPath) {
        entry = rollup.entry;
        rollup.entry = entryPath;
      }
    },

    resolveId: function (filePath) {
      // TODO hacky
      if (filePath === entryPath) {
        return filePath;

      } else if ($path.extname(filePath) === ".purs") {
        // TODO hacky
        return new Promise(function (resolve, reject) {
          $fs.readFile(filePath, { encoding: "utf8" }, function (err, file) {
            if (err) {
              reject(err);

            } else {
              // TODO super hacky
              var a = /(?:^|\n|\r\n) *module +([^ ]+)/.exec(file);

              if (a) {
                resolve(pursPath(options, a[1]));

              } else {
                reject(new Error("Could not detect module name for file " + filePath));
              }
            }
          });
        });
      }
    },

    // TODO hacky
    // This creates a main entry point that calls the `main` function of the main PureScript module
    load: function (filePath) {
      if (filePath === entryPath) {
        // TODO better stringification for the path ?
        // TODO source maps for this ?
        return "import { main } from " + JSON.stringify(entry) + "; main();";
      }
    },

    transform: function (code, filePath) {
      // TODO better filtering ?
      if (!filter(filePath)) return;

      // TODO test if this optimization actually makes it faster or not
      if (!/exports|module|require/.test(code)) return;

      return $convert.call(this, code, filePath);
    },

    transformBundle: function (code) {
      var plugins = [];

      plugins.push($rename);

      plugins.push($propagate);

      /*plugins.push(function (babel) {
        return {
          visitor: {
            ReferencedIdentifier: {
              exit: function (path) {
                console.log(path.node.name, "1");
              }
            }
          }
        };
      });*/

      if (options.uncurry) {
        plugins.push($uncurry);
      }

      /*if (options.inline) {
        plugins.push($inline);
      }*/

      //plugins.push($deadCode);

      // TODO what about sourceRoot ?
      return $babel.transform(code, {
        babelrc: false,
        ast: false,
        // TODO is this correct ?
        filename: "\0rollup-plugin-purs:bundle",
        sourceMaps: true,
        plugins: plugins
      });
    }
  };
};
