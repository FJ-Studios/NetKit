// ShiNetKit — deprecated compatibility shim (NetKit name-restoration epic,
// 2026-07-20). The module was aberrantly renamed NetKit → ShiNetKit in
// v1.0.0 to dodge a collision with fuzzy-swift's forked NetKit; fuzzy now
// consumes NetKit directly, so the generic name is restored. `import
// ShiNetKit` keeps working for one deprecation cycle via this re-export;
// migrate to `import NetKit`. Removed in a future minor.
@_exported import NetKit

@available(*, deprecated, message: "ShiNetKit was a temporary rename — import NetKit instead. This shim is removed in a future release.")
public enum ShiNetKitDeprecation {}
