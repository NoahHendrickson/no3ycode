import { defineRule, type ESTree } from "@oxlint/plugins";

const MESSAGE =
  "A worklet's default parameter runs before the UI runtime unpacks its closure, so a captured name in it throws in Release. Pass the value from the caller.";

type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression;

function isWorklet(node: FunctionNode): boolean {
  const body = node.body;
  if (body === null || body.type !== "BlockStatement") return false;
  return body.body.some(
    (statement: ESTree.Statement) =>
      statement.type === "ExpressionStatement" && statement.directive === "worklet",
  );
}

function defaults(pattern: ESTree.Node | null): ESTree.Node[] {
  if (pattern === null) return [];
  switch (pattern.type) {
    case "AssignmentPattern":
      return [pattern, ...defaults(pattern.left)];
    case "ObjectPattern":
      return pattern.properties.flatMap((property) =>
        defaults(property.type === "RestElement" ? property.argument : property.value),
      );
    case "ArrayPattern":
      return pattern.elements.flatMap(defaults);
    case "RestElement":
      return defaults(pattern.argument);
    case "TSParameterProperty":
      return defaults(pattern.parameter);
    default:
      return [];
  }
}

export default defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow default parameters in Reanimated worklets." },
  },
  create(context) {
    function check(node: FunctionNode) {
      if (!isWorklet(node)) return;
      for (const found of node.params.flatMap(defaults))
        context.report({ node: found, message: MESSAGE });
    }
    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    };
  },
});
