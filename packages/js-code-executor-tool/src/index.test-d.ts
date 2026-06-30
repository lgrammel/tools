import { expectTypeOf } from "vitest";
import { jsCodeExecutorTool, type JsCodeExecutorContext } from "./index.js";

expectTypeOf<{
  userId: string;
  limits: {
    maxRows: number;
  };
}>().toMatchTypeOf<JsCodeExecutorContext>();

expectTypeOf(
  jsCodeExecutorTool({
    context: {
      userId: "user_123",
    },
  }),
).toBeObject();

jsCodeExecutorTool({
  context: {
    // @ts-expect-error Context values must be structured-cloneable data, not functions.
    callback: () => "nope",
  },
});
