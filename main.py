# main.py
import asyncio
import sys
import os
from pathlib import Path

# Добавляем текущую папку в путь
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Импортируем основной бот
from bot import main

if __name__ == "__main__":
    # Создаем папку для отчетов
    Path("reports").mkdir(exist_ok=True)

    # Запускаем бота
    asyncio.run(main())