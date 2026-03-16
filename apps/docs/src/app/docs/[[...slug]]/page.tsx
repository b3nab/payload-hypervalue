import { Accordion, Accordions } from 'fumadocs-ui/components/accordion'
import { ImageZoom } from 'fumadocs-ui/components/image-zoom'
import { Step, Steps } from 'fumadocs-ui/components/steps'
import { Tab, Tabs } from 'fumadocs-ui/components/tabs'
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/notebook/page'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getMDXComponents } from '@/components/mdx'
import { gitConfig } from '@/lib/layout.shared'
import { getPageImage, source } from '@/lib/source'

const latestVersion = process.env.LATEST_VERSION!

const needToResolveLatest = (params: { slug?: string[] }) => {
  if (params.slug?.[0] === 'latest')
    redirect(`/docs/${[latestVersion, ...params.slug.slice(1)].join('/')}`)
}

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params
  needToResolveLatest(params)
  const page = source.getPage(params.slug)
  if (!page) notFound()

  const MDX = page.data.body

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">
        {page.data.description}
      </DocsDescription>
      <div className="flex flex-row gap-2 items-center border-b pb-6">
        <MarkdownCopyButton markdownUrl={`${page.url}.mdx`} />
        <ViewOptionsPopover
          markdownUrl={`${page.url}.mdx`}
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/apps/docs/content/docs/${page.path}`}
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
            img: (props) => <ImageZoom {...(props as any)} />,
            Tab,
            Tabs,
            Accordion,
            Accordions,
            Step,
            Steps,
          })}
        />
      </DocsBody>
    </DocsPage>
  )
}

export async function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata(
  props: PageProps<'/docs/[[...slug]]'>,
): Promise<Metadata> {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
  }
}
