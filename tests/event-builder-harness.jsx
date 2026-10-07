import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import EventPacketStudio from "../src/components/EventPacketStudio.jsx";
import "../src/styles.css";
const event = {
  id: "synthetic-event",
  organization_id: "synthetic-hangar",
  master_event_id: "synthetic-master",
  name: "Community Dinner",
  course: "Chapel Hill Golf Course",
  event_dates: ["2027-06-12"],
  public_slug: "community-dinner",
  status: "draft",
  field_settings: {
    event_kind: "general",
    event_start_time: "17:30",
    max_golfers: 80,
    hub_description: "Dinner, music and community.",
    hub_venue_address: "Synthetic venue address",
    registration_contact_email: "organizer@example.test",
  },
};
window.packetFixture = { calls: [], delay: 0, conflict: false };
const key = "event-builder-synthetic-fixture";
async function read() {
  return JSON.parse(sessionStorage.getItem(key) || "null");
}
async function save(id, version, data) {
  const f = window.packetFixture;
  f.calls.push({ id, version, data });
  if (f.delay) await new Promise((r) => setTimeout(r, f.delay));
  const current = await read();
  if (f.conflict || (current?.version || 0) !== version)
    throw new Error(
      "Someone saved newer event packet changes. Reload before editing.",
    );
  const row = { version: version + 1, data };
  sessionStorage.setItem(key, JSON.stringify(row));
  return row;
}
function App() {
  const [regular, setRegular] = useState(true);
  return (
    <main className="platform-page">
      <h1>Synthetic event builder check</h1>
      <button onClick={() => setRegular(!regular)}>
        Switch fixture event kind
      </button>
      <EventPacketStudio
        key={regular ? "general" : "golf"}
        event={{
          ...event,
          field_settings: {
            ...event.field_settings,
            event_kind: regular ? "general" : "golf",
          },
        }}
        read={read}
        save={save}
      />
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
