import Plugin from "./main"

export const getLength = (_this: Plugin) => {
    const { settings } = _this
    const allPluginsList = settings.allPluginsList || [];
    _this.lengthAll = allPluginsList.length
    _this.lengthEnabled = settings.allPluginsList.
        filter((plugin) => plugin.enabled).length
    _this.lengthDisabled = settings.allPluginsList.
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