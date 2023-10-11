import { Filters, Groups, PluginCommInfo, PluginInfo, QPSSettings } from "./types";
import Plugin from "./main";
import { QPSModal } from "./main_modal";
import { confirm } from "./secondary_modals";
import {
	ButtonComponent,
	DropdownComponent,
	ExtraButtonComponent,
	Menu,
	Notice,
	Platform,
	TextComponent,
} from "obsidian";
import { DescriptionModal } from "./secondary_modals";
import {
	conditionalEnable,
	getEmojiForGroup,
	getIndexFromSelectedGroup,
	groupNotEmpty,
	openDirectoryInFileManager,
	reset,
	rmvAllGroupsFromPlugin,
	sortByName,
	sortSwitched,
} from "./modal_utils";
import { removeItem } from "./utils";
import { CPModal } from "./community-plugins_modal";

//addHeader /////////////////////////////////

export const mostSwitchedResetButton = (
	modal: QPSModal,
	contentEl: HTMLElement
) => {
	const { settings } = modal.plugin;
	if (
		settings.filters === Filters.MostSwitched &&
		settings.allPluginsList.some((plugin) => plugin.switched !== 0)
	) {
		new ExtraButtonComponent(contentEl)
			.setIcon("reset")
			.setTooltip("Reset mostSwitched values")
			.onClick(async () => {
				reset(modal);
				modal.onOpen();
			});
	}
};

export const filterByGroup = (modal: QPSModal, contentEl: HTMLElement) => {
	const { plugin } = modal;
	const { settings } = plugin;
	if (settings.filters === Filters.ByGroup) {
		const dropdownOptions: { [key: string]: string } = {};
		// set dropdownOptions
		for (const groupKey in Groups) {
			const groupIndex = getIndexFromSelectedGroup(groupKey);
			if (groupKey === "SelectGroup") {
				dropdownOptions[groupKey] =
					Groups[groupKey] + `(${plugin.lengthAll})`;
			} else if (groupNotEmpty(groupIndex, modal)) {
				dropdownOptions[groupKey] =
					getEmojiForGroup(groupIndex).emoji + Groups[groupKey];
			}
		}
		// if a group is empty get back dropdown to SelectGroup

		new DropdownComponent(contentEl)
			.addOptions(dropdownOptions)
			.setValue(settings.selectedGroup as string)
			.onChange(async (value: QPSSettings["selectedGroup"]) => {
				settings.selectedGroup = value;
				await plugin.saveSettings();
				modal.onOpen();
			});
	}
};

export const powerButton = (modal: QPSModal, el: HTMLSpanElement) => {
	const { plugin } = modal;
	const { settings } = plugin;
	new ButtonComponent(el)
		.setIcon("download-cloud")
		.setCta()
		.setTooltip("community plugins")
		.buttonEl.addEventListener("click", (evt: MouseEvent) => {
			// modal.close() //à voir
			new CPModal(app, plugin).open();
		});
	new ButtonComponent(el)
		.setIcon("power")
		.setCta()
		.setTooltip("toggle plugins options")
		.buttonEl.addEventListener("click", (evt: MouseEvent) => {
			const menu = new Menu();
			if (
				plugin.lengthEnabled === 1 &&
				settings.wasEnabled.length === 0
			) {
				menu.addItem((item) => item.setTitle("No enabled plugins"));
			} else {
				menu.addItem((item) =>
					item
						.setTitle(
							settings.wasEnabled.length > 0
								? "Enable previous disabled plugins"
								: "Disable all plugins"
						)
						.setIcon(
							settings.wasEnabled.length > 0
								? "power"
								: "power-off"
						)
						.onClick(async () => {
							// disable all except this plugin
							if (plugin.lengthEnabled > 1) {
								for (const i of settings.allPluginsList) {
									if (i.id === "quick-plugin-switcher")
										continue;
									if (i.enabled)
										settings.wasEnabled.push(i.id);
									await (
										modal.app as any
									).plugins.disablePluginAndSave(i.id);
									i.enabled = false;
								}
								plugin.getLength();
								modal.onOpen();
								await plugin.saveSettings();
								new Notice("All plugins disabled", 1500);
							} else if (settings.wasEnabled.length > 0) {
								for (const i of settings.wasEnabled) {
									//check plugin not deleted between
									const pluginToUpdate =
										settings.allPluginsList.find(
											(plugin) => plugin.id === i
										);
									if (pluginToUpdate) {
										await conditionalEnable(
											modal,
											pluginToUpdate
										);
										pluginToUpdate.enabled = true;
									}
								}
								plugin.getLength();
								modal.onOpen();
								settings.wasEnabled = [];
								new Notice("All plugins re-enabled", 1500);
								await modal.plugin.saveSettings();
							}
						})
				);
				if (settings.wasEnabled.length > 0) {
					menu.addItem((item) =>
						item
							.setTitle("Skip re-enable")
							.setIcon("reset")
							.onClick(async () => {
								const confirmReset = await confirm(
									"reset to disable",
									300
								);
								if (confirmReset) {
									settings.wasEnabled = [];
									await modal.plugin.saveSettings();
									new Notice("Done", 1500);
								} else {
									new Notice("Operation cancelled", 1000);
								}
							})
					);
				}

				menu.addSeparator();
				menu.addItem((item) =>
					item
						.setTitle("Toggle enabled-plugins by group")
						.setDisabled(true)
				);

				Object.keys(Groups).forEach((groupKey) => {
					if (groupKey === "SelectGroup") return;
					const groupValue = Groups[groupKey as keyof typeof Groups];
					const groupIndex = getIndexFromSelectedGroup(groupKey);
					const inGroup = settings.allPluginsList.filter((plugin) => {
						return (
							plugin.groupInfo.groupIndices?.indexOf(
								groupIndex
							) !== -1
						);
					});
					let previousWasEnabled = inGroup.filter(
						(i) => i.groupInfo.groupWasEnabled === true
					);

					if (
						inGroup.length > 0 &&
						(inGroup.some((i) => i.enabled === true) ||
							previousWasEnabled.length > 0)
					) {
						menu.addItem((item) =>
							item
								.setTitle(
									previousWasEnabled.length > 0
										? `re-enable ${groupValue}`
										: groupValue
								)
								.setIcon(
									previousWasEnabled.length > 0
										? "power"
										: "power-off"
								)
								.onClick(async () => {
									if (previousWasEnabled.length === 0) {
										const toDisable = inGroup
											.filter((i) => i.enabled === true)
											.map(async (i) => {
												i.groupInfo.groupWasEnabled =
													true;
												await (
													modal.app as any
												).plugins.disablePluginAndSave(
													i.id
												);
												i.enabled = false;
											});
										await Promise.all(toDisable);
										if (toDisable) {
											plugin.getLength();
											modal.onOpen();
											new Notice(
												"All plugins disabled",
												1500
											);
											await modal.plugin.saveSettings();
										}
									} else {
										for (const i of previousWasEnabled) {
											await conditionalEnable(modal, i);
											i.enabled = true;
											i.switched++;
										}
										previousWasEnabled.map((plugin) => {
											plugin.groupInfo.groupWasEnabled =
												false;
										});
										plugin.getLength();
										modal.onOpen();
										new Notice(
											"All plugins re-enabled",
											1500
										);
									}
								})
						);
						if (previousWasEnabled.length > 0) {
							menu.addItem((item) =>
								item
									.setTitle("Skip re-enable")
									.setIcon("reset")
									.onClick(async () => {
										const confirmReset = await confirm(
											"skip re-enable ?",
											200
										);
										if (confirmReset) {
											previousWasEnabled.map((plugin) => {
												plugin.groupInfo.groupWasEnabled =
													false;
											});
											await modal.plugin.saveSettings();
											new Notice("Done", 1000);
										} else {
											new Notice(
												"Operation cancelled",
												1000
											);
										}
									})
							);
						}
					}
				});
			}
			menu.showAtMouseEvent(evt);
		});
};

export const modeSort = (plugin: Plugin, listItems: PluginInfo[]) => {
	const { settings } = plugin;
	// after reset MostSwitched
	if (plugin.reset) {
		const allPluginsList = settings.allPluginsList;
		allPluginsList.forEach((i) => {
			i.switched = 0;
		});
		plugin.reset = false;
	}
	// EnabledFirst
	if (settings.filters === Filters.EnabledFirst) {
		const enabledItems = listItems.filter((i) => i.enabled);
		const disabledItems = listItems.filter((i) => !i.enabled);
		sortByName(enabledItems);
		sortByName(disabledItems);
		listItems = [...enabledItems, ...disabledItems];
	}
	// ByGroup
	else if (settings.filters === Filters.ByGroup) {
		const groupIndex = getIndexFromSelectedGroup(
			settings.selectedGroup as string
		); //marche pas?
		if (groupIndex !== 0) {
			const groupedItems = listItems.filter((i) => {
				return i.groupInfo.groupIndices?.indexOf(groupIndex) !== -1;
			});
			listItems = groupedItems;
			sortByName(listItems);
		} else {
			sortByName(listItems);
		}
	}
	// MostSwitched
	else if (settings.filters === Filters.MostSwitched) {
		// && !plugin.reset
		sortByName(listItems);
		sortSwitched(listItems);
	}
	// All
	else {
		sortByName(listItems);
	}

	return listItems;
};

export const itemToggleClass = (
	modal: QPSModal,
	pluginItem: PluginInfo,
	itemContainer: HTMLDivElement
) => {
	const { settings } = modal.plugin;
	if (pluginItem.id === "quick-plugin-switcher") {
		itemContainer.toggleClass("qps-quick-plugin-switcher", true);
	}
	if (pluginItem.desktopOnly === true) {
		itemContainer.addClass("qps-desktop-only");
	}
	if (
		settings.filters === Filters.MostSwitched &&
		pluginItem.switched !== 0
	) {
		itemContainer.toggleClass("qps-most-switched", true);
	}
	if (pluginItem.delayed) {
		itemContainer.toggleClass("toggle-bullet-color", true);
		itemContainer.style.setProperty(
			"--bullet-content",
			`"${pluginItem.time}"`
		);
	}
};

function hasKeyStartingWith(obj: Record<string, any>, prefix: string): boolean {
	for (const key in obj) {
		if (key.startsWith(prefix)) {
			return true;
		}
	}
	return false;
}

export const itemTextComponent = (
	pluginItem: PluginInfo,
	itemContainer: HTMLDivElement
) => {
	let customValue = pluginItem.name;
	if (pluginItem.desktopOnly) {
		customValue = "\u1D30" + customValue;
	}

	const text = new TextComponent(itemContainer).setValue(customValue).inputEl;

	return text;
};

function addRemoveItemGroupMenuItems(
	modal: QPSModal,
	submenu: Menu,
	plugin: Plugin,
	pluginItem: PluginInfo
) {
	const { settings } = plugin;
	Object.keys(Groups).forEach((groupKey) => {
		const { lengthGroup, groupIndex, groupValue } = getGroupIndexLength(
			settings,
			groupKey
		);
		const getGroup =
			pluginItem.groupInfo.groupIndices?.indexOf(groupIndex) !== -1;
		if (groupKey !== "SelectGroup" && lengthGroup && getGroup) {
			submenu.addItem((subitem) => {
				subitem.setTitle(`${groupValue}`).onClick(async () => {
					for (const index of pluginItem.groupInfo.groupIndices) {
						if (index === groupIndex) {
							removeItem(
								pluginItem.groupInfo.groupIndices,
								index
							);
							if (!groupNotEmpty(groupIndex, modal)) {
								settings.selectedGroup = "SelectGroup";
							}
							break;
						}
					}
					modal.onOpen();
				});
			});
		}
	});
}

const getGroupIndexLength = (settings: QPSSettings, groupKey: string) => {
	const groupIndex = getIndexFromSelectedGroup(groupKey);
	const lengthGroup = settings.allPluginsList.filter(
		(i) => i.groupInfo.groupIndices?.indexOf(groupIndex) !== -1
	).length;
	const groupValue = Groups[groupKey as keyof typeof Groups];

	return { groupIndex, lengthGroup, groupValue };
};

function addRemoveGroupMenuItems(
	modal: QPSModal,
	submenu: Menu,
	plugin: Plugin
) {
	const { settings } = plugin;
	Object.keys(Groups).forEach((groupKey) => {
		const { lengthGroup, groupIndex, groupValue } = getGroupIndexLength(
			settings,
			groupKey
		);
		if (groupKey !== "SelectGroup" && lengthGroup) {
			submenu.addItem((subitem) => {
				subitem.setTitle(`${groupValue}`).onClick(async () => {
					let pluginsRemoved = false;
					for (const i of settings.allPluginsList) {
						const index =
							i.groupInfo.groupIndices?.indexOf(groupIndex);
						if (index !== -1) {
							i.groupInfo.groupIndices?.splice(index, 1);
							pluginsRemoved = true;
						}
					}
					modal.onOpen();
					if (pluginsRemoved) {
						new Notice(`All plugins removed from ${groupValue}`);
					} else {
						new Notice(`No plugins found in ${groupValue} group`);
					}
				});
			});
		}
	});
}

const addToGroupSubMenu = (
	submenu: Menu,
	pluginItem: PluginInfo,
	modal: QPSModal
) => {
	Object.entries(Groups).forEach(([key, value]) => {
		const groupIndices = pluginItem.groupInfo.groupIndices;
		const groupIndex = getIndexFromSelectedGroup(key);
		if (key !== "SelectGroup") {
			submenu.addItem((item) =>
				item
					.setTitle(value)
					.setDisabled(groupIndices.indexOf(groupIndex) !== -1)
					.onClick(() => {
						if (groupIndices.length === 6) return;
						groupIndices?.push(groupIndex);
						modal.onOpen();
					})
			);
		}
	});
};

const pluginFeatureSubmenu = (
	submenu: Menu,
	pluginItem: PluginInfo,
	modal: QPSModal
) => {
	submenu.addItem((item) =>
		item
			.setTitle("Plugin infos (i)")
			.setIcon("text")
			.onClick(() => {
				new DescriptionModal(
					modal.plugin.app,
					modal.plugin,
					pluginItem
				).open();
			})
	);

	submenu.addItem(
		(
			item // TODO
		) =>
			item
				.setTitle("Plugin github (g)")
				.setIcon("github")
				.onClick(() => {
					openGitHubRepo(pluginItem);
				})
	);

	const pluginSettings = (modal.app as any).setting.openTabById(
		pluginItem.id
	);
	submenu.addSeparator();
	submenu.addItem((item) =>
		item
			.setTitle("Plugin settings (s)")
			.setIcon("settings")
			.setDisabled(!pluginSettings)
			.onClick(async () => {
				await openPluginSettings(modal, pluginSettings);
			})
	);

	// helped by hotkey-helper code, even if it is extremly simplified
	const pluginCommands = (modal.app as any).setting.openTabById(pluginItem.id)
		?.app?.commands.commands;
	const condition = getCondition(modal, pluginItem);
	submenu.addItem((item) =>
		item
			.setTitle("Modify hotkeys (h)")
			.setIcon("plus-circle")
			.setDisabled(!condition)
			.onClick(async () => {
				showHotkeysFor(pluginItem, condition);
			})
	);
};

export async function openPluginSettings(modal: QPSModal, pluginSettings: any) {
	if (!pluginSettings) {
		new Notice("No settings on this plugin");
		return;
	}
	await (modal.app as any).setting.open();
	await pluginSettings?.display();
}

export const showHotkeysFor = async function (
	pluginItem: PluginInfo,
	condition: boolean
) {
	if (!condition) {
		new Notice("No HotKeys on this plugin");
		return;
	}
	await (this.app as any).setting.open();
	await (this.app as any).setting.openTabById("hotkeys");
	const tab = await (this.app as any).setting.activeTab;
	tab.searchComponent.inputEl.value = pluginItem.name + ":";
	tab.updateHotkeyVisibility();
	tab.searchComponent.inputEl.blur();
};

export const getCondition = function (
	modal: QPSModal | CPModal,
	pluginItem: PluginInfo | Record<string, string>
) {
	const pluginCommands = (modal.app as any).setting.openTabById(pluginItem.id)
		?.app?.commands.commands;
	return pluginCommands && hasKeyStartingWith(pluginCommands, pluginItem.id);
};

export async function openGitHubRepo(plugin: PluginInfo|PluginCommInfo) {
	if ("repo" in plugin) {
		const repoURL = `https://github.com/${plugin.repo}`;
		window.open(repoURL, "_blank"); // open
	} else {
		try {
			const response = await fetch(
				"https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json"
			);
			const pluginsData: Array<any> = await response.json();

			const pluginData = pluginsData.find(
				(item) => item.id === plugin.id
			);
			if (pluginData && pluginData.repo) {
				const repoURL = `https://github.com/${pluginData.repo}`;
				window.open(repoURL, "_blank"); // open browser in new tab
			} else {
				console.debug("Repo not found for the plugin.");
				try {
					const repoURL = `https://github.com/${plugin.author}/${plugin.id}`;
					window.open(repoURL, "_blank");
				} catch {
					const repoURL = `https://github.com/${plugin.author}`;
					window.open(repoURL, "_blank");
					console.debug("Repo not found for the plugin.");
				}
			}
		} catch (error) {
			console.error("Error fetching plugin data:", error);
		}
	}
}

export const searchDivButtons = (
	modal: QPSModal,
	contentEl: HTMLElement
): void => {
	// toggle plugin options
	const span = contentEl.createEl(
		"span",
		{
			cls: "qps-toggle-plugins",
		},
		(el) => powerButton(modal, el)
	);
};

export function handleContextMenu(evt: MouseEvent, modal: QPSModal) {
	if (modal.mousePosition) {
		const elementFromPoint = document.elementFromPoint(
			modal.mousePosition.x,
			modal.mousePosition.y
		);
		const targetBlock = elementFromPoint?.closest(
			".qps-item-line"
		) as HTMLElement;

		if (targetBlock) {
			const itemName = (targetBlock.children[1] as HTMLInputElement)
				.value;
			const matchingItem = modal.plugin.settings.allPluginsList.find(
				(item) => item.name === itemName
			);

			if (matchingItem) {
				const {plugin} = modal
				evt.preventDefault();
				const menu = new Menu();
				if (Platform.isDesktopApp) {
					menu.addItem((item) =>
						item
							.setTitle("Plugin folder (f)")
							.setIcon("folder-open")
							.onClick(() => {
								openDirectoryInFileManager(modal, matchingItem);
							})
					);
				}
				menu.addItem((item) => {
					item.setTitle("Plugin features").setIcon("package-plus");
					const submenu = (item as any).setSubmenu() as Menu;
					pluginFeatureSubmenu(submenu, matchingItem, modal);
				});

				if (matchingItem.id !== "quick-plugin-switcher") {
					menu.addSeparator();
					menu.addItem((item) => {
						item.setTitle("Add to group").setIcon("user");
						const submenu = (item as any).setSubmenu() as Menu;
						addToGroupSubMenu(submenu, matchingItem, modal);
					});
					menu.addItem((item) => {
						item.setTitle("Remove from group").setIcon(
							"user-minus"
						);
						const submenu = (item as any).setSubmenu() as Menu;
						submenu.addItem((subitem) => {
							subitem
								.setTitle("All groups")
								.setDisabled(
									matchingItem.groupInfo.groupIndices
										.length === 0
								)
								.onClick(async () => {
									const groupIndices =
										matchingItem.groupInfo.groupIndices;
									rmvAllGroupsFromPlugin(modal, matchingItem);
								});
						});
						addRemoveItemGroupMenuItems(
							modal,
							submenu,
							plugin,
							matchingItem
						);
					}).addSeparator();
					menu.addItem((item) => {
						item.setTitle("Clear items groups").setIcon(
							"user-minus"
						);

						const submenu = (item as any).setSubmenu() as Menu;
						submenu.addItem((subitem) => {
							subitem.setTitle("All groups").onClick(async () => {
								const confirmReset = await confirm(
									"Detach all groups from all plugins?",
									300
								);
								if (confirmReset) {
									for (const i of plugin.settings
										.allPluginsList) {
										i.groupInfo.groupIndices = [];
									}
									modal.onOpen();
									new Notice("Done", 1000);
								} else {
									new Notice("Operation cancelled", 1000);
								}
							});
						});
						addRemoveGroupMenuItems(modal, submenu, plugin);
					});
				}
				menu.showAtMouseEvent(evt);
			}
		}
	}
}
