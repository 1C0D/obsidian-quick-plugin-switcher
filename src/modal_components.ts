import {
	CommFilters,
	Filters,
	GroupData,
	Groups,
	GroupsComm,
	PluginCommInfo,
	PluginInfo,
	QPSSettings,
} from "./types";
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
	SearchComponent,
	Setting,
	TextComponent,
} from "obsidian";
import { DescriptionModal } from "./secondary_modals";
import {
	conditionalEnable,
	createInput,
	getEmojiForGroup,
	getIndexFromSelectedGroup,
	getPluginsInGroup,
	groupNotEmpty,
	isInstalled,
	openDirectoryInFileManager,
	reset,
	rmvAllGroupsFromPlugin,
	sortByName,
	sortSwitched,
} from "./modal_utils";
import { isEnabled, removeItem } from "./utils";
import { CPModal, getManifest } from "./community-plugins_modal";

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
				await modal.onOpen();
			});
	}
};

export const byGroupDropdowns = (
	modal: QPSModal | CPModal,
	contentEl: HTMLElement
) => {
	const { plugin } = modal;
	const { settings } = plugin;

	if (modal instanceof QPSModal && settings.filters === Filters.ByGroup) {
		getDropdownOptions(Groups, plugin.lengthAll);
	} else if (
		modal instanceof CPModal &&
		settings.filtersComm === CommFilters.ByGroup
	) {
		getDropdownOptions(GroupsComm, settings.commPlugins.length);
	}

	function getDropdownOptions(groups: GroupData, length: number) {
		const dropdownOptions: Record<string, string> = {};
		for (const groupKey in groups) {
			const groupIndex = getIndexFromSelectedGroup(groupKey);
			if (groupKey === "SelectGroup") {
				dropdownOptions[groupKey] = groups[groupKey] + `(${length})`;
			} else if (groupNotEmpty(groupIndex, modal)) {
				dropdownOptions[groupKey] =
					getEmojiForGroup(groupIndex).emoji + groups[groupKey];
			}
		}
		new DropdownComponent(contentEl)
			.addOptions(dropdownOptions)
			.setValue(settings.selectedGroup as string)
			.onChange(async (value) => {
				settings.selectedGroup = value;
				await plugin.saveSettings();
				modal.searchInit = false;
				await modal.onOpen();
			});
	}
};

export async function addSearch(
	modal: CPModal | QPSModal,
	contentEl: HTMLElement,
	pluginsList: PluginCommInfo[] | PluginInfo[],
	placeholder: string
) {
	const { plugin } = modal;
	const { settings } = plugin;

	new Setting(contentEl)
		.addSearch(async (search: SearchComponent) => {
			search
				.setValue(settings.search)
				.setPlaceholder(placeholder)
				.onChange(async (value: string) => {
					settings.search = value;
					modal.items.empty();
					modal.addItems();
					// await plugin.saveSettings();
				});
		})
		.setClass("qps-search-component");
}

export function doSearch(
	modal: QPSModal | CPModal,
	value: string,
	pluginsList: PluginCommInfo[] | PluginInfo[]
) {
	const lowerCaseValue = value.toLowerCase();
	return pluginsList.filter((item) =>
		[
			item.name,
			modal instanceof QPSModal
				? "" //don't search
				: (item as PluginCommInfo).description,
			item.author,
		].some((prop) => prop.toLowerCase().includes(lowerCaseValue))
	);
}

export const commButton = (modal: QPSModal, el: HTMLSpanElement) => {
	const { plugin } = modal;
	new ButtonComponent(el)
		.setIcon("download-cloud")
		.setCta()
		.setTooltip("community plugins")
		.buttonEl.addEventListener("click", (evt: MouseEvent) => {
			modal.close();
			new CPModal(app, plugin).open();
		});
};

export const powerButton = (modal: QPSModal, el: HTMLSpanElement) => {
	const { plugin } = modal;
	const { settings } = plugin;
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
								await modal.onOpen();
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
								await modal.onOpen();
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
											await modal.onOpen();
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
										await modal.onOpen();
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
		);
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

export const editGroupName = (
	modal: CPModal | QPSModal,
	span: HTMLSpanElement,
	groupNumber: number
) => {
	const { plugin } = modal;
	const { settings } = plugin;

	const currentValue =
		(modal instanceof CPModal
			? settings.groupsComm[groupNumber]?.name || ""
			: settings.groups[groupNumber]?.name) || "";

	const updateGroupName = (value: string) => {
		if (modal instanceof CPModal) {
			settings.groupsComm[groupNumber].name =
				value || GroupsComm[groupNumber];
			span.textContent = settings.groupsComm[groupNumber].name;
		} else {
			settings.groups[groupNumber].name = value || Groups[groupNumber];
			span.textContent = settings.groups[groupNumber].name;
		}
	};

	const handleBlurOrEnter = () => {
		setTimeout(async () => {
			if (!modal.isDblClick && input) {
				updateGroupName(input.value);
				if (modal instanceof CPModal) {
					await modal.onOpen();
				} else {
					await modal.onOpen();
				}
			}
		}, 200);
	};

	const input = createInput(span, currentValue);

	if (input) {
		input.addEventListener("blur", handleBlurOrEnter);
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				handleBlurOrEnter();
			}
		});
	}
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
							await plugin.saveSettings();
							if (!groupNotEmpty(groupIndex, modal)) {
								settings.selectedGroup = "SelectGroup";
							}
							break;
						}
					}
					await modal.onOpen();
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

function addRemoveGroupMenuItems(modal: QPSModal, submenu: Menu) {
	const { plugin } = modal;
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
					await plugin.saveSettings();
					await modal.onOpen();
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
					.onClick(async () => {
						if (groupIndices.length === 6) return;
						groupIndices?.push(groupIndex);
						await modal.onOpen();
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

export async function openGitHubRepo(plugin: PluginInfo | PluginCommInfo) {
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
		(el) => {
			commButton(modal, el);
			powerButton(modal, el);
		}
	);
};

export function handleDblClick(evt: MouseEvent, modal: QPSModal | CPModal) {
	const elementFromPoint = getElementFromMousePosition(evt, modal);
	const targetGroup = elementFromPoint?.closest(
		".qps-groups-name"
	) as HTMLElement;

	const groupName = targetGroup?.textContent;
	const groupNumber = parseInt(groupName?.match(/\((\d+)\)$/)?.[1] as string);
	editGroupName(modal, targetGroup, groupNumber);
}

export function handleContextMenu(evt: MouseEvent, modal: QPSModal | CPModal) {
	const elementFromPoint = getElementFromMousePosition(evt, modal);
	let targetBlock, targetGroup;

	targetGroup = elementFromPoint?.closest(".qps-groups-name") as HTMLElement;

	if (!targetGroup) {
		if (modal instanceof QPSModal) {
			targetBlock = elementFromPoint?.closest(
				".qps-item-line"
			) as HTMLElement;
		} else {
			targetBlock = elementFromPoint?.closest(
				".qps-comm-block"
			) as HTMLElement;
		}
	}

	const groupName = targetGroup?.textContent;
	const groupNumber = parseInt(groupName?.match(/\((\d+)\)$/)?.[1] as string);

	if (targetGroup) {
		groupMenu(evt, modal, groupNumber, targetGroup);
	}

	if (targetBlock) {
		if (modal instanceof QPSModal) {
			const matchingItem = findMatchingItem(modal, targetBlock);
			if (matchingItem) {
				contextMenuQPS(evt, modal, matchingItem as PluginInfo);
			}
		} else {
			const matchingItem = findMatchingItem(modal, targetBlock);
			if (matchingItem) {
				contextMenuCPM(evt, modal, matchingItem as PluginCommInfo);
			}
		}
	}
}

export function contextMenuCPM(
	evt: MouseEvent,
	modal: CPModal,
	matchingItem: PluginCommInfo
) {
	evt.preventDefault();
	const menu = new Menu();
	menu.addItem((item) => {
		item.setTitle("install plugin")
			.setDisabled(isInstalled(matchingItem))
			.setIcon("log-in")
			.onClick(async () => {
				const pluginInfo =
					modal.plugin.settings.pluginStats[matchingItem.id];
				let latestVersion;

				for (let i = Object.keys(pluginInfo).length - 1; i >= 0; i--) {
					const version = Object.keys(pluginInfo)[i];
					if (/^(v?\d+\.\d+\.\d+)$/.test(version)) {
						latestVersion = version;
						break;
					}
				}

				const manifest = await getManifest(matchingItem);
				await this.app.plugins.installPlugin(
					matchingItem.repo,
					latestVersion,
					manifest
				);
				await modal.onOpen();
			});
	});

	menu.addItem((item) => {
		item.setTitle("enable plugin")
			.setDisabled(
				!isInstalled(matchingItem) ||
					(isInstalled(matchingItem) &&
						isEnabled(modal, matchingItem.id))
			)
			.setIcon("power")
			.onClick(async () => {
				await (modal.app as any).plugins.enablePluginAndSave(
					matchingItem.id
				);
				new Notice(`${matchingItem.name} enabled`, 1000);
				// auto done when reopening other modal ^^
				// const pluginItem = modal.plugin.settings.allPluginsList;
				// for (const item of pluginItem) {
				// 	if (item.id === matchingItem.id) {
				// 		item.enabled = true;
				// 		await modal.plugin.saveSettings();
				// 		break;
				// 	}
				// }
			});
	});
	menu.addItem((item) => {
		item.setTitle("uninstall plugin")
			.setDisabled(!isInstalled(matchingItem))
			.setIcon("log-out")
			.onClick(async () => {
				await this.app.plugins.uninstallPlugin(matchingItem.id);
				await modal.onOpen();
			});
	});
	menu.showAtMouseEvent(evt);
}

function contextMenuQPS(
	evt: MouseEvent,
	modal: QPSModal,
	matchingItem: PluginInfo
) {
	const { plugin } = modal;
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
			item.setTitle("Remove from group").setIcon("user-minus");
			const submenu = (item as any).setSubmenu() as Menu;
			submenu.addItem((subitem) => {
				subitem
					.setTitle("All groups")
					.setDisabled(
						matchingItem.groupInfo.groupIndices.length === 0
					)
					.onClick(async () => {
						matchingItem.groupInfo.groupIndices;
						await rmvAllGroupsFromPlugin(modal, matchingItem);
					});
			});
			addRemoveItemGroupMenuItems(modal, submenu, plugin, matchingItem);
		});
	}
	menu.showAtMouseEvent(evt);
}

export function getElementFromMousePosition(
	evt: MouseEvent | KeyboardEvent,
	modal: QPSModal | CPModal
) {
	if (modal.mousePosition) {
		const elementFromPoint = document.elementFromPoint(
			modal.mousePosition.x,
			modal.mousePosition.y
		);
		return elementFromPoint;
	}
	return null;
}

export const groupMenu = (
	evt: MouseEvent,
	modal: QPSModal | CPModal,
	groupNumber: number,
	span?: HTMLSpanElement
) => {
	if (modal instanceof QPSModal && span) {
		groupMenuQPS(evt, modal, groupNumber, span);
	} else {
		groupMenuCPM(evt, modal as CPModal, groupNumber);
	}
};

const groupMenuQPS = (
	evt: MouseEvent,
	modal: QPSModal,
	groupNumber: number,
	span: HTMLSpanElement
) => {
	const { plugin } = modal;
	const { settings } = plugin;
	const inGroup = getPluginsInGroup(modal, groupNumber) as PluginInfo[];
	const menu = new Menu();
	menu.addItem((item) =>
		item.setTitle("delay group").onClick(() => {
			const currentValue = (
				settings.groups[groupNumber].time || 0
			).toString();
			const input = createInput(span, currentValue);
			if (!input) return;

			const handleBlurOrEnter = () => {
				setTimeout(async () => {
					if (!modal.isDblClick) {
						const value = parseInt(input.value) || 0;
						settings.groups[groupNumber].time = value;
						span.textContent = `${value}`;
						if (modal instanceof CPModal) {
							await modal.onOpen();
						} else if (modal instanceof QPSModal) {
							await modal.onOpen();
						}
					}
				}, 100);
			};

			input.addEventListener("blur", handleBlurOrEnter);
			input.addEventListener("keydown", (event) => {
				if (event.key === "Enter") {
					handleBlurOrEnter();
				}
			});
		})
	);

	menu.addItem((item) =>
		item
			.setTitle("apply")
			.setDisabled(
				!inGroup.length || settings.groups[groupNumber].time === 0
			)
			.onClick(async () => {
				for (const plugin of inGroup) {
					plugin.time = settings.groups[groupNumber].time;
					plugin.delayed = true;
					settings.groups[groupNumber].applied = true;
					if (plugin.enabled) {
						await (modal.app as any).plugins.disablePluginAndSave(
							plugin.id
						);
						await (modal.app as any).plugins.enablePlugin(
							plugin.id
						);
					}
					modal.plugin.saveSettings();
					await modal.onOpen();
				}
			})
	);
	menu.addItem((item) =>
		item
			.setTitle("reset")
			.setDisabled(
				!inGroup.length || settings.groups[groupNumber].time === 0
			)
			.onClick(async () => {
				for (const plugin of inGroup) {
					plugin.time = 0;
					plugin.delayed = false;
					settings.groups[groupNumber].applied = false;
					if (plugin.enabled) {
						await (modal.app as any).plugins.enablePluginAndSave(
							plugin.id
						);
					}
					await modal.onOpen();
				}
				plugin.saveSettings();
			})
	);
	menu.addSeparator();
	const toEnable = inGroup.filter((i: PluginInfo) => i.enabled === false);
	menu.addItem((item) =>
		item
			.setTitle("enable all plugins in group")
			.setDisabled(!inGroup.length || !toEnable.length)
			.onClick(async () => {
				if (toEnable) {
					await Promise.all(
						toEnable.map(async (i: PluginInfo) => {
							conditionalEnable(modal, i);
							i.enabled = true;
							modal.plugin.saveSettings();
						})
					);

					plugin.getLength();
					new Notice("All plugins enabled.");
					await modal.plugin.saveSettings();
					await modal.onOpen();
				}
			})
	);

	const toDisable = inGroup.filter((i: PluginInfo) => i.enabled === true);
	menu.addItem((item) =>
		item
			.setTitle("disable all plugins in group")
			.setDisabled(!inGroup.length || !toDisable.length)
			.onClick(async () => {
				if (toDisable) {
					await Promise.all(
						toDisable.map(async (i: PluginInfo) => {
							(modal.app as any).plugins.disablePluginAndSave(
								i.id
							);
							i.enabled = false;
						})
					);

					plugin.getLength();
					new Notice("All plugins disabled.");
					await modal.plugin.saveSettings();
					await modal.onOpen();
				}
			})
	);
	menu.addSeparator();
	createClearGroupsMenuItem(modal, menu);

	menu.showAtMouseEvent(evt);
};

const groupMenuCPM = (evt: MouseEvent, modal: CPModal, groupNumber: number) => {
	const menu = new Menu();
	menu.addItem((item) => {
		item.setTitle("install & enable in group");
		item.onClick(async () => {
			await installAllPluginsInGroup(modal, groupNumber, true);
		});
	});
	menu.addItem((item) => {
		item.setTitle("install plugins in group");
		item.onClick(async () => {
			await installAllPluginsInGroup(modal, groupNumber);
		});
	});
	menu.addItem((item) => {
		item.setTitle("uninstall plugins in group");
		item.onClick(async () => {
			await uninstallAllPluginsInGroup(modal, groupNumber);
		});
	});
	menu.addSeparator();
	menu.addItem((item) => {
		item.setTitle("clear group items");
	});

	menu.showAtMouseEvent(evt);
};

async function uninstallAllPluginsInGroup(modal: CPModal, groupNumber: number) {
	const inGroup = getPluginsInGroup(modal, groupNumber);

	if (!inGroup.length) return;

	for (const plugin of inGroup) {
		if (!isInstalled(plugin)) continue;
		await this.app.plugins.uninstallPlugin(plugin.id);
	}

	await modal.onOpen();
}

async function installAllPluginsInGroup(
	modal: CPModal,
	groupNumber: number,
	enable = false
) {
	const inGroup = getPluginsInGroup(modal, groupNumber) as PluginCommInfo[];

	if (!inGroup.length) return;

	for (const plugin of inGroup) {
		if (isInstalled(plugin)) continue;
		const manifest = await getManifest(plugin);
		const pluginInfo = modal.plugin.settings.pluginStats[plugin.id];
		let latestVersion;

		for (let i = Object.keys(pluginInfo).length - 1; i >= 0; i--) {
			const version = Object.keys(pluginInfo)[i];
			if (/^(v?\d+\.\d+\.\d+)$/.test(version)) {
				latestVersion = version;
				break;
			}
		}

		await this.app.plugins.installPlugin(
			plugin.repo,
			latestVersion,
			manifest
		);
		if (enable) {
			await (modal.app as any).plugins.enablePluginAndSave(plugin.id);
			new Notice(`${plugin.name} enabled`, 3500);
			// const pluginItem = modal.plugin.settings.allPluginsList;
			// for (const item of pluginItem) {
			// 	if (item.id === plugin.id) {
			// 		item.enabled = true;
			// 		await modal.plugin.saveSettings();
			// 		break;
			// 	}
			// }
		}
	}

	await modal.onOpen();
}

export const findMatchingItem = (
	modal: CPModal | QPSModal,
	targetBlock: HTMLElement
) => {
	if (modal instanceof QPSModal) {
		let itemName = (targetBlock.children[1] as HTMLInputElement).value;
		if (itemName.startsWith("ᴰ")) {
			itemName = itemName.substring(1);
		}
		const matchingItem = modal.plugin.settings.allPluginsList.find(
			(item) => item.name === itemName
		);

		return matchingItem;
	} else {
		const itemName = targetBlock.firstChild?.textContent;
		const cleanItemName = itemName?.replace(/installed$/, "").trim();
		const matchingItem = modal.plugin.settings.commPlugins.find(
			(item) => item.name === cleanItemName
		);
		return matchingItem;
	}
};

const createClearGroupsMenuItem = (modal: QPSModal, menu: Menu) => {
	menu.addItem((item) => {
		const { plugin } = modal;
		item.setTitle("Clear group(s)").setIcon("user-minus");

		const submenu = (item as any).setSubmenu() as Menu;
		submenu.addItem((subitem) => {
			subitem.setTitle("All groups").onClick(async () => {
				const confirmReset = await confirm(
					"Detach all groups from all plugins?",
					300
				);
				if (confirmReset) {
					for (const i of plugin.settings.allPluginsList) {
						i.groupInfo.groupIndices = [];
					}
					await plugin.saveSettings();
					await modal.onOpen();
					new Notice("Done", 1000);
				} else {
					new Notice("Operation cancelled", 1000);
				}
			});
		});
		addRemoveGroupMenuItems(modal, submenu);
	});
};
