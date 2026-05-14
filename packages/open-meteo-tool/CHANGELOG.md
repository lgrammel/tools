# @lgrammel/open-meteo-tool

## 0.2.1

### Patch Changes

- e512416: Fix AI SDK `toolsContext` typing for the weather tool by making `temperatureUnit` the required context key, and add Vitest type tests for `ToolLoopAgent` context inference.

## 0.2.0

### Minor Changes

- 5583502: Replace the separate location search and forecast tools with a single `weather` tool that resolves a place name and fetches the forecast in one call.
