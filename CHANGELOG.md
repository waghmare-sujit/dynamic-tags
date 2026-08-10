# Changelog

All notable changes to the **Dynamic Tags** Obsidian plugin are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.7.1.1] *(Patch)* 2026-06-07

### Bug Fix — DOM Focus Loop
A severe bug where the DOM focus loop caused collapsible sidebar menus to flicker repeatedly was fixed.

## [1.7.1] - 2026-06-05

### Collapsible Sidebar Sections
Tags in the sidebar are now grouped into collapsible sections per note, reducing visual clutter.

### Grouped by Note Title
Related tags are grouped under their parent note title for easier scanning.

### Strict Nesting Match Setting
A new settings toggle was added controlling whether partial tag path matches are included or only exact nesting paths qualify.

## [1.7.0] - 2026-06-05

### Dynamic Tags Sidebar — Excluded Paths
An "Excluded Paths" setting was added. Specific vault directories can be blacklisted from populating the Related Tags sidebar panel.

### Strict Related Tags Matching
A toggle was added to force exact nesting path matches in the Related Tags panel rather than loose base-word matching.

### Hide Tags Command
A `Hide tags from this note` command was introduced for quick one-tap exclusion of the currently active file from the sidebar.

---

## [1.6.2] - 2026-06-04

### Bug Fix — Empty Tag Pills on Re-render
A DOM lifecycle bug that caused tag pills to render empty after re-render cycles was fixed.

## [1.6.1] — 2026-06-03

### Bug Fix — Native Click-to-Search
Obsidian's native click-to-search behavior was broken by DOM string mutations. Tag label formatting was offloaded entirely to CSS pseudo-elements to restore native functionality without side effects.

## [1.6.0] — 2026-05-28

### Added new status tag `#Re-schedule` with color pill and inline icon.
- Re-schedule added to priority prefix regex — nested form `#Re-schedule/Task` strips prefix and formats correctly.
- `styles.css` updated: Re-schedule in `:not()` exclusion chain and base tag rules.

### Dynamic Tags Sidebar (ItemView)
A dedicated right-sidebar view was introduced, transforming the plugin from a pure text decorator into a navigation hub. The sidebar parses the active file on `file-open` events and displays two panels: Tags in Note (all tags from the current file) and Related Tags (tags co-occurring across the vault).

### Contextual Tagging Engine
A context engine was added that computes vault-wide tag relationships in real time whenever a new file is opened.

### Global Search Hook
Clicking any tag in the sidebar executes a native Obsidian global tag search, instantly filtering the file explorer to matching notes.

---

## [1.5.5] — 2026-05-28

### Added
- Official documentation for **Nested Status Tags**.
- Nested tags like `#Success/To-Do` now render as "To Do" inside their respective status color pills with icons.

## [1.5.0] — 2026-05-12

### Added
- 7 new status tags with Lucide icons:
  - `#Pending` (orange)
  - `#In-progress` (blue)
  - `#Submitted` (purple)
  - `#In-review` (yellow/olive)
  - `#Success` (green)
  - `#Failed` (dark red)
  - `#Expired` (grey)
- Each status tag ships with background color, border, and inline SVG icon.

### Fixed
- Plugin's universal `.tag` rule no longer overrides status tag styles.

## [1.4.1] — 2026-05-04

### Fixed
- URL extractor bug: plugin now safely rips the raw `css2` Google Fonts URL directly out of full HTML embed blocks or `@import` snippets.

## [1.4.0] — 2025-04-22

### Added
- Dynamic Google Fonts URL parser. Custom fonts automatically inject into the stylesheet and appear in the dropdown/preview list.

## [1.3.0] — 2026-04-10

### Added
- Font style modifiers: **bold**, *italic*, <u>underline</u>.
- Standard web-safe font selection with live UI preview.

## [1.2.0] — 2026-04-01

### Added
- Customizable background color and text color for standard tags.

### Fixed
- Isolated priority tag styling to prevent visual conflicts with themes.

## [1.1.0] — 2026-03-28

### Added
- Support for nested priority tags (e.g. `#high/work`).
- Dynamic string formatting (removed hyphens, injected spaces, title-cased words).

## [1.0.0] — 2026-03-25

### Added
- Initial release: base priority tags (`#high`, `#low`, `#mid`, `#medium`).
