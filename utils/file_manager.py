import json
from pathlib import Path
from typing import Optional
from config.settings import Settings
from models.config_models import BotConfig
from utils.logger import logger

class FileManager:
    """Менеджер для работы с файлами"""

    @staticmethod
    def load_json(file_path: Path) -> Optional[dict]:
        """Загрузка JSON файла"""
        try:
            if not file_path.exists():
                return None

            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)

        except json.JSONDecodeError as e:
            logger.exception(f"Ошибка парсинга JSON в {file_path}")
            return None
        except Exception as e:
            logger.exception(f"Ошибка загрузки {file_path}")
            return None

    @staticmethod
    def save_json(file_path: Path, data: dict) -> bool:
        """Сохранение JSON файла"""
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
            logger.info(f"✅ Сохранен файл: {file_path}")
            return True

        except Exception as e:
            logger.exception(f"Ошибка сохранения {file_path}")
            return False

    @staticmethod
    def load_bot_config() -> Optional[BotConfig]:
        """Загрузка конфигурации бота"""
        try:
            data = FileManager.load_json(Settings.BOT_CONFIG_FILE)
            if data:
                return BotConfig(**data)
            return None

        except Exception as e:
            logger.exception("Ошибка загрузки конфигурации бота")
            return None

    @staticmethod
    def save_bot_config(config: BotConfig) -> bool:
        """Сохранение конфигурации бота"""
        # Обновляем дату последнего использования
        config.last_used = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return FileManager.save_json(Settings.BOT_CONFIG_FILE, config.dict())

    @staticmethod
    def update_bot_config(admin_id: int, bot_token: str, admin_name: str = None, admin_username: str = None) -> bool:
        """Обновление конфигурации бота"""
        try:
            config = BotConfig(
                bot_token=bot_token,
                admin_id=admin_id,
                admin_name=admin_name,
                admin_username=admin_username
            )
            return FileManager.save_bot_config(config)
        except Exception as e:
            logger.exception("Ошибка обновления конфигурации бота")
            return False

    @staticmethod
    def check_photo_exists() -> bool:
        """Проверка наличия фото"""
        try:
            exists = Settings.PHOTO_FILE.exists()
            if not exists:
                logger.warning(f"Фото не найдено: {Settings.PHOTO_FILE}")
            return exists
        except Exception as e:
            logger.exception("Ошибка проверки фото")
            return False