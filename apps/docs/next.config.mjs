import { createRequire } from 'node:module'
import { createMDX } from 'fumadocs-mdx/next'

const require = createRequire(import.meta.url)
const { version } = require('../../packages/payload-hypervalue/package.json')

const latestVersion = `v${version}`

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  serverExternalPackages: ['@takumi-rs/image-response', 'lightningcss'],
  reactStrictMode: true,
  env: {
    LATEST_VERSION: latestVersion,
  },
  async rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/docs/:path*',
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/docs',
        destination: '/docs/latest/introduction',
        permanent: false,
      },
    ]
  },
}

export default withMDX(config)
