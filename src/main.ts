import { Plugin, ItemView, WorkspaceLeaf, TFile } from "obsidian";
import {
  DynamicTagSettingTab,
  DynamicTagSettings,
  DEFAULT_SETTINGS,
} from "./settings";
import { livePreviewPlugin, formatTagString } from "./tag-formatter";
import { injectWebFonts } from "./font-extractor";

export const VIEW_TYPE_DYNAMIC_TAGS = "dynamic-tags-sidebar";

export class DynamicTagsView extends ItemView {
  plugin: DynamicTags;

  constructor(leaf: WorkspaceLeaf, plugin: DynamicTags) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_DYNAMIC_TAGS;
  }

  getDisplayText(): string {
    return "Dynamic Tags";
  }

  getIcon(): string {
    return "tags";
  }

  async onOpen(): Promise<void> {
    this.updateView();

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.updateView())
    );
    this.registerEvent(
      this.app.metadataCache.on("changed", () => this.updateView())
    );
  }

  async onClose(): Promise<void> {}

  createCollapsibleHeader(
    container: HTMLElement,
    titleText: string,
    isSubHeader: boolean = false
  ): HTMLElement {
    const headerCls = isSubHeader ? "related-note-title" : "dynamic-sidebar-heading";
    const header = container.createEl(isSubHeader ? "div" : "h4", {
      text: titleText,
      cls: headerCls,
    });
    const contentDiv = container.createEl("div", {
      cls: "dynamic-tags-sidebar-section",
    });

    header.addEventListener("click", () => {
      header.classList.toggle("collapsed");
      contentDiv.classList.toggle("collapsed");
    });

    return contentDiv;
  }

  updateView(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      container.createEl("p", { text: "No active file.", cls: "text-muted" });
      return;
    }

    const cache = this.app.metadataCache.getFileCache(activeFile);
    let currentTags: string[] = [];
    if (cache && cache.tags) {
      currentTags = cache.tags.map((t) => t.tag);
    } else if (cache && cache.frontmatter && cache.frontmatter.tags) {
      const fmTags = Array.isArray(cache.frontmatter.tags)
        ? cache.frontmatter.tags
        : [cache.frontmatter.tags];
      currentTags = fmTags.map((t) =>
        String(t).startsWith("#") ? String(t) : `#${t}`
      );
    }

    const uniqueCurrentTags = [...new Set(currentTags)];

    const currentTagsDiv = this.createCollapsibleHeader(
      container,
      "Tags in Note"
    );

    if (uniqueCurrentTags.length === 0) {
      currentTagsDiv.createEl("span", {
        text: "No tags found.",
        cls: "text-muted",
      });
    } else {
      this.renderTagList(currentTagsDiv, uniqueCurrentTags);
    }

    container.createEl("hr", { cls: "dynamic-sidebar-divider" });

    const relatedTagsDiv = this.createCollapsibleHeader(
      container,
      "Related Tags"
    );

    if (uniqueCurrentTags.length === 0) {
      relatedTagsDiv.createEl("span", {
        text: "Add tags to see relations.",
        cls: "text-muted",
      });
      return;
    }

    const strictMode = this.plugin.settings.strictRelatedTags;
    const validPrefixes = uniqueCurrentTags.map((t) => {
      return strictMode ? t.toLowerCase() : t.split(/[\/\-]/)[0].toLowerCase();
    });

    const allFiles = this.app.vault.getMarkdownFiles();
    let foundRelated = false;

    allFiles.forEach((file: TFile) => {
      if (file.path === activeFile.path) return;

      const fileCache = this.app.metadataCache.getFileCache(file);
      if (!fileCache) return;

      let fileTags: string[] = [];
      if (fileCache.tags) fileTags.push(...fileCache.tags.map((t) => t.tag));
      if (fileCache.frontmatter && fileCache.frontmatter.tags) {
        const fmTags = Array.isArray(fileCache.frontmatter.tags)
          ? fileCache.frontmatter.tags
          : [fileCache.frontmatter.tags];
        fileTags.push(
          ...fmTags.map((t) => (String(t).startsWith("#") ? String(t) : `#${t}`))
        );
      }

      fileTags = [...new Set(fileTags)];

      const matchedTags = fileTags.filter((tag) => {
        const tagLower = tag.toLowerCase();
        const tagBase = tag.split(/[\/\-]/)[0].toLowerCase();

        const isRelated = strictMode
          ? validPrefixes.some((p) => tagLower.startsWith(p))
          : validPrefixes.includes(tagBase);

        return isRelated && !uniqueCurrentTags.includes(tag);
      });

      if (matchedTags.length > 0) {
        foundRelated = true;
        const noteGroupDiv = relatedTagsDiv.createEl("div", {
          cls: "related-note-group",
        });
        const noteTagsContainer = this.createCollapsibleHeader(
          noteGroupDiv,
          file.basename,
          true
        );
        this.renderTagList(noteTagsContainer, matchedTags);
      }
    });

    if (!foundRelated) {
      relatedTagsDiv.createEl("span", {
        text: "No related tags in vault.",
        cls: "text-muted",
      });
    }
  }

  renderTagList(container: HTMLElement, tagArray: string[]): void {
    tagArray.forEach((tagString) => {
      const tagEl = container.createEl("a", {
        cls: "tag",
        text: tagString,
        href: tagString,
      });

      const priorityMatch = tagString.match(
        /^#(High|Medium|Mid|Low|Pending|In-progress|Submitted|In-review|Success|Failed|Expired|Re-schedule)[\/\-](.+)$/i
      );
      if (priorityMatch) {
        tagEl.setAttribute(
          "data-dynamic-text",
          formatTagString(priorityMatch[2])
        );
      } else {
        const rawText = tagString.replace(/^#/, "");
        tagEl.setAttribute("data-dynamic-text", formatTagString(rawText));
      }

      tagEl.addEventListener("click", (e) => {
        e.preventDefault();
        const searchPlugin = (this.app as any).internalPlugins.getPluginById(
          "global-search"
        );
        if (searchPlugin && searchPlugin.instance) {
          searchPlugin.instance.openGlobalSearch(`tag:${tagString}`);
        }
      });
    });
  }
}

export default class DynamicTags extends Plugin {
  settings!: DynamicTagSettings;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new DynamicTagSettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE_DYNAMIC_TAGS,
      (leaf) => new DynamicTagsView(leaf, this)
    );

    this.addRibbonIcon("tags", "Dynamic Tags Sidebar", () => {
      this.activateSidebar();
    });

    this.addCommand({
      id: "open-dynamic-tags-sidebar",
      name: "Open Dynamic Tags Sidebar",
      callback: () => {
        this.activateSidebar();
      },
    });

    injectWebFonts(this.settings.customFontUrl);
    this.updateStyle();

    this.registerMarkdownPostProcessor((element, _context) => {
      const tags = element.querySelectorAll<HTMLAnchorElement>("a.tag");
      tags.forEach((tag) => {
        let tagRef = tag.getAttribute("href");
        if (!tagRef) tagRef = tag.textContent || "";
        try {
          tagRef = decodeURIComponent(tagRef);
        } catch (e) {}

        const priorityMatch = tagRef.match(
          /^#(High|Medium|Mid|Low|Pending|In-progress|Submitted|In-review|Success|Failed|Expired|Re-schedule)[\/\-](.+)$/i
        );

        if (priorityMatch) {
          tag.setAttribute(
            "data-dynamic-text",
            formatTagString(priorityMatch[2])
          );
        } else {
          const rawText = tagRef.replace(/^#/, "");
          tag.setAttribute("data-dynamic-text", formatTagString(rawText));
        }
      });
    });

    this.registerEditorExtension(livePreviewPlugin);
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_DYNAMIC_TAGS);
  }

  async activateSidebar(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_DYNAMIC_TAGS)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: VIEW_TYPE_DYNAMIC_TAGS,
          active: true,
        });
        leaf = rightLeaf;
      }
    }
    workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  updateStyle(): void {
    const body = document.body.style;
    body.setProperty(
      "--dynamic-tag-bg",
      this.settings.defaultTagColor || "rgba(255, 255, 255, 0.1)"
    );
    body.setProperty(
      "--dynamic-tag-color",
      this.settings.textColor || "inherit"
    );
    body.setProperty(
      "--dynamic-tag-font",
      this.settings.fontFamily || "inherit"
    );
    body.setProperty(
      "--dynamic-tag-weight",
      this.settings.isBold ? "bold" : "normal"
    );
    body.setProperty(
      "--dynamic-tag-style",
      this.settings.isItalic ? "italic" : "normal"
    );
    body.setProperty(
      "--dynamic-tag-decoration",
      this.settings.isUnderline ? "underline" : "none"
    );
    body.setProperty("--tag-size", "13px");
  }
}