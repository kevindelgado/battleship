# BUGS.md

## Bugs encountered during development

_(No bugs recorded yet — entries will be added as they are encountered during testing.)_

## Known limitations / deliberate scope simplifications

### Hard AI target-mode multi-ship adjacency heuristic

The Hard AI's target-mode rule requires that a consistent placement covers **at least one** unresolved hit. This is correct when all unresolved hits belong to a single ship (the common case). When two adjacent or interleaved ships are partially struck before either sinks, this heuristic can be slightly suboptimal compared to the strict rule requiring every consistent fleet-wide placement to collectively cover **all** unresolved hits across multiple ships simultaneously. The strict version requires materially more code and enumeration cost for a rare regime. v1 ships the simpler rule deliberately.

### Sunk-ship visual is per-cell fill only

v1 renders sunk ships by changing each cell's fill to `--accent-deep`. No single outline is drawn around the entire ship footprint (which would require SVG overlay or computed per-edge borders). This is a noted nice-to-have, not built in v1.

### Touch device placement UX

Hover preview does not exist on touch devices. Touch users get a two-tap flow (tap to preview, tap again to commit). Acceptable for v1.
