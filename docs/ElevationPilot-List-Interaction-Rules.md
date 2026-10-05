# ElevationPilot List Interaction Rules

These rules apply across ElevationPilot, EIG Command Center, Hangar, Cockpit, ATC, Airport, EIE tools, and future platform applications.

## 1. Searchable List Rule

When a page presents a meaningful collection of records and users may need to locate a specific item, provide a search control.

Examples include:

- rosters and participant lists
- people and user directories
- organizations and Hangars
- events and flights
- invitations and access assignments
- sponsors, vendors, volunteers, orders, tickets, messages, and other operational directories

Implementation expectations:

- Search the fields a user would reasonably use to identify the record, such as name, email, phone, identifier, team, status, or other visible business fields.
- Do not expose hidden, privileged, secret, or otherwise unauthorized data through search.
- Search should combine naturally with active tabs, filters, and sorting.
- The UI should show the number of matches and a useful empty state.
- Bulk actions and "select all visible" behavior must apply only to the currently visible filtered rows unless the UI explicitly says otherwise.
- Very small fixed lists, workflow step lists, or lists whose order itself carries meaning may omit search when it would add clutter without helping retrieval.

## 2. Sortable Field Rule

When a table or list has meaningful field or column headings, fields that have a sensible ordering should be sortable from the heading.

Implementation expectations:

- Clicking a sortable heading sorts by that field.
- Clicking the same heading again toggles ascending and descending order.
- The active sort field and direction must be visible.
- Use correct value semantics: numeric fields sort numerically, dates chronologically, and text case-insensitively with stable ordering.
- Use accessible table semantics, including `aria-sort` when applicable.
- Preserve the existing business/source order until the user chooses a sort unless a deliberate default sort is part of the workflow.
- Search, filters, tabs, and sorting should work together rather than reset one another unexpectedly.
- Fields that do not have a meaningful ordering, such as action-button columns, should not pretend to be sortable.
- For large server-paginated collections, sorting may be implemented server-side rather than loading the full dataset into the browser.

## Platform default

Searchability and sortable fields are now default considerations whenever a new list, directory, roster, or table is created or an existing one is materially revised. If either capability is intentionally omitted, the reason should be obvious from the workflow rather than accidental.
