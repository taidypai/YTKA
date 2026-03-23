import { useState } from "react"
import "./Button.css"

export default function Button({ children }) {
    const [isActive, setIsActive] = useState(false)

    async function handleClick() {
        setIsActive(true)

        try {
            const response = await fetch('http://localhost:5000/run-script', {
                method: 'POST',
            })
            const data = await response.json()
            console.log('Результат:', data.output)
        } catch (error) {
            console.error('Ошибка подключения к серверу:', error)
        }
    }

    return (
        <button
            className={`button ${isActive ? 'active' : ''}`}
            onClick={handleClick}
        >
            {children}
        </button>
    )
}