import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import EigBuildLab from "../src/components/EigBuildLab.jsx";
import "../src/styles.css";

const TEST_OWNER = "11111111-1111-4111-8111-111111111111";
window.buildLabHarness = { navigations: 0, dirty: false, ownerUserId: TEST_OWNER };

function TestHarness() {
  const [open, setOpen] = useState(true);
  const [ownerUserId, setOwnerUserId] = useState(TEST_OWNER);
  window.buildLabHarness.setOwner = (id) => {
    setOwnerUserId(id);
    window.buildLabHarness.ownerUserId = id;
  };
  return open
    ? <EigBuildLab
        key={ownerUserId}
        ownerUserId={ownerUserId}
        supabaseClient={{ auth: { getSession: async () => ({
          data: { session: { access_token: "synthetic-browser-test-token" } },
          error: null,
        }) } }}
        onBack={() => {
          window.buildLabHarness.navigations++;
          setOpen(false);
        }}
        onDirtyChange={(dirty) => { window.buildLabHarness.dirty = dirty; }}
      />
    : <main>
        <button type="button" onClick={() => setOpen(true)}>Return to Build Lab</button>
      </main>;
}
createRoot(document.getElementById("root")).render(<TestHarness />);
