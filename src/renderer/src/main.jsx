import { createRoot } from 'react-dom/client'
import App from './App'
import { IslandProvider } from './store'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <IslandProvider>
    <App />
  </IslandProvider>
)
