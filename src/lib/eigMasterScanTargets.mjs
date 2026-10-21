// Presentation options for the existing, server-allowlisted Master Scanner.
// Keep this list in sync with MODULES in server/eig-master-source-scan.cjs.
// UI selection NEVER grants scanner access or enables arbitrary source targets.
export const MASTER_SCAN_TARGETS = Object.freeze([
  {id:"event-builder",label:"Event Builder"},
  {id:"registration",label:"Team Registration & Main Cabin"},
  {id:"payments",label:"Team Payments & Split Payments"},
  {id:"roster",label:"Roster & Team Maintenance"},
  {id:"accounts",label:"Accounts & Permissions"},
  {id:"squawk",label:"Squawk Box Communications"},
  {id:"sponsors",label:"Sponsor Management"},
  {id:"event-packet",label:"Creative Event Packets"},
  {id:"event-budget",label:"Event Budget"},
  {id:"inception",label:"InceptionApex Creative Studio"},
  {id:"social",label:"Social Media & Ads"},
  {id:"build-lab",label:"Build Lab"},
  {id:"maps",label:"Course Maps & Flyovers"},
  {id:"invoices",label:"Universal Invoicing"},
  {id:"product-registry",label:"Product Capture & Inventory Double Sync"},
  {id:"contracts",label:"Event Contracts"},
]);
