import React from "react";
import { createRoot } from "react-dom/client";
import InceptionApex from "../src/components/InceptionApex.jsx";
import { cleanProjectData } from "../src/lib/inceptionProject.mjs";
import "../src/styles.css";
const event = {
  id: "synthetic-event",
  organization_id: "synthetic-hangar",
  master_event_id: "synthetic-master",
  name: "Community Dinner",
  course: "Chapel Hill Golf Course",
  event_dates: ["2027-06-12"],
  status: "draft",
  public_slug: "community-dinner",
  field_settings: {
    hub_description: "Dinner, music and community.",
    event_start_time: "17:30",
  },
};
const key = "inception-synthetic-projects";
window.inceptionFixture = { conflict: false, delay: 0, attached: [] };
const rows = () => JSON.parse(sessionStorage.getItem(key) || "[]");
const store = {
  list: async () => rows(),
  events: async () => [event],
  read: async (id) => rows().find((p) => p.id === id),
  async save(project, status) {
    if (window.inceptionFixture.delay)
      await new Promise((r) => setTimeout(r, window.inceptionFixture.delay));
    const all = rows(),
      current = all.find((p) => p.id === project.id);
    if (
      window.inceptionFixture.conflict ||
      (current?.version || 0) !== project.version
    )
      throw new Error(
        "Someone saved a newer version. Download your changes, then reopen the project.",
      );
    const saved = {
      ...project,
      data: cleanProjectData(project.data),
      status,
      version: project.version + 1,
      updated_at: new Date().toISOString(),
      organization_id: project.event_id ? event.organization_id : null,
      master_event_id: project.event_id ? event.master_event_id : null,
    };
    sessionStorage.setItem(
      key,
      JSON.stringify([saved, ...all.filter((p) => p.id !== project.id)]),
    );
    return saved;
  },
  async attach(project) {
    window.inceptionFixture.attached.push({
      id: project.id,
      version: project.version,
    });
    return { packet_version: 3 };
  },
};
createRoot(document.getElementById("root")).render(
  <InceptionApex
    store={store}
    canUseResizer={new URLSearchParams(location.search).get("eig") === "1"}
  />,
);
