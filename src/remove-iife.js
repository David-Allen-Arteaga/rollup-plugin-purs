"use strict";


// TODO code duplication
function canInlineParams(params) {
  return params.every(function (x) {
    return x !== null;
  });
}


// TODO code duplication
function canInlineFunction(node) {
  // TODO allow for the id, as long as it's not called ?
  return node.id === null &&
         node.body.body.length === 1 &&
         node.body.body[0].type === "ReturnStatement";
}


// TODO loc
var _void = {
  type: "UnaryExpression",
  operator: "void",
  argument: {
    type: "NumericLiteral",
    value: 0
  },
  prefix: true
};


var inlineVisitor = {
  ReferencedIdentifier: function (path, state) {
    var node = path.node;

    var binding = path.scope.getBinding(node.name);

    if (binding != null) {
      // TODO make this faster
      var index = state.params.indexOf(binding);

      if (index !== -1) {
        if (index < state.arguments.length) {
          path.replaceWith(state.arguments[index]);

        } else {
          path.replaceWith(_void);
        }
      }
    }
  }
};


module.exports = function (babel) {
  return {
    pre: function () {
      this.removed = 0;
      this.unremoved = 0;
    },
    post: function () {
      if (this.opts.debug) {
        // TODO does this go to stdout or stderr ?
        console.info("");
        console.info("* Debug IIFE");
        console.info(" * Removed: " + this.removed);
        console.info(" * Not removed: " + this.unremoved);
      }
    },
    visitor: {
      CallExpression: function (path, state) {
        var node = path.node;

        var callee = node.callee;

        if (callee.type === "FunctionExpression") {
          // TODO is this correct ?
          var subPath = path.get("callee");

          var params = callee.params.map(function (x) {
            if (x.type === "Identifier") {
              var binding = subPath.scope.getBinding(x.name);

              console.assert(binding != null);

              // Only inline if each argument is used at most once
              if (binding.constant && binding.references <= 1) {
                return binding;

              } else {
                return null;
              }

            } else {
              return null;
            }
          });

          if (canInlineFunction(callee) && canInlineParams(params)) {
            ++this.removed;

            // TODO what about unused arguments ?
            subPath.traverse(inlineVisitor, {
              params: params,
              arguments: node.arguments
            });

            path.replaceWith(callee.body.body[0].argument);

          } else {
            ++this.unremoved;
          }
        }
      }
    }
  };
};
