import { Plugin } from 'obsidian';
import { around } from "monkey-around";
import { QPSModal } from "./main_modal";
import { isEnabled } from "./utils";
import QPSSettingTab from "./settings";
import { fetchData } from "./community-plugins_modal";
import { CommPlugin, PackageInfoData,  QPSSettings } from "./types/global";
import { COMMPLUGINS, COMMPLUGINSTATS, DEFAULT_SETTINGS } from './types/variables';
import { Console } from './Console';

export default class QuickPluginSwitcher extends Plugin {
	settings: QPSSettings;
	lengthAll = 0;
	lengthDisabled = 0;
	lengthEnabled = 0;
	reset = false;

	async onload() {
		await this.loadSettings();
		this.app.workspace.onLayoutReady(async () => {
			const installed = this.settings.installed || {};
			const manifests = this.app.plugins.manifests || {};

			// plugin have been deleted from obsidian UI ?
			let stillInstalled: string[] = [];
			for (const pluginId in installed) {
				if (pluginId in manifests)
					stillInstalled.push(pluginId);
				else {
					delete installed[pluginId]
				}
			}

			//wrapper enable/disable&save
			const { wrapper1, wrapper2 } = this.wrapDisableEnablePluginAndSave(
				stillInstalled,
				async () => {
					await this.saveSettings();
				}
			);

			this.register(wrapper1);
			this.register(wrapper2);

			// plugin has been toggled from obsidian UI ? or if is delayed unabled
			for (const id of stillInstalled) {
				if (
					isEnabled(this, id) !== installed[id].enabled &&
					!installed[id].delayed //because if delayed isEnabled false
				) {
					installed[id].enabled = !installed[id].enabled;
				}
			}
			await this.saveSettings();

			//delay at start
			for (const id of stillInstalled) {
				if (installed[id].delayed && installed[id].enabled) {
					const time = installed[id].time * 1000 || 0;
					setTimeout(
						async () =>
							await this.app.plugins.enablePlugin(id),
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
				await this.getPluginsInfo();
				new QPSModal(this.app, this).open();
				await this.exeAfterDelay(this.pluginsCommInfo.bind(this))
			}
		);

		this.addCommand({
			id: "quick-plugin-switcher-modal",
			name: "open modal",
			callback: async () => {
				await this.getPluginsInfo();
				new QPSModal(this.app, this).open();
				await this.exeAfterDelay(this.pluginsCommInfo.bind(this));
			},
		});
	}

	wrapDisableEnablePluginAndSave(stillInstalled: string[], cb: () => {}) {
		const installed = this.settings.installed || {};
		const wrapper1 = around(this.app.plugins, {
			disablePluginAndSave(oldMethod) {
				return async function (pluginId: string) {
					if (stillInstalled.length) {
						const id = stillInstalled.find(
							(id) =>
								id === pluginId &&
								!isEnabled(this, pluginId)
						);
						if (id && installed[id].delayed && installed[id].time > 0) {
							installed[id].enabled = false;
							cb();
						}
					}
					return oldMethod.call(this, pluginId);
				};
			},
		});

		const wrapper2 = around(this.app.plugins, {
			enablePluginAndSave(oldMethod) {
				return async function (pluginId: string) {
					let altReturn = false;
					if (stillInstalled.length) {
						const id = stillInstalled.find(
							(id) =>
								id === pluginId &&
								isEnabled(this, id)
						);
						if (id && installed[id].delayed && installed[id].time > 0) {
							installed[id].enabled = true;
							altReturn = true;
							cb();
						}
					}
					if (altReturn)
						return this.app.plugins.enablePlugin.call(
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
		const installed = this.settings.installed || {};
		const manifests = this.app.plugins.manifests || {};

		// plugin have been deleted from obsidian UI ?
		let stillInstalled: string[] = [];

		for (const id in installed) {
			if (id in manifests)
				stillInstalled.push(id);
			else {
				Console.log("shouldn't happen there, plugin have been deleted from obsidian UI", id);
				delete installed[id]
			}
		}

		for (const key in manifests) {
			// plugin has been toggled from obsidian UI ? or if is delayed unabled
			const inListId = stillInstalled.find(
				(id) => id === key
			);

			if (inListId) {
				if (
					isEnabled(this, key) !==
					installed[key].enabled &&
					!installed[key].delayed
				) {
					installed[key].enabled = !installed[key].enabled;
				} else if (
					installed[key].delayed &&
					isEnabled(this, key) !== installed[key].enabled
				) {
					if (isEnabled(this, key)) {
						installed[key].enabled = true;
						await this.app.plugins.disablePluginAndSave(
							key
						);
						await this.app.plugins.enablePlugin(
							key
						);
						installed[key].switched++;
					}
				}
				installed[key] = {
					...installed[key], ...manifests[key]
				}
			} else {
				const complement = {
					enabled: isEnabled(this, key) || false,
					switched: 0,
					groupInfo: {
						hidden: false,
						groupIndices: [],
						groupWasEnabled: false,
					},
					delayed: false,
					time: 0,
				}

				installed[key] = {
					...manifests[key], ...complement,
				}
			}
		}
		this.getLength();
		await this.saveSettings();
	}

	getLength() {
		const installed = this.settings.installed;
		this.lengthAll = Object.keys(installed).length;
		this.lengthEnabled = 0;
		this.lengthDisabled = 0;

		for (const key in installed) {
			if (installed[key].enabled) {
				this.lengthEnabled++;
			} else {
				this.lengthDisabled++;
			}
		}
	}

	async pluginsCommInfo() {
		console.log("fetching'''''''''''''''''''''''''");
		let plugins: CommPlugin[], stats: PackageInfoData;
		try {
			plugins = await fetchData(COMMPLUGINS);
			stats = await fetchData(COMMPLUGINSTATS);
		} catch {
			return false;
		}
		if (plugins && stats) {
	
			const { commPlugins, pluginStats } = this.settings

			for (const plugin of plugins) {
				let updateStats;
				if (plugin.id in pluginStats) {
					updateStats = {
						downloads: pluginStats[plugin.id].downloads || 0,
						updated: pluginStats[plugin.id].updated || 0
					}
				} else {
					updateStats = {
						downloads: 0,
						updated: 0
					}
				}

				if (plugin.id in commPlugins) {
					commPlugins[plugin.id] = { ...commPlugins[plugin.id], ...plugin, ...updateStats };
				} else {
					const complement = {
						hidden: false,
						groupCommInfo: {
							hidden: false,
							groupIndices: []
						},
						...updateStats
					}
					commPlugins[plugin.id] = { ...plugin, ...complement };
				}
			}

			this.settings.pluginStats = { ...this.settings.pluginStats, ...stats };

			await this.saveSettings();
			console.log("fetched");
			return true;
		}
		return false;
	}

	exeAfterDelay = async (
		func: () => Promise<boolean>
	) => {
		const currentTime: number = Date.now();
		// delay 3min
		if (currentTime - this.settings.lastFetchExe >= 120000) {
			const ret = await func();
			if (ret === true) {
				this.settings.lastFetchExe = currentTime;
				await this.saveSettings();
			} else {
				console.log("community plugins udpate failed, check your connexion");
			}
		} else {
			console.log(
				"fetched less than 2 min, community plugins not updated"
			);
		}
	};

	async loadSettings() {
		const previousSettings = { ...(await this.loadData()) };
		if ("allPluginsList" in previousSettings) {
			delete previousSettings.allPluginsList;
			delete previousSettings.pluginStats;
			delete previousSettings.commPlugins;

			Console.log("allPluginsList... has been deleted");
		}

		this.settings = { ...DEFAULT_SETTINGS, ...previousSettings };
		this.settings.savedVersion = this.manifest.version;
		await this.saveSettings();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

const info =
	`item dans allPluginsList
{
    "name": "Close Similar Tabs",
    "id": "close-similar-tabs",
    "desc": "Avoid to have a file opened several times in your tabs. (+setting: by window or everywhere)",
    "dir": ".obsidian/plugins/Obsidian-Close-Similar-Tabs",
    "version": "2.3.6",
    "author": "1C0D",
    "authorUrl": "",
    "desktopOnly": false,
    "enabled": false,
    "switched": 0,
    "groupInfo": {
        "hidden": false,
        "groupIndices": [],
        "groupWasEnabled": false
    },
    "delayed": false,
    "time": 0
}
item dans manifests
{
    "id": "close-similar-tabs",
    "name": "Close Similar Tabs",
    "version": "2.3.6",
    "minAppVersion": "0.15.0",
    "description": "Avoid to have a file opened several times in your tabs. (+setting: by window or everywhere)",
    "author": "1C0D",
    "authorUrl": "",
    "isDesktopOnly": false,
    "dir": ".obsidian/plugins/Obsidian-Close-Similar-Tabs"
}
`

