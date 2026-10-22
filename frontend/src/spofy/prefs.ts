/** Per-visitor UI memory (platform and app choice). Storage may be unavailable — never throw. */
const KEY = 'spofy.subpage.prefs'

interface IPrefs {
    apps?: Record<string, string>
    platform?: string
    /** «ios:Happ» → indexes of the guide steps already done */
    steps?: Record<string, number[]>
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
    },
    steps: (key: string): number[] => {
        const value = read().steps?.[key]
        return Array.isArray(value) ? value.filter((n) => Number.isInteger(n)) : []
    },
    setSteps: (key: string, steps: number[]) => {
        const current = read()
        write({ ...current, steps: { ...current.steps, [key]: steps } })
    }
}
