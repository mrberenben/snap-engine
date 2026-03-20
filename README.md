# Scroll Snap Engine

A high-performance, virtualized scroll snapping engine for modern web and mobile apps.

## Features

- Momentum-aware snapping
- Virtualization-compatible
- Framework-agnostic core
- React integration via hooks
- 60fps animation loop
- Built-in virtualized list / adapter for react-virtuoso & tanstack/virtual
- Works with native scroll + momentum

## Packages

- `@snap-engine/core` → logic engine
- `@snap-engine/dom` → browser adapters
- `@snap-engine/react` → context, components, hooks

## Build Target Supports

- ESM (modern bundlers)
- CJS (Node compatibility)
- Types (TypeScript)

## Example

```tsx
const { containerRef } = useSnapScroll();

return (
  <div ref={containerRef}>
    {items.map((_, i) => (
      <SnapItem index={i} />
    ))}
  </div>
);
```
