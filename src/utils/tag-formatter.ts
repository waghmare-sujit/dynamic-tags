import { editorLivePreviewField } from "obsidian";
import {
  Decoration,
  ViewPlugin,
  MatchDecorator,
  DecorationSet,
  EditorView,
  ViewUpdate,
} from "@codemirror/view";

/**
 * Converts hyphenated tag strings into readable title-case.
 * e.g. "personal-development" → "Personal Development"
 */
export function formatTagString(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const prefixMatcher = new MatchDecorator({
  regexp: /#(High|Medium|Mid|Low|Pending|In-progress|Submitted|In-review|Success|Failed|Expired|Re-schedule)[\/\-]/ig,
  decoration: () => Decoration.replace({}),
});

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.state.field(editorLivePreviewField) !==
          update.startState.field(editorLivePreviewField)
      ) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      return view.state.field(editorLivePreviewField)
        ? prefixMatcher.createDeco(view)
        : Decoration.none;
    }
  },
  { decorations: (v) => v.decorations }
);
