# @lgrammel/open-meteo-tool

## 0.4.1

### Patch Changes

- 4e624a3: Update AI SDK peer dependencies to `^7.0.4`.

## 0.4.0

### Minor Changes

- d179e1e: Remove the bundled `units` weather context setting and expose Open-Meteo's `temperatureUnit`, `windSpeedUnit`, and `precipitationUnit` settings individually.

## 0.3.1

### Patch Changes

- d7473f1: Update AI SDK peer dependencies to `^7.0.0-canary.139`.
- d7473f1: Make the weather tool context optional and default omitted units to metric.

## 0.3.0

### Minor Changes

- 6ecfb80: Simplify weather context unit configuration to a single `units` setting that maps internally to Open-Meteo temperature, precipitation, and wind speed units.

## 0.2.1

### Patch Changes

- e512416: Fix AI SDK `toolsContext` typing for the weather tool by making `temperatureUnit` the required context key, and add Vitest type tests for `ToolLoopAgent` context inference.

## 0.2.0

### Minor Changes

- 5583502: Replace the separate location search and forecast tools with a single `weather` tool that resolves a place name and fetches the forecast in one call.
