/** Per-visitor UI memory (platform and app choice). Storage may be unavailable — never throw. */
const KEY = 'spofy.subpage.prefs'

interface IPrefs {
    apps?: Record<string, string>
    platform?: string
}

function read(): IPrefs {
    try {
        const raw = localStorage.getItem(KEY)
        return raw ? (JSON.parse(raw) as IPrefs) : {}
    } catch {
        return {}
    }
}

function write(prefs: IPrefs) {
    try {
        localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {
        // private mode / blocked storage: the page works without memory
    }
}

export const prefs = {
    platform: () => read().platform,
    app: (platform: string) => read().apps?.[platform],
    setPlatform: (platform: string) => write({ ...read(), platform }),
    setApp: (platform: string, app: string) => {
        const current = read()
        write({ ...current, apps: { ...current.apps, [platform]: app } })
    }
}
