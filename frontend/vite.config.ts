import removeConsole from 'vite-plugin-remove-console'
import { ViteEjsPlugin } from 'vite-plugin-ejs'
import react from '@vitejs/plugin-react'
import { defineConfig, Plugin } from 'vite'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import path from 'node:path'
import 'dotenv/config'

/** Maximum-strength .br and .gz next to each asset; the backend serves them as they are. */
function precompress(): Plugin {
    let outDir = ''
    return {
        name: 'spofy-precompress',
        apply: 'build',
        configResolved: (config) => {
            outDir = path.join(config.root, config.build.outDir, 'assets')
        },
        closeBundle: () => {
            for (const name of readdirSync(outDir, { recursive: true }) as string[]) {
                if (!/\.(js|css|svg)$/.test(name)) continue
                const file = path.join(outDir, name)
                const source = readFileSync(file)
                if (source.length < 1024) continue
                writeFileSync(`${file}.br`, brotliCompressSync(source))
                writeFileSync(`${file}.gz`, gzipSync(source, { level: 9 }))
            }
        }
    }
}

export default defineConfig({
    plugins: [
        react(),
        removeConsole(),
        precompress(),
        ViteEjsPlugin((viteConfig) => {
            if (process.env.NODE_ENV === 'production') {
                // These literal strings BECOME the runtime template tags in the built
                // index.html: the backend EJS-renders the artifact on every request. They
                // must keep the escaped interpolation (`<%=`) for panel-provided meta
                // values — switching them to raw `<%-` would open an attribute-breakout
                // XSS, and switching the source tags to `<%=` breaks this very build.
                return {
                    root: viteConfig.root,
                    panelData: '<%- panelData %>',
                    configVersion: '<%= configVersion %>',
                    offerHref: '<%= offerHref %>',
                    metaDescription: '<%= metaDescription %>',
                    metaTitle: '<%= metaTitle %>'
                }
            }
            return {
                root: viteConfig.root,
                panelData: process.env.PANEL_DATA,
                configVersion: '',
                offerHref: '',
                metaDescription: process.env.META_DESCRIPTION,
                metaTitle: process.env.META_TITLE
            }
        })
    ],
    build: {
        target: 'esnext',
        outDir: 'dist',
        rollupOptions: {
            output: {
                codeSplitting: {
                    groups: [
                        {
                            name: 'icons',
                            test: /node_modules[\\/](react-icons|@tabler[\\/]icons-react)[\\/]/
                        },
                        {
                            name: 'react',
                            test: /node_modules[\\/](react|zustand|react-dom|react-error-boundary|clsx|scheduler)[\\/]/
                        },
                        {
                            name: 'mantine',
                            // .js only: a CSS file caught here would make the entry depend on this chunk
                            test: /node_modules[\\/]@mantine[\\/](core|hooks)[\\/].*\.m?js$/
                        },
                        {
                            name: 'i18n',
                            test: /node_modules[\\/](@remnawave[\\/](backend-contract|subscription-page-types))[\\/]/
                        }
                    ]
                }
            }
        }
    },
    server: {
        host: '0.0.0.0',
        port: 3334,
        cors: false,
        strictPort: true,
        allowedHosts: true
    },
    resolve: { tsconfigPaths: true }
})
