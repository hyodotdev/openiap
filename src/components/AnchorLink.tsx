import { ReactNode, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

interface AnchorLinkProps {
  id: string
  level: 'h1' | 'h2' | 'h3' | 'h4'
  children: ReactNode
}

function AnchorLink({ id, level, children }: AnchorLinkProps) {
  const Tag = level
  const location = useLocation()

  useEffect(() => {
    // Check if current hash matches this element's id
    if (location.hash === `#${id}`) {
      setTimeout(() => {
        const element = document.getElementById(id)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    }
  }, [location, id])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Update URL without triggering navigation
      window.history.pushState(null, '', `#${id}`)
    }
    // Copy to clipboard
    const url = `${window.location.pathname}#${id}`
    navigator.clipboard.writeText(window.location.origin + url)
  }

  return (
    <Tag id={id} className="anchor-heading">
      {children}
      <a 
        href={`#${id}`} 
        className="anchor-link"
        onClick={handleClick}
        aria-label="Direct link to heading"
      >
        #
      </a>
    </Tag>
  )
}

export default AnchorLink