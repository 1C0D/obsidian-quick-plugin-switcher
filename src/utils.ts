import Plugin from "./main"

export const getLength = (_this: Plugin) => {
    const { settingS } = _this
    const allPluginsList = settingS.allPluginsList || [];
    _this.lengthAll = allPluginsList.length
    _this.lengthEnabled = settingS.allPluginsList.
        filter((plugin) => plugin.enabled).length
    _this.lengthDisabled = settingS.allPluginsList.
        filter((plugin) => !plugin.enabled).length
}

export function isEnabled(name: string): boolean {
    return (this.app as any).plugins.enabledPlugins.has(name)
}

export function removeItem<T>(arr: Array<T>, value: T): Array<T> {
    const index = arr.indexOf(value);
    if (index > -1) {
        arr.splice(index, 1);
    }
    return arr;
}