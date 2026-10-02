const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Structural check of the Subpage Builder config, replacing the client-side zod parse.
 * The backend validates the full schema before it serves the config.
 */
export function isUsableConfig(config: unknown): boolean {
    if (!isObject(config)) return false
    return (
        Array.isArray(config.locales) &&
        config.locales.length > 0 &&
        isObject(config.platforms) &&
        isObject(config.svgLibrary) &&
        isObject(config.baseSettings) &&
        isObject(config.baseTranslations) &&
        isObject(config.brandingSettings) &&
        isObject(config.uiConfig)
    )
}
