// import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator'
// import { visualizer } from 'rollup-plugin-visualizer'
// import deadFile from 'vite-plugin-deadfile'
import removeConsole from 'vite-plugin-remove-console'
import webfontDownload from 'vite-plugin-webfont-dl'
import { ViteEjsPlugin } from 'vite-plugin-ejs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import 'dotenv/config'

export default defineConfig({
    plugins: [
        react(),
        removeConsole(),
        webfontDownload(undefined, {}),
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
                    metaDescription: '<%= metaDescription %>',
                    metaTitle: '<%= metaTitle %>'
                }
            }
            return {
                root: viteConfig.root,
                panelData: process.env.PANEL_DATA,
                metaDescription: process.env.META_DESCRIPTION,
                metaTitle: process.env.META_TITLE
            }
        })
    ],
    optimizeDeps: {
        include: ['html-parse-stringify']
    },
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
                            name: 'date',
                            test: /node_modules[\\/]dayjs[\\/]/
                        },
                        {
                            name: 'react',
                            test: /node_modules[\\/](react|zustand|react-dom|react-router|react-error-boundary)[\\/]/
                        },
                        {
                            name: 'mantine',
                            test: /node_modules[\\/]@mantine[\\/](core|hooks|nprogress|notifications|modals)[\\/]/
                        },
                        {
                            name: 'i18n',
                            test: /node_modules[\\/](i18next-browser-languagedetector|@remnawave[\\/](backend-contract|subscription-page-types))[\\/]/
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
