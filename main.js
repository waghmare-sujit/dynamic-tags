const { Plugin, PluginSettingTab, Setting, editorLivePreviewField, ItemView, WorkspaceLeaf } = require('obsidian');
const { Decoration, ViewPlugin, MatchDecorator } = require('@codemirror/view');

const VIEW_TYPE_DYNAMIC_TAGS = "dynamic-tags-sidebar";

const DEFAULT_SETTINGS = {
    defaultTagColor: 'rgba(255, 255, 255, 0.1)',
    textColor: '',
    fontFamily: '',
    customFontUrl: '',
    customFonts: [],
    isBold: false,
    isItalic: false,
    isUnderline: false
};

function formatTagString(str) {
    return str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function extractCleanUrl(input) {
    if (!input) return '';
    const css2Match = input.match(/(https:\/\/fonts\.googleapis\.com\/css2\?[^"'\s\)]+)/);
    if (css2Match) {
        return css2Match[1].replace(/&amp;/g, '&');
    }
    return input.trim();
}

function extractGoogleFonts(cleanUrl) {
    if (!cleanUrl) return [];
    try {
        const url = new URL(cleanUrl);
        const families = url.searchParams.getAll('family');
        return families.map(f => {
            const name = f.split(':')[0].replace(/\+/g, ' ');
            return { name: name, css: `"${name}", sans-serif` };
        });
    } catch (e) {
        return []; 
    }
}

const prefixMatcher = new MatchDecorator({
    regexp: /#(High|Medium|Mid|Low|Pending|In-progress|Submitted|In-review|Success|Failed|Expired|Re-schedule)[\/\-]/ig,
    decoration: match => Decoration.replace({})
});

const livePreviewPlugin = ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = this.buildDecorations(view); }
    update(update) {
        if (update.docChanged || update.viewportChanged || update.state.field(editorLivePreviewField) !== update.startState.field(editorLivePreviewField)) {
            this.decorations = this.buildDecorations(update.view);
        }
    }
    buildDecorations(view) {
        return view.state.field(editorLivePreviewField) ? prefixMatcher.createDeco(view) : Decoration.none;
    }
}, { decorations: v => v.decorations });


// ── 1. CUSTOM SIDEBAR VIEW ──
class DynamicTagsView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_DYNAMIC_TAGS;
    }

    getDisplayText() {
        return "Dynamic Tags";
    }

    getIcon() {
        return "tags";
    }

    async onOpen() {
        this.updateView();
        
        // Listeners to update sidebar when switching notes or modifying metadata
        this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.updateView()));
        this.registerEvent(this.app.metadataCache.on('changed', () => this.updateView()));
    }

    async onClose() {
        // Cleanup if necessary
    }

    updateView() {
        const container = this.containerEl.children[1];
        container.empty();

        const file = this.app.workspace.getActiveFile();
        if (!file) {
            container.createEl("p", { text: "No active file.", cls: "text-muted" });
            return;
        }

        // Fetch tags from active file cache
        const cache = this.app.metadataCache.getFileCache(file);
        let currentTags = [];
        if (cache && cache.tags) {
            currentTags = cache.tags.map(t => t.tag);
        } else if (cache && cache.frontmatter && cache.frontmatter.tags) {
            // Also grab YAML frontmatter tags
            const fmTags = Array.isArray(cache.frontmatter.tags) ? cache.frontmatter.tags : [cache.frontmatter.tags];
            currentTags = fmTags.map(t => String(t).startsWith('#') ? String(t) : `#${t}`);
        }
        
        const uniqueCurrentTags = [...new Set(currentTags)];

        // ── SECTION 1: TAGS IN CURRENT NOTE ──
        container.createEl("h4", { text: "Tags in Note", cls: "dynamic-sidebar-heading" });
        const currentTagsDiv = container.createEl("div", { cls: "dynamic-tags-sidebar-section" });
        
        if (uniqueCurrentTags.length === 0) {
            currentTagsDiv.createEl("span", { text: "No tags found.", cls: "text-muted" });
        } else {
            this.renderTagList(currentTagsDiv, uniqueCurrentTags);
        }

        container.createEl("hr", { cls: "dynamic-sidebar-divider" });

        // ── SECTION 2: RELATED TAGS ──
        container.createEl("h4", { text: "Related Tags", cls: "dynamic-sidebar-heading" });
        const relatedTagsDiv = container.createEl("div", { cls: "dynamic-tags-sidebar-section" });

        if (uniqueCurrentTags.length === 0) {
            relatedTagsDiv.createEl("span", { text: "Add tags to see relations.", cls: "text-muted" });
        } else {
            // Get base prefixes (e.g., "#Success" from "#Success/To-Do")
            const basePrefixes = uniqueCurrentTags.map(t => t.split(/[\/\-]/)[0].toLowerCase());
            
            // Get all tags in the entire vault
            const allTagsRecord = this.app.metadataCache.getTags();
            const allVaultTags = Object.keys(allTagsRecord);

            // Filter for tags that share the base prefix but aren't in the current note
            const relatedTags = allVaultTags.filter(vaultTag => {
                const vaultTagPrefix = vaultTag.split(/[\/\-]/)[0].toLowerCase();
                return basePrefixes.includes(vaultTagPrefix) && !uniqueCurrentTags.includes(vaultTag);
            });

            if (relatedTags.length === 0) {
                relatedTagsDiv.createEl("span", { text: "No related tags in vault.", cls: "text-muted" });
            } else {
                this.renderTagList(relatedTagsDiv, relatedTags);
            }
        }
    }

    // Helper function to build the tag UI identically to Reading View
    renderTagList(container, tagArray) {
        tagArray.forEach(tagString => {
            const tagEl = container.createEl("a", { cls: "tag", text: tagString, href: tagString });
            
            // Replicate the formatting logic
            const priorityMatch = tagString.match(/^#(High|Medium|Mid|Low|Pending|In-progress|Submitted|In-review|Success|Failed|Expired|Re-schedule)[\/\-](.+)$/i);
            if (priorityMatch) {
                tagEl.setAttribute('data-dynamic-text', formatTagString(priorityMatch[2]));
            } else {
                const rawText = tagString.replace(/^#/, '');
                tagEl.setAttribute('data-dynamic-text', formatTagString(rawText));
            }

            // Route clicks to native Obsidian global search
            tagEl.addEventListener('click', (e) => {
                e.preventDefault();
                // Accessing internal global search plugin API
                const searchPlugin = this.app.internalPlugins.getPluginById('global-search');
                if (searchPlugin && searchPlugin.instance) {
                    searchPlugin.instance.openGlobalSearch(`tag:${tagString}`);
                }
            });
        });
    }
}


// ── 2. MAIN PLUGIN CLASS ──
class DynamicPriorityTags extends Plugin {
    async onload() {
        await this.loadSettings();
        this.addSettingTab(new DynamicTagSettingTab(this.app, this));
        
        // Register the new custom View
        this.registerView(VIEW_TYPE_DYNAMIC_TAGS, (leaf) => new DynamicTagsView(leaf, this));

        // Add Ribbon Icon and Command to toggle the sidebar
        this.addRibbonIcon('tags', 'Dynamic Tags Sidebar', () => {
            this.activateSidebar();
        });

        this.addCommand({
            id: 'open-dynamic-tags-sidebar',
            name: 'Open Dynamic Tags Sidebar',
            callback: () => {
                this.activateSidebar();
            }
        });

        this.injectWebFonts();
        this.updateStyle();

        this.registerMarkdownPostProcessor((element, context) => {
            const tags = element.querySelectorAll("a.tag");
            tags.forEach(tag => {
                let tagRef = tag.getAttribute("href");
                if (!tagRef) tagRef = tag.textContent || "";
                try { tagRef = decodeURIComponent(tagRef); } catch (e) {}

                const priorityMatch = tagRef.match(/^#(High|Medium|Mid|Low|Pending|In-progress|Submitted|In-review|Success|Failed|Expired|Re-schedule)[\/\-](.+)$/i);
                
                if (priorityMatch) {
                    tag.setAttribute('data-dynamic-text', formatTagString(priorityMatch[2]));
                } else {
                    const rawText = tagRef.replace(/^#/, '');
                    tag.setAttribute('data-dynamic-text', formatTagString(rawText));
                }
            });
        });

        this.registerEditorExtension(livePreviewPlugin);
    }

    onunload() {
        // Clean up the workspace leaf on plugin unload
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_DYNAMIC_TAGS);
    }

    async activateSidebar() {
        const { workspace } = this.app;
        
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_DYNAMIC_TAGS)[0];
        if (!leaf) {
            const rightLeaf = workspace.getRightLeaf(false);
            await rightLeaf.setViewState({ type: VIEW_TYPE_DYNAMIC_TAGS, active: true });
            leaf = rightLeaf;
        }
        workspace.revealLeaf(leaf);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    injectWebFonts() {
        if (!document.getElementById('dynamic-tags-google-fonts')) {
            const link = document.createElement('link');
            link.id = 'dynamic-tags-google-fonts';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,700;1,400&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Montserrat:ital,wght@0,400;0,700;1,400&family=Open+Sans:ital,wght@0,400;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Roboto:ital,wght@0,400;0,700;1,400&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap';
            document.head.appendChild(link);
        }

        let customLink = document.getElementById('dynamic-tags-custom-fonts');
        if (this.settings.customFontUrl) {
            if (!customLink) {
                customLink = document.createElement('link');
                customLink.id = 'dynamic-tags-custom-fonts';
                customLink.rel = 'stylesheet';
                document.head.appendChild(customLink);
            }
            customLink.href = this.settings.customFontUrl;
        } else if (customLink) {
            customLink.remove();
        }
    }

    updateStyle() {
        const body = document.body.style;
        body.setProperty('--dynamic-tag-bg', this.settings.defaultTagColor || 'rgba(255, 255, 255, 0.1)');
        body.setProperty('--dynamic-tag-color', this.settings.textColor || 'inherit');
        body.setProperty('--dynamic-tag-font', this.settings.fontFamily || 'inherit');
        body.setProperty('--dynamic-tag-weight', this.settings.isBold ? 'bold' : 'normal');
        body.setProperty('--dynamic-tag-style', this.settings.isItalic ? 'italic' : 'normal');
        body.setProperty('--dynamic-tag-decoration', this.settings.isUnderline ? 'underline' : 'none');
        body.setProperty('--tag-size', '13px');
    }
}

class DynamicTagSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const {containerEl} = this;
        containerEl.empty();
        containerEl.createEl('h2', {text: 'Dynamic Tag Styling'});

        new Setting(containerEl)
            .setName('Background Color')
            .setDesc('Hex or RGBA color for the tag background.')
            .addText(text => text
                .setPlaceholder('rgba(255, 255, 255, 0.1)')
                .setValue(this.plugin.settings.defaultTagColor)
                .onChange(async (value) => {
                    this.plugin.settings.defaultTagColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStyle();
                }));

        new Setting(containerEl)
            .setName('Text Color')
            .setDesc('Hex or RGBA color for the text. Leave empty for theme default.')
            .addText(text => text
                .setPlaceholder('#ffffff')
                .setValue(this.plugin.settings.textColor)
                .onChange(async (value) => {
                    this.plugin.settings.textColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStyle();
                }));

        new Setting(containerEl)
            .setName('Custom Google Fonts URL')
            .setDesc('Paste the full HTML embed snippet or raw URL. The plugin will automatically extract the correct link.')
            .addText(text => text
                .setPlaceholder('<link href="https://fonts.googleapis.com...">')
                .setValue(this.plugin.settings.customFontUrl)
                .onChange(async (value) => {
                    const cleanUrl = extractCleanUrl(value);
                    this.plugin.settings.customFontUrl = cleanUrl;
                    this.plugin.settings.customFonts = extractGoogleFonts(cleanUrl);
                    await this.plugin.saveSettings();
                    this.plugin.injectWebFonts();
                    this.plugin.updateStyle();
                    
                    if (value !== cleanUrl || this.plugin.settings.customFonts.length > 0) {
                        this.display(); 
                    }
                }));

        const fontDropdown = new Setting(containerEl)
            .setName('Font Family')
            .setDesc('Select a font for your tags.');

        fontDropdown.addDropdown(dropdown => {
            dropdown.addOption('', 'Theme Default');
            dropdown.addOption("'Roboto', sans-serif", 'Roboto');
            dropdown.addOption("'Open Sans', sans-serif", 'Open Sans');
            dropdown.addOption("'Montserrat', sans-serif", 'Montserrat');
            dropdown.addOption("'Lora', serif", 'Lora');
            dropdown.addOption("'Merriweather', serif", 'Merriweather');
            dropdown.addOption("'Playfair Display', serif", 'Playfair Display');
            dropdown.addOption("'Courier Prime', monospace", 'Courier Prime');
            dropdown.addOption("'Space Mono', monospace", 'Space Mono');
            dropdown.addOption("'Comic Neue', cursive", 'Comic Neue');

            if (this.plugin.settings.customFonts && this.plugin.settings.customFonts.length > 0) {
                this.plugin.settings.customFonts.forEach(font => {
                    dropdown.addOption(font.css, `${font.name} (Custom)`);
                });
            }

            dropdown.setValue(this.plugin.settings.fontFamily);
            dropdown.onChange(async (value) => {
                this.plugin.settings.fontFamily = value;
                await this.plugin.saveSettings();
                this.plugin.updateStyle();
            });
        });

        new Setting(containerEl)
            .setName('Bold Text')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.isBold)
                .onChange(async (value) => {
                    this.plugin.settings.isBold = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStyle();
                }));

        new Setting(containerEl)
            .setName('Italic Text')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.isItalic)
                .onChange(async (value) => {
                    this.plugin.settings.isItalic = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStyle();
                }));

        new Setting(containerEl)
            .setName('Underline Text')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.isUnderline)
                .onChange(async (value) => {
                    this.plugin.settings.isUnderline = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStyle();
                }));

        containerEl.createEl('hr');
        containerEl.createEl('h2', {text: 'Font Preview'});

        let fontsToPreview = [
            { name: 'Roboto', css: "'Roboto', sans-serif" },
            { name: 'Open Sans', css: "'Open Sans', sans-serif" },
            { name: 'Montserrat', css: "'Montserrat', sans-serif" },
            { name: 'Lora', css: "'Lora', serif" },
            { name: 'Merriweather', css: "'Merriweather', serif" },
            { name: 'Playfair Display', css: "'Playfair Display', serif" },
            { name: 'Courier Prime', css: "'Courier Prime', monospace" },
            { name: 'Space Mono', css: "'Space Mono', monospace" },
            { name: 'Comic Neue', css: "'Comic Neue', cursive" }
        ];

        if (this.plugin.settings.customFonts && this.plugin.settings.customFonts.length > 0) {
            fontsToPreview = fontsToPreview.concat(this.plugin.settings.customFonts);
        }

        fontsToPreview.forEach(font => {
            containerEl.createEl('h3', {text: font.name, cls: 'font-preview-heading'});
            
            const previewBox = containerEl.createEl('div');
            previewBox.style.fontFamily = font.css;
            previewBox.style.marginBottom = '20px';
            previewBox.style.padding = '10px';
            previewBox.style.backgroundColor = 'var(--background-secondary)';
            previewBox.style.borderRadius = '5px';
            previewBox.style.color = 'var(--text-normal)';

            previewBox.createEl('div', {text: 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG.'});
            previewBox.createEl('div', {text: 'the quick brown fox jumps over the lazy dog.'});
        });
    }
}

module.exports = DynamicPriorityTags;
