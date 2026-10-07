import React from "react";
import { createRoot } from "react-dom/client";
import SocialMediaApp from "../src/components/SocialMediaApp.jsx";
import { cleanCampaignData } from "../src/lib/socialCampaign.mjs";
import "../src/styles.css";
const key = "social-synthetic-campaigns";
const rows = () => JSON.parse(sessionStorage.getItem(key) || "[]");
window.socialFixture = { conflict: false };
const store = {
  list: async () => rows(),
  events: async () => [{ id: "synthetic-event", name: "Community Dinner" }],
  async save(campaign, status) {
    const all = rows(),
      current = all.find((p) => p.id === campaign.id);
    if (
      window.socialFixture.conflict ||
      (current?.version || 0) !== campaign.version
    )
      throw new Error(
        "Someone saved a newer version. Download your changes, then reopen the campaign.",
      );
    const saved = {
      ...campaign,
      data: cleanCampaignData(campaign.data),
      status,
      version: campaign.version + 1,
      updated_at: new Date().toISOString(),
    };
    sessionStorage.setItem(
      key,
      JSON.stringify([saved, ...all.filter((p) => p.id !== campaign.id)]),
    );
    return saved;
  },
};
createRoot(document.getElementById("root")).render(
  <SocialMediaApp store={store} />,
);
