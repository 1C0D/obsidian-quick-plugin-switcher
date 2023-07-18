import QuickPluginSwitcher from "./main";

// was usefull for debug
export const debug = (_this: QuickPluginSwitcher, pluginName = "", where = "") => {
    const manifestsKeys = Object.keys((_this.app as any).plugins.manifests);
    // const manifestsValues = Object.values(this.app.plugins.manifests);
    // if (manifestsValues) console.log("manifestsValues", manifestsValues);
    if (manifestsKeys) {
        console.log("manifestsKeys", manifestsKeys);
        if (pluginName) {
            const isIn = manifestsKeys.includes(pluginName);
            const isEn = _this.isEnabled(pluginName);
            console.log("From " + where + " ", "isInManifests", isIn, "enabled", isEn);
        }
    }
}
