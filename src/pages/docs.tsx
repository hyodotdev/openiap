import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import LifeCycle from './docs/life-cycle'
import Types from './docs/types'
import APIs from './docs/apis'
import Events from './docs/events'
import Errors from './docs/errors'
import IOSSetup from './docs/ios-setup'
import AndroidSetup from './docs/android-setup'

function Docs() {
  return (
    <div className="docs-container">
      <aside className="docs-sidebar">
        <nav className="docs-nav">
          <h3>Documentation</h3>
          <ul>
            <li>
              <NavLink to="/docs/lifecycle" className={({ isActive }) => isActive ? 'active' : ''}>
                LifeCycle
              </NavLink>
            </li>
            <li>
              <NavLink to="/docs/types" className={({ isActive }) => isActive ? 'active' : ''}>
                Types
              </NavLink>
            </li>
            <li>
              <NavLink to="/docs/apis" className={({ isActive }) => isActive ? 'active' : ''}>
                APIs
              </NavLink>
            </li>
            <li>
              <NavLink to="/docs/events" className={({ isActive }) => isActive ? 'active' : ''}>
                Events
              </NavLink>
            </li>
            <li>
              <NavLink to="/docs/errors" className={({ isActive }) => isActive ? 'active' : ''}>
                Errors
              </NavLink>
            </li>
          </ul>
          
          <h3 style={{ marginTop: '2rem' }}>Setup Guide</h3>
          <ul>
            <li>
              <NavLink to="/docs/ios-setup" className={({ isActive }) => isActive ? 'active' : ''}>
                iOS Setup
              </NavLink>
            </li>
            <li>
              <NavLink to="/docs/android-setup" className={({ isActive }) => isActive ? 'active' : ''}>
                Android Setup
              </NavLink>
            </li>
          </ul>
        </nav>
      </aside>
      
      <main className="docs-content">
        <Routes>
          <Route index element={<Navigate to="/docs/lifecycle" replace />} />
          <Route path="lifecycle" element={<LifeCycle />} />
          <Route path="types" element={<Types />} />
          <Route path="apis" element={<APIs />} />
          <Route path="events" element={<Events />} />
          <Route path="errors" element={<Errors />} />
          <Route path="ios-setup" element={<IOSSetup />} />
          <Route path="android-setup" element={<AndroidSetup />} />
        </Routes>
      </main>
    </div>
  )
}

export default Docs