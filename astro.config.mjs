import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import AstroPWA from '@vite-pwa/astro';

// https://astro.build/config
export default defineConfig({
    site: 'https://tuitionscheduler.github.io',
    base: '/blog',
    vite: {
        logLevel: 'info',
        define: {
            __DATE__: `'${new Date().toISOString()}'`
        },
        server: {
            fs: {
                // Allow serving files from hoisted root node_modules
                allow: ['../..']
            }
        }
    },
    integrations: [
        mdx(),
        sitemap(),
        tailwind({
            applyBaseStyles: false
        }),
        AstroPWA({
            includeAssets: ['blog.svg'],
            registerType: 'autoUpdate',
            manifest: {
                name: 'Matrical Blog',
                short_name: 'mBlog',
                theme_color: '#ffffff',
                icons: [
                    {
                        src: 'blog-256.png',
                        sizes: '256x256',
                        type: 'image/png'
                    },
                    {
                        src: 'blog-512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: 'blog-1024.png',
                        sizes: '1024x1024',
                        type: 'image/png'
                    }
                ]
            },
            workbox: {
                navigateFallback: '/blog',
                globPatterns: ['**/*.{css,js,html,svg,png,ico,txt}']
            },
            devOptions: {
                enabled: true,
                navigateFallbackAllowlist: [/^\/blog\/?$/, /^\/blog\/(?!api\/)(?!_image\/)(?!_astro\/).+/]
            },
            experimental: {
                directoryAndTrailingSlashHandler: true
            }
        })
    ]
});
