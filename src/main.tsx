import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { locale, t } from './lib/i18n'
import './styles.css'

// The document ships in English; swap the metadata only when the visitor's
// browser is Japanese, so crawlers still see a coherent English page.
if (locale !== 'en') {
  document.documentElement.lang = locale
  document.title = t.documentTitle
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', t.documentDescription)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
