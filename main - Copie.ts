// this.addSettingTab(new QPSSettingTab(this.app, this));
import { App, DropdownComponent, ExtraButtonComponent, ISuggestOwner, Modal, Plugin, PluginSettingTab, Scope, SearchComponent, Setting, TextComponent, ToggleComponent } from 'obsidian';
import { createPopper, type Instance as PopperInstance } from "@popperjs/core";


interface QuickPluginSwitcherSettings {
	allPluginsList: PluginInfo[]
	filters: "all" | "enabled" | "disabled" | "mostSwitched",
	search: string,
}

const DEFAULT_SETTINGS: QuickPluginSwitcherSettings = {
	allPluginsList: [],
	filters: "all",
	search: "",
}

interface PluginInfo {
	name: string;
	id: string;
	desc: string;
	enabled: boolean;
	switched: number
}

export default class QuickPluginSwitcher extends Plugin {
	settings: QuickPluginSwitcherSettings;
	reset: boolean = false


	async onload() {
		await this.loadSettings();

		const ribbonIconEl = this.addRibbonIcon('toggle-right', 'Quick Plugin Switcher', (evt: MouseEvent) => {
			// this.settings.allPluginsList =[] //for debugging
			this.getPluginsInfo()
			new QuickPluginSwitcherModal(this.app, this).open();
		});
	}

	isEnabled(name: string): boolean {
		return (this.app as any).plugins.enabledPlugins.has(name)
	}

	getPluginsInfo = async () => {
		const allPluginsList = this.settings.allPluginsList;
		const manifests = (this.app as any).plugins.manifests;
		// if plugins have been deleted
		const installedPlugins = allPluginsList.filter(plugin =>
			Object.keys(manifests).includes(plugin.id)
		);

		for (const key of Object.keys(manifests)) {
			const exists = installedPlugins.some(plugin => plugin.id === manifests[key]?.id);

			if (exists) {
				continue
			};

			const pluginObject: PluginInfo = {
				name: manifests[key]?.name,
				id: manifests[key]?.id,
				desc: manifests[key]?.description,
				enabled: this.isEnabled(manifests[key]?.id),
				switched: 0
			};

			installedPlugins.push(pluginObject);
		}
		this.settings.allPluginsList = installedPlugins;
		await this.saveSettings()
	}

	async loadSettings() {
		this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() };
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class QuickPluginSwitcherModal extends Modal {
	constructor(app: App, public plugin: QuickPluginSwitcher) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.addFirstline(contentEl)
		contentEl.createEl("br")
		this.addSearch(contentEl)
		contentEl.createEl("br")
		this.addItems(contentEl)
	}

	addFirstline(contentEl: HTMLElement) {

		const headBar = contentEl.createEl("div", { text: "Plugins List", cls: ["qps-headbar"] })
		new DropdownComponent(headBar).addOptions({
			all: "All",
			enabled: "Enabled",
			disabled: "Disabled",
			mostSwitched: "Most Switched"

		})
			.setValue(this.plugin.settings.filters)
			.onChange(async (value: "all" | "enabled" | "disabled" | "mostSwitched") => {
				this.plugin.settings.filters = value;
				this.onOpen()
				await this.plugin.saveSettings();
			})

		new ExtraButtonComponent(headBar).setIcon("reset").setTooltip("Reset mostSwitched to 0").onClick(async () => {
			this.plugin.settings.allPluginsList = []
			this.plugin.getPluginsInfo()
			this.plugin.reset = true
			this.onOpen()
			await this.plugin.saveSettings();
		})

		headBar.createEl("span", { text: "Reset mostSwitched values", cls: ["reset-desc"] })
	}

	addSearch(contentEl: HTMLElement) {
		new Setting(contentEl)
			.setName("Search Plugin")
			.setDesc("")
			.addSearch(async (search: SearchComponent) => {
				new SearchSuggester(this.app, search.inputEl, this.plugin);
				search
					.setValue(this.plugin.settings.search)
					.setPlaceholder("Search")
					.onChange(async (value: string) => {
						this.plugin.settings.search = value;
					});
			});
	}
	
	addItems(contentEl: HTMLElement) {
		const allPluginsList = this.plugin.settings.allPluginsList;
		const qpsItems = contentEl.createEl("div", { cls: ["qps-items"] });

		// mostSwitched at start of the list
		if (this.plugin.settings.filters === "mostSwitched" && !this.plugin.reset) {
			allPluginsList.sort((a, b) => b.switched - a.switched)
		} else {
			allPluginsList.sort((a, b) => a.name.localeCompare(b.name))
			if (this.plugin.reset) this.plugin.reset = false
		}

		for (const plugin of allPluginsList) {
			if (
				(this.plugin.settings.filters === "enabled" && !plugin.enabled) ||
				(this.plugin.settings.filters === "disabled" && plugin.enabled)
			) {
				continue;
			}

			const itemContainer = qpsItems.createEl("div");

			new ToggleComponent(itemContainer)
				.setValue(plugin.enabled)
				.onChange(async (value) => {
					plugin.enabled = value;
					value
						? (this.app as any).plugins.enablePlugin(plugin.id)
						: (this.app as any).plugins.disablePlugin(plugin.id);
					plugin.switched++;
					this.onOpen();
					await this.plugin.saveSettings();
				})

			new TextComponent(itemContainer)
				.setValue(plugin.name)
				.setDisabled(true);
		}
	}


	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}



// chhoumann/quickadd
const wrapAround = (value: number, size: number): number => {
	return ((value % size) + size) % size;
};

export class Suggest<T> {
	private owner: ISuggestOwner<T>;
	private values: T[];
	private suggestions: HTMLDivElement[];
	private selectedItem: number;
	private containerEl: HTMLElement;

	constructor(owner: ISuggestOwner<T>, containerEl: HTMLElement, scope: Scope) {
		this.owner = owner;
		this.containerEl = containerEl;

		containerEl.on("click", ".suggestion-item", this.onSuggestionClick.bind(this));
		containerEl.on(
			"mousemove",
			".suggestion-item",
			this.onSuggestionMouseover.bind(this)
		);

		scope.register([], "ArrowUp", (event:KeyboardEvent) => {
			if (!event.isComposing) {
				this.setSelectedItem(this.selectedItem - 1, true);
				return false;
			}
		});

		scope.register([], "ArrowDown", (event: KeyboardEvent) => {
			if (!event.isComposing) {
				this.setSelectedItem(this.selectedItem + 1, true);
				return false;
			}
		});

		scope.register([], "Enter", (event: KeyboardEvent) => {
			if (!event.isComposing) {
				this.useSelectedItem(event);
				return false;
			}
		});
	}

	onSuggestionClick(event: MouseEvent, el: HTMLDivElement): void {
		event.preventDefault();

		const item = this.suggestions.indexOf(el);
		this.setSelectedItem(item, false);
		this.useSelectedItem(event);
	}

	onSuggestionMouseover(_event: MouseEvent, el: HTMLDivElement): void {
		const item = this.suggestions.indexOf(el);
		this.setSelectedItem(item, false);
	}

	setSuggestions(values: T[]) {
		this.containerEl.empty();
		const suggestionEls: HTMLDivElement[] = [];

		values.forEach((value) => {
			const suggestionEl = this.containerEl.createDiv("suggestion-item");
			this.owner.renderSuggestion(value, suggestionEl);
			suggestionEls.push(suggestionEl);
		});

		this.values = values;
		this.suggestions = suggestionEls;
		this.setSelectedItem(0, false);
	}

	useSelectedItem(event: MouseEvent | KeyboardEvent) {
		const currentValue = this.values[this.selectedItem];
		if (currentValue) {
			this.owner.selectSuggestion(currentValue, event);
		}
	}

	setSelectedItem(selectedIndex: number, scrollIntoView: boolean) {
		const normalizedIndex = wrapAround(selectedIndex, this.suggestions.length);
		const prevSelectedSuggestion = this.suggestions[this.selectedItem];
		const selectedSuggestion = this.suggestions[normalizedIndex];

		prevSelectedSuggestion?.removeClass("is-selected");
		selectedSuggestion?.addClass("is-selected");

		this.selectedItem = normalizedIndex;

		if (scrollIntoView) {
			selectedSuggestion.scrollIntoView(false);
		}
	}
}

export abstract class TextInputSuggest<T> implements ISuggestOwner<T> {
	protected app: App;
	protected inputEl: HTMLInputElement | HTMLTextAreaElement;

	private popper: PopperInstance;
	private scope: Scope;
	private suggestEl: HTMLElement;
	private suggest: Suggest<T>;

	constructor(app: App, inputEl: HTMLInputElement | HTMLTextAreaElement) {
		this.app = app;
		this.inputEl = inputEl;
		this.scope = new Scope();

		this.suggestEl = createDiv("suggestion-container");
		const suggestion = this.suggestEl.createDiv("suggestion");
		this.suggest = new Suggest(this, suggestion, this.scope);

		this.scope.register([], "Escape", this.close.bind(this));

		this.inputEl.addEventListener("input", this.onInputChanged.bind(this));
		this.inputEl.addEventListener("focus", this.onInputChanged.bind(this));
		this.inputEl.addEventListener("blur", this.close.bind(this));
		this.suggestEl.on(
			"mousedown",
			".suggestion-container",
			(event: MouseEvent) => {
				event.preventDefault();
			}
		);
	}

	onInputChanged(): void {
		const inputStr = this.inputEl.value;
		const suggestions = this.getSuggestions(inputStr);

		if (!suggestions) {
			this.close();
			return;
		}

		if (suggestions.length > 0) {
			this.suggest.setSuggestions(suggestions);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			this.open((<any>this.app).dom.appContainerEl, this.inputEl);
		} else {
			this.close();
		}
	}

	open(container: HTMLElement, inputEl: HTMLElement): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(<any>this.app).keymap.pushScope(this.scope);

		container.appendChild(this.suggestEl);
		this.popper = createPopper(inputEl, this.suggestEl, {
			placement: "bottom-start",
			modifiers: [
				{
					name: "sameWidth",
					enabled: true,
					fn: ({ state, instance }) => {
						// Note: positioning needs to be calculated twice -
						// first pass - positioning it according to the width of the popper
						// second pass - position it with the width bound to the reference element
						// we need to early exit to avoid an infinite loop
						const targetWidth = `${state.rects.reference.width}px`;
						if (state.styles.popper.width === targetWidth) {
							return;
						}
						state.styles.popper.width = targetWidth;
						void instance.update();
					},
					phase: "beforeWrite",
					requires: ["computeStyles"],
				},
			],
		});
	}

	close(): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(<any>this.app).keymap.popScope(this.scope);

		this.suggest.setSuggestions([]);
		if (this.popper) this.popper.destroy();
		this.suggestEl.detach();
	}

	abstract getSuggestions(inputStr: string): T[];
	abstract renderSuggestion(item: T, el: HTMLElement): void;
	abstract selectSuggestion(item: T): void;
}


export class SearchSuggester extends TextInputSuggest<string> {
	constructor(
		public app: App,
		public inputEl: HTMLInputElement | HTMLTextAreaElement,
		public plugin: QuickPluginSwitcher
	) {
		super(app, inputEl);
		this.plugin = plugin;
	}
	pluginNames: string[] = [];

	getSuggestions(inputStr: string): string[] {
		const plugins = this.plugin.settings.allPluginsList
		for (const plugin of plugins) {
			if (plugin.name.toLowerCase().contains(inputStr)) {
				this.pluginNames.push(plugin.name)
			}			
		}
		return this.pluginNames;
	}

	selectSuggestion(item: string): void {
		this.inputEl.value = item;
		this.inputEl.trigger("input");
		this.close();
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		if (value) {
			el.setText(value)
			// console.log("this.pluginNames", this.pluginNames)
			// console.log("value", value)
		};
		// if (value) el.setText(value);
		// el.setText(file.path);
	}
}



// const searchLine = contentEl.createEl("div", { text: "Search Plugin", cls: ["qps-search"] })
// new SearchComponent(searchLine)
// 	.setPlaceholder("Search")
// 	.setValue(this.plugin.settings.search)
// 	.onChange(async (value) => {
// 		this.plugin.settings.search = value;
// 	// 	// this.onOpen()
// 	// 	// await this.plugin.saveSettings();
// 	})