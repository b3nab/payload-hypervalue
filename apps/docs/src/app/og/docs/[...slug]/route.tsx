import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from '@takumi-rs/image-response'
import { notFound } from 'next/navigation'
import { getPageImage, source } from '@/lib/source'

export const revalidate = false

const logoData = readFile(join(process.cwd(), 'public/logo.png')).then(
  (buf) => `data:image/png;base64,${buf.toString('base64')}`,
)

function OGImage({
  title,
  description,
  logoSrc,
}: {
  title: string
  description?: string
  logoSrc: string
}) {
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
      {/* Left edge accent bars — same as banner V10 */}
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
        {/* Header row — scope + name + logo */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 48,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ fontSize: 32, fontWeight: 500, color: '#A8A29E' }}>
              @b3nab/
            </div>
            <div style={{ fontSize: 64, fontWeight: 700, color: '#FFFFFF' }}>
              payload-hypervalue
            </div>
          </div>
          <img src={logoSrc} alt="" width={100} height={100} />
        </div>

        {/* Page title */}
        <div style={{ fontSize: 80, fontWeight: 800, color: '#F59E0B' }}>
          {title}
        </div>

        {/* Page description */}
        {description && (
          <div
            style={{
              fontSize: 32,
              color: 'rgba(240,240,240,0.6)',
              marginTop: 16,
            }}
          >
            {description}
          </div>
        )}
      </div>
    </div>
  )
}

export async function GET(
  _req: Request,
  { params }: RouteContext<'/og/docs/[...slug]'>,
) {
  const { slug } = await params
  const page = source.getPage(slug.slice(0, -1))
  if (!page) notFound()

  const logoSrc = await logoData

  return new ImageResponse(
    <OGImage
      title={page.data.title}
      description={page.data.description}
      logoSrc={logoSrc}
    />,
    {
      width: 1200,
      height: 630,
      format: 'webp',
    },
  )
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImage(page).segments,
  }))
}
