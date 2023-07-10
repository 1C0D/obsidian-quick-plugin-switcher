// this.addSettingTab(new QPSSettingTab(this.app, this));
import { App, DropdownComponent, ExtraButtonComponent, Modal, Plugin, PluginSettingTab, Setting, TextComponent, ToggleComponent } from 'obsidian';

interface QuickPluginSwitcherSettings {
	allPluginsList: PluginInfo[]
	filters: "all" | "enabled" | "disabled" | "mostSwitched",
}

const DEFAULT_SETTINGS: QuickPluginSwitcherSettings = {
	allPluginsList: [],
	filters: "all"
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
			new QuickPluginSwitcherModal(this.app, this).open();
		});
	}

	isEnabled(name: string): boolean {
		return (this.app as any).plugins.enabledPlugins.has(name)
	}

	getPluginsInfo = async () => {
		console.debug("debug comment");
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
		contentEl.createEl("p") // empty line
		this.addItems(contentEl)
	}

	addFirstline(contentEl: HTMLElement) {
		const div0 = contentEl.createEl("div", { text: "Plugins List", cls: ["qps-modal-title"] })
		new DropdownComponent(div0).addOptions({
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
		
		new ExtraButtonComponent(div0).setIcon("reset").setTooltip("Reset mostSwitched to 0").onClick(async () => { 
			this.plugin.settings.allPluginsList = []
			this.plugin.getPluginsInfo()
			this.plugin.reset = true
			this.onOpen()
			await this.plugin.saveSettings();
		})

		div0.createEl("span", { text: "Reset mostSwitched values", cls: ["reset-desc"] })
	}

	addItems(contentEl: HTMLElement) {
		let counter = 0 //counter to add 2 items per line
		let div = contentEl.createEl("div",{cls: ["qps-item-pair"] })
		// div.empty()
		let allPluginsList = this.plugin.settings.allPluginsList

		// mostSwitched at start of the list
		if (this.plugin.settings.filters === "mostSwitched" && !this.plugin.reset) {
			allPluginsList.sort((a, b) => b.switched - a.switched)
		} else {
			allPluginsList.sort((a, b) => a.name.localeCompare(b.name))
			if (this.plugin.reset) this.plugin.reset = false
		}

		for (const plugin of allPluginsList) {
			if (this.plugin.settings.filters === "enabled" && !plugin.enabled
				|| this.plugin.settings.filters === "disabled" && plugin.enabled) continue

			// new div after two added items
			if (counter > 1) {
				div = contentEl.createEl("div", { cls: ["qps-item-pair"] });
				counter = 0
			}

			new ToggleComponent(div).setValue(plugin.enabled).onChange(async (value) => {
				plugin.enabled = value;
				value ? (this.app as any).plugins.enablePlugin(plugin.id) :
					(this.app as any).plugins.disablePlugin(plugin.id)
				plugin.switched++
				this.onOpen()
				await this.plugin.saveSettings();
			})

			new TextComponent(div).setValue(plugin.name).setDisabled(true);
			
			counter++
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

