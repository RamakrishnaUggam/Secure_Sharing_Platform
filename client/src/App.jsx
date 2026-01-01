import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'

function LegacyFrame({ page }) {
	const src = `/legacy/${page}`
	return (
		<div className="frameWrap">
			<iframe className="frame" title={page} src={src} />
		</div>
	)
}

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Navigate to="/login" replace />} />
				<Route path="/login" element={<LegacyFrame page="index.html" />} />
				<Route path="/register" element={<LegacyFrame page="register.html" />} />
				<Route path="/home" element={<LegacyFrame page="home.html" />} />
				<Route path="/forgot-password" element={<LegacyFrame page="forgot-password.html" />} />
				<Route path="/logout" element={<LegacyFrame page="logout.html" />} />
				<Route path="*" element={<Navigate to="/login" replace />} />
			</Routes>
		</BrowserRouter>
	)
}

export default App
