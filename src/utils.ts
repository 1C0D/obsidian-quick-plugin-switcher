import { PluginInfo } from "./main"
import QuickPluginSwitcher from "./main"

export function debug(_this: QuickPluginSwitcher, where = "") {
    getExtMan(_this, "ext-to-vault", where)
    getExt(_this, "ext-to-vault")
}

export const getExt = (_this: QuickPluginSwitcher, pluginName: string) => {
    _this.settings.allPluginsList.map((i: PluginInfo) => {
        if (i.id === pluginName) {
            console.log("ext-to-vault in allPluginsList", ", enabled", i.enabled,
                "switched", i.switched)
        }
    })
}

export const getExtMan = (_this: QuickPluginSwitcher, pluginName: string, where = "") => {
    const manifestsKeys = Object.keys((_this.app as any).plugins.manifests)
    // console.log("manifestsKeys", manifestsKeys)
    const isIn = manifestsKeys.includes(pluginName)
    const isEn = _this.isEnabled(pluginName)
    console.log("From " + where + " ", "isInManifests", isIn, "enabled", isEn)
}