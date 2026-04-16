import { parseFrontmatter } from '../utils'

function FrontmatterCard({ content }: { content: string }) {
  const entries = Object.entries(parseFrontmatter(content))

  if (entries.length === 0) {
    return null
  }

  return (
    <section className="frontmatter-card">
      <strong>Front matter</strong>
      <dl>
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default FrontmatterCard
