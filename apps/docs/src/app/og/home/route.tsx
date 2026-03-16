import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from '@takumi-rs/image-response'

export const revalidate = false

const logoData = readFile(join(process.cwd(), 'public/logo.png')).then(
  (buf) => `data:image/png;base64,${buf.toString('base64')}`,
)

function HomeOGImage({ logoSrc }: { logoSrc: string }) {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        backgroundColor: '#121212',
        color: 'white',
      }}
    >
      {/* Left edge accent bars */}
      <div style={{ display: 'flex', flexDirection: 'row', height: '100%' }}>
        <div
          style={{
            width: 28,
            height: '100%',
            backgroundColor: '#92400E',
            opacity: 0.5,
          }}
        />
        <div
          style={{
            width: 20,
            height: '100%',
            backgroundColor: '#B45309',
            opacity: 0.7,
          }}
        />
        <div
          style={{
            width: 14,
            height: '100%',
            backgroundColor: '#D97706',
            opacity: 0.85,
          }}
        />
        <div style={{ width: 8, height: '100%', backgroundColor: '#F59E0B' }} />
      </div>

      {/* Content area */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          flex: 1,
          padding: '0 60px 0 48px',
        }}
      >
        {/* Scope — muted, smaller */}
        <div style={{ fontSize: 36, fontWeight: 500, color: '#A8A29E' }}>
          @b3nab/
        </div>

        {/* Package name — bold, large */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: '#FFFFFF',
            marginBottom: 40,
          }}
        >
          payload-hypervalue
        </div>

        {/* Tagline */}
        <div style={{ fontSize: 36, fontWeight: 400, color: '#78716C' }}>
          the history layer for payload cms
        </div>
      </div>

      {/* Logo mark — right side, vertically centered */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingRight: 60,
        }}
      >
        <img src={logoSrc} alt="" width={160} height={160} />
      </div>
    </div>
  )
}

export async function GET() {
  const logoSrc = await logoData

  return new ImageResponse(<HomeOGImage logoSrc={logoSrc} />, {
    width: 1200,
    height: 630,
    format: 'webp',
  })
}
