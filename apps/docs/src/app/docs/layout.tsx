import { DocsLayout, type DocsLayoutProps } from 'fumadocs-ui/layouts/notebook'
import { baseOptions } from '@/lib/layout.shared'
import { source } from '@/lib/source'

const docsOptions: DocsLayoutProps = {
  ...baseOptions(),
  tree: source.getPageTree(),
  nav: {
    ...baseOptions().nav,
    mode: 'top',
  },
}

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return <DocsLayout {...docsOptions}>{children}</DocsLayout>
}
