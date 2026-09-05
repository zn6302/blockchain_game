import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 不用 StrictMode：這裡的 map/相機/RAF 迴圈是手刻的 imperative 引擎，
// StrictMode 在開發模式會把 effect 故意跑兩次，會讓遊戲迴圈跟事件監聽被重複綁定。
createRoot(document.getElementById('root')).render(<App />)
