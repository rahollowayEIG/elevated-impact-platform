import React from "react";
import { createRoot } from "react-dom/client";
import EigBuildLab from "../src/components/EigBuildLab.jsx";
import "../src/styles.css";

window.buildLabHarness = { navigations: 0, dirty: false };
createRoot(document.getElementById("root")).render(
  <EigBuildLab
    onBack={() => { window.buildLabHarness.navigations += 1; }}
    onDirtyChange={(dirty) => { window.buildLabHarness.dirty = dirty; }}
  />,
);
