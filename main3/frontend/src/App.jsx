import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './AuthContext'

import Page3 from './pages/Page3'
import Page4 from './pages/Page4'
import Page5 from './pages/Page5'
import PageStatistics from './pages/PageStatistics'

function AppContent() {
  return (
    <div className="h-full bg-white w-full flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 min-h-0 flex w-full p-2 overflow-hidden" style={{ backgroundColor: '#F9FAFD' }}>
        <Routes>
          <Route path="/" element={<Page5 />} />
          <Route path="/guide" element={<Page5 />} />
          <Route path="/labs" element={
            <ProtectedRoute>
              <Page3 />
            </ProtectedRoute>
          } />
          <Route path="/login" element={<Page4 />} />
          <Route path="/statistics" element={
            <ProtectedRoute>
              <PageStatistics />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
