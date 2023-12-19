// switch timer to fix error disabling plugin
import { around } from "monkey-around";
import { PackageInfoData, Plugin, PluginCommInfo, PluginInfo, QPSSettings } from "obsidian";
import { QPSModal } from "./main_modal";
import { isEnabled } from "./utils";
import {
	DEFAULT_SETTINGS,
	commPluginStats,
	commPlugins,
} from "./types/variables";
import QPSSettingTab from "./settings";
import { fetchData } from "./community-plugins_modal";

export default class QuickPluginSwitcher extends Plugin {
	settings: QPSSettings;
	reset = false;
	lengthAll = 0;
	lengthDisabled = 0;
	lengthEnabled = 0;
	commPlugins: PluginCommInfo[];
	pluginStats: PackageInfoData;

	async onload() {
		await this.loadSettings();
		this.app.workspace.onLayoutReady(async () => {
			const { settings } = this;
			const allPluginsList = settings.allPluginsList || [];
			const manifests = (this.app as any).plugins.manifests || {};
			// plugin have been deleted from obsidian UI ?
			let stillInstalled: PluginInfo[] = [];

			// console.log("manifests", manifests)

			for (const plugin of allPluginsList) {
				if (Object.keys(manifests).includes(plugin.id))
					stillInstalled.push(plugin);
			}

			const { wrapper1, wrapper2 } = this.wrapDisableEnablePluginAndSave(
				stillInstalled,
				async () => {
					await this.saveSettings();
				}
			);

			this.register(wrapper1);
			this.register(wrapper2);

			// plugin has been toggled from obsidian UI ? or if is delayed unabled
			for (const plugin of stillInstalled) {
				if (
					isEnabled(this, plugin.id) !== plugin.enabled &&
					!plugin.delayed //because if delayed isEnabled false
				) {
					plugin.enabled = !plugin.enabled;
				}
			}
			await this.saveSettings();

			//delay at start
			for (const pluginItem of stillInstalled) {
				if (pluginItem.delayed && pluginItem.enabled) {
					const time = pluginItem.time * 1000 || 0;
					setTimeout(
						async () =>
							await (this.app as any).plugins.enablePlugin(
								pluginItem.id
							),
						time
					);
				}
			}
		});
		this.addSettingTab(new QPSSettingTab(this.app, this));

		this.addRibbonIcon(
			"toggle-right",
			"Quick Plugin Switcher",
			async (evt: MouseEvent) => {
				this.getPluginsInfo();
				this.getLength();
				await exeAfterDelay(this, this.commPluginsInfo.bind(this));
				new QPSModal(this.app, this).open();
			}
		);

		this.addCommand({
			id: "quick-plugin-switcher-modal",
			name: "open modal",
			callback: async () => {
				this.getPluginsInfo();
				this.getLength();
				await exeAfterDelay(this, this.commPluginsInfo.bind(this));
				new QPSModal(this.app, this).open();
			},
		});
	}

	wrapDisableEnablePluginAndSave(stillInstalled: PluginInfo[], cb: () => {}) {
		const manifests = (this.app as any).plugins.manifests || {};
		const wrapper1 = around((this.app as any).plugins, {
			disablePluginAndSave(oldMethod) {
				return async function (pluginId: string) {
					if (stillInstalled) {
						const plugin = stillInstalled.find(
							(plugin) =>
								plugin.id === pluginId &&
								!isEnabled(this, manifests[pluginId].id)
						);
						if (plugin && plugin.delayed && plugin.time > 0) {
							plugin.enabled = false;
							cb();
						}
					}
					return oldMethod.call(this, pluginId);
				};
			},
		});
		const wrapper2 = around((this.app as any).plugins, {
			enablePluginAndSave(oldMethod) {
				return async function (pluginId: string) {
					let altReturn = false;
					if (stillInstalled) {
						const plugin = stillInstalled.find(
							(plugin) =>
								plugin.id === pluginId &&
								isEnabled(this, manifests[pluginId].id)
						);
						if (plugin && plugin.delayed && plugin.time > 0) {
							plugin.enabled = true;
							altReturn = true;
							cb();
						}
					}
					if (altReturn)
						return (this.app as any).plugins.enablePlugin.call(
							this,
							pluginId
						);
					return oldMethod.call(this, pluginId);
				};
			},
		});

		return { wrapper1, wrapper2 };
	}

	async getPluginsInfo() {
		const { settings } = this;
		const allPluginsList = settings.allPluginsList || [];
		const manifests = this.app.plugins.manifests || {};

		// plugin have been deleted from obsidian UI ?
		let stillInstalled: PluginInfo[] = [];
		for (const plugin of allPluginsList) {
			if (Object.keys(manifests).includes(plugin.id))
				stillInstalled.push(plugin);
		}

		for (let pluginInList of stillInstalled) {
			const matchingManifest = Object.values(manifests).find(
				(manifest) => manifest.id === pluginInList.id
			);
			// Check and update properties based on the matching manifest
			if (matchingManifest) {
				if (
					isEnabled(this, matchingManifest.id) !==
					pluginInList.enabled &&
					!pluginInList.delayed
				) {
					pluginInList.enabled = !pluginInList.enabled;
				} else if (
					pluginInList.delayed &&
					isEnabled(this, matchingManifest.id) !== pluginInList.enabled
				) {
					if (isEnabled(this, matchingManifest.id)) {
						pluginInList.enabled = true;
						await (this.app as any).plugins.disablePluginAndSave(
							pluginInList.id
						);
						await (this.app as any).plugins.enablePlugin(
							pluginInList.id
						);
						pluginInList.switched++;
					}
				}

				const {
					name = "",
					description = "",
					dir = "",
					version = "",
					author = "",
					authorUrl = "",
					isDesktopOnly = false
				} = matchingManifest;

				pluginInList.name = name
				pluginInList.desc = description
				pluginInList.dir = dir
				pluginInList.version = version
				pluginInList.author = author
				pluginInList.authorUrl = authorUrl
				pluginInList.desktopOnly = isDesktopOnly
			} else {
				const notInListInfo: PluginInfo = {
					name: "",
					id: "",
					desc: "",
					dir: "",
					version: "",
					repo: { downloads: 0, updated: 0 },
					author: "",
					authorUrl: "",
					desktopOnly: false,
					enabled: false,
					switched: 0,
					groupInfo: {
						groupIndices: [],
						groupWasEnabled: false,
					},
					delayed: false,
					time: 0,
				};

				stillInstalled.push(notInListInfo);
			}
		}
		settings.allPluginsList = stillInstalled;
		await this.saveSettings();
		this.getLength();
	}

	getLength() {
		const { settings } = this;
		const allPluginsList = settings.allPluginsList || [];
		this.lengthAll = allPluginsList.length;
		this.lengthEnabled = settings.allPluginsList.filter(
			(plugin) => plugin.enabled
		).length;
		this.lengthDisabled = settings.allPluginsList.filter(
			(plugin) => !plugin.enabled
		).length;
	}

	async commPluginsInfo() {
		console.debug("fetching'''''''''''''''''''''''''");
		let plugins, stats;
		try {
			plugins = await fetchData(commPlugins);
			stats = await fetchData(commPluginStats);
		} catch {
			return false;
		}
		if (plugins || stats) {
			this.settings.commPlugins = plugins;
			this.settings.pluginStats = stats;
			await this.saveSettings();
			console.debug("fetched");
			return true;
		}
		return false;
	}

	async loadSettings() {
		const previousSettings = { ...(await this.loadData()) };
		if ("mobileSettings" in previousSettings) {
			delete previousSettings.mobileSettings;
		}

		this.settings = { ...DEFAULT_SETTINGS, ...previousSettings };
		this.settings.savedVersion = this.manifest.version;
		await this.saveSettings();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

const exeAfterDelay = async (
	_this: QuickPluginSwitcher,
	func: () => Promise<boolean>
) => {
	const { settings } = _this;
	const currentTime: number = Date.now();
	// delay 3min
	if (currentTime - settings.lastFetchExe >= 180000) {
		const ret = await func();
		if (ret === true) {
			settings.lastFetchExe = currentTime;
			await _this.saveSettings();
		} else {
			console.log("community plugins udpate failed, check your connexion");
		}
	} else {
		console.log(
			"fetched less than 3 min, community plugins not updated"
		);
	}
};
