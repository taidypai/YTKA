Стадия перехода в браузер.

Проблемы:
- Отображение на странице браузере ( Решена )
- Сбой подключения к телеграмм api без VPN и отключение от localhost с впн ( Решена )
- Не понятно чт опроисходит после ввода всех данных.

Пока, что вход не осуществлен нужно ждать пока хаработает впн.

Запуск хоста - npm run dev -- --host
  YTKA/
  ├── src/
  │   ├── App.jsx          — навигация
  │   ├── components/
  │   │   ├── TelegramSender.jsx
  │   │   └── VkFeed.jsx
  │   ├── main.jsx
  │   ├── polyfills.js
  │   └── index.css
  ├── server.py            — бэкенд VK
  ├── index.html
  ├── vite.config.js
  ├── package.json
  └── .gitignore