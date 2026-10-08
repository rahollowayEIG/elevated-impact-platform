import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import EventBudget from "../src/components/EventBudget.jsx";
import "../src/styles.css";
const event = {
  id: "40000000-0000-0000-0000-000000000001",
  name: "Community Golf Outing",
};
function App() {
  const [tab, setTab] = useState("budget"),
    [dirty, setDirty] = useState(false);
  return (
    <main className="platform-page">
      <h1>{event.name}</h1>
      <nav>
        <button
          onClick={() => {
            if (!dirty || window.confirm("Leave unsaved budget?"))
              setTab("directory");
          }}
        >
          Event directory
        </button>
        <button onClick={() => setTab("budget")}>Budget</button>
      </nav>
      {tab === "budget" ? (
        <EventBudget
          event={event}
          onDirtyChange={setDirty}
          onOpenSponsors={() => setTab("sponsors")}
          onOpenRoster={() => setTab("roster")}
        />
      ) : (
        <p>{tab} opened</p>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
