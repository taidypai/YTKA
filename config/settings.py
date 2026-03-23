import os
from pathlib import Path

class Settings:
    """Класс для хранения настроек"""

    # API данные
    API_ID = 22926683
    API_HASH = '0ec08a85c9fc42adb60450064d8de790'

    # Интервалы (в секундах)
    SPAM_INTERVAL = 10800  # 3 часа
    SLEEP_BETWEEN_MESSAGES = 3

    # Настройки бота
    BOT_TOKEN = None
    ADMIN_ID = None
    PHONE = None

    # Пути
    BASE_DIR = Path(__file__).parent.parent
    DATA_DIR = BASE_DIR / "data"
    PHOTO_FILE = DATA_DIR / "photo.jpg"
    SESSION_FILE = DATA_DIR / "session"
    BOT_CONFIG_FILE = DATA_DIR / "bot_config.json"

    # Логирование
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = DATA_DIR / "spamer.log"

    @classmethod
    def ensure_directories(cls):
        """Создание необходимых директорий"""
        cls.DATA_DIR.mkdir(parents=True, exist_ok=True)

# Создаем директории при импорте
Settings.ensure_directories()