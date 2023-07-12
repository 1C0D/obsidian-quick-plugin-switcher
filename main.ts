import { App, DropdownComponent, ExtraButtonComponent, Modal, Plugin, SearchComponent, Setting, TextComponent, ToggleComponent } from 'obsidian';

interface QuickPluginSwitcherSettings {
	allPluginsList: PluginInfo[]
	filters: "all" | "enabled" | "disabled" | "mostSwitched",
	search: string
}

const DEFAULT_SETTINGS: QuickPluginSwitcherSettings = {
	allPluginsList: [],
	filters: "all",
	search: ""
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
	qpsItems: HTMLElement
	listItems: PluginInfo[] = []

	onOpen() {
		console.log("opening")
		const { contentEl } = this;
		contentEl.empty();
		this.addFirstline(contentEl)
		contentEl.createEl("br")
		this.addSearch(contentEl)
		contentEl.createEl("br")
		const allPluginsList = this.plugin.settings.allPluginsList
		this.addItems(contentEl, allPluginsList)
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

		if (this.plugin.settings.filters === "mostSwitched") {
			new ExtraButtonComponent(headBar).setIcon("reset").setTooltip("Reset mostSwitched to 0").onClick(async () => {
				this.plugin.settings.allPluginsList = []
				this.plugin.getPluginsInfo()
				this.plugin.reset = true
				this.onOpen()
				await this.plugin.saveSettings();
			})

			headBar.createEl("span", { text: "Reset mostSwitched values", cls: ["reset-desc"] })
		}
	}

	addSearch(contentEl: HTMLElement) {
		new Setting(contentEl)
			.setName("Search Plugin")
			.setDesc("")
			.addSearch(async (search: SearchComponent) => {
				search
					.setValue(this.plugin.settings.search)
					.setPlaceholder("Search")
					.onChange(async (value: string) => {
						const listItems = []
						for (const plugin of this.plugin.settings.allPluginsList)
							if (plugin.name.toLowerCase().includes(value)) {
								listItems.push(plugin)
							}
						this.qpsItems.empty()
						this.addItems(contentEl, listItems)
					});
			});
	}

	addItems(contentEl: HTMLElement, listItems: PluginInfo[]) {
		this.qpsItems = contentEl.createEl("div", { cls: ["qps-items"] });
		// mostSwitched at start of the list
		if (this.plugin.settings.filters === "mostSwitched" && !this.plugin.reset) {
			listItems.sort((a, b) => b.switched - a.switched)
		} else {
			listItems.sort((a, b) => a.name.localeCompare(b.name))
			if (this.plugin.reset) this.plugin.reset = false
		}

		for (const plugin of listItems) {
			if (
				(this.plugin.settings.filters === "enabled" && !plugin.enabled) ||
				(this.plugin.settings.filters === "disabled" && plugin.enabled)
			) {
				continue;
			}

			const itemContainer = this.qpsItems.createEl("div");

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
