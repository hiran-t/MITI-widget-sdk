// @miti/sdk only describes what MITI gives widgets (index.d.ts). A widget built with
// `miti-widget build` reads these from MITI at run time, so nothing here runs inside MITI.
throw new Error(
  '@miti/sdk runs inside MITI: build the widget with `miti-widget build` and import the ' +
    '.miti-widget file into MITI'
);
