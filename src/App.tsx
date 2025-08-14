import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ScrollToTop from './components/ScrollToTop'
import Home from './pages/home'
import Introduction from './pages/introduction'
import Docs from './pages/docs'
import Languages from './pages/languages'
import Tutorials from './pages/tutorials'
import Sponsors from './pages/sponsors'

function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="introduction" element={<Introduction />} />
          <Route path="docs/*" element={<Docs />} />
          <Route path="languages" element={<Languages />} />
          <Route path="tutorials" element={<Tutorials />} />
          <Route path="sponsors" element={<Sponsors />} />
        </Route>
      </Routes>
    </>
  )
}

export default App