# Out-of-scope notes

- `src/lib/widgets/*` keeps `10.5 px` labels on purpose: Android home-screen
  widgets render on fixed dp surfaces and cannot follow OS font scaling.
- `src/app/notes.tsx` still nests a `SectionList` inside the `ScreenShell`
  vertical `ScrollView` (with `maxHeight` + `nestedScrollEnabled`). React
  Native may warn about nested virtualized lists; changing that container is a
  list-performance concern outside FIX-07.
- The splash overlay no longer has a zoom step (only the native fade remains),
  so FIX-07's "gate splash zoom" item had no animation to gate.
