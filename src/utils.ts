// refactoring needed
import Plugin from "./main";


export function isEnabled(name: string): boolean {
    return (this.app as any).plugins.enabledPlugins.has(name)
}

export const getLength = (_this: Plugin) => {    
    const allPluginsList = _this.settings.allPluginsList || [];
    _this.lengthAll = allPluginsList.length
    _this.lengthEnabled = _this.settings.allPluginsList.
        filter((plugin) => plugin.enabled).length
    _this.lengthDisabled = _this.settings.allPluginsList.
        filter((plugin) => !plugin.enabled).length
}

// for debug
export const debug = (_this: Plugin, pluginName = "", where = "") => {
    const manifestsKeys = Object.keys((_this.app as any).plugins.manifests);
    // const manifestsValues = Object.values(this.app.plugins.manifests);
    // if (manifestsValues) console.log("manifestsValues", manifestsValues);
    if (manifestsKeys) {
        console.log("manifestsKeys", manifestsKeys);
        if (pluginName) {
            const isIn = manifestsKeys.includes(pluginName);
            const isEn = isEnabled(pluginName);
            console.log("From " + where + " ", "isInManifests", isIn, "enabled", isEn);
        }
    }
}
