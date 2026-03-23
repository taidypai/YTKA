import asyncio
import sys
from datetime import datetime

from config.settings import Settings
from config.messages import Messages
from core.telegram_client import TelegramClientManager
from core.bot_handler import BotHandler
from core.spam_sender import SpamSender
from utils.logger import logger
from utils.file_manager import FileManager


class TelegramSpamer:
    """Основной класс приложения"""

    def __init__(self):
        self.client_manager = TelegramClientManager()
        self.bot_handler = BotHandler()
        self.spam_sender = None
        self.session_number = 1

    async def initialize(self) -> bool:
        """Инициализация приложения"""
        auth_success = await self.client_manager.authenticate()

        if not auth_success:
            logger.error("Не удалось авторизоваться в Telegram")
            return False
        # Проверяем настройки бота
        file_settings = FileManager.load_json(Settings.BOT_CONFIG_FILE)
        if file_settings:
            Settings.ADMIN_ID, Settings.BOT_TOKEN = file_settings.get('ADMIN_ID', ''), str(file_settings.get('BOT_TOKEN', ''))
        else:
            admin_id = await self.bot_handler.setup_bot()
            if admin_id:
                logger.info(f"Настройка завершена! Admin ID: {admin_id}")
            else:
                logger.error("Настройка бота не завершена")
                return False

            # Авторизация в Telegram

        self.spam_sender = SpamSender(self.client_manager.get_client())
        return True

    async def run_spam_session(self):
        """Запуск одной сессии рассылки"""
        print("\n" + "="*50)
        print(f"ЗАПУСК СЕССИИ #{self.session_number}")
        print(f"Время: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*50)
        print("Пожалуйста, добавьте фото для сообщения в папку data с именем photo")
        if not FileManager.check_photo_exists():
            while True:
                vvod = input('Добавили фото? (y/n): ').strip().lower()
                if vvod == 'y':
                    break
                elif vvod == 'n':
                    print("❌ Рассылка отменена")
                    return


        # Запускаем рассылку
        result = await self.spam_sender.send_spam()

        await self.bot_handler.send_notification('Рассылка запущена')

        logger.info(f"СЕССИЯ #{self.session_number} ЗАВЕРШЕНА")
        self.session_number += 1

    async def run(self):
        """Основной цикл приложения"""
        print("="*60)
        print("🤖 YTKA SPAMER")
        print("="*60)
        print(f"📁 Папка данных: {Settings.DATA_DIR}")
        print("="*60)

        # Инициализация
        if not await self.initialize():
            print("\n❌ Не удалось инициализировать приложение")
            return

        print("\n✅ Бот готов к работе!")
        print(f"Рассылка будет выполняться каждые {Settings.SPAM_INTERVAL // 3600} часа")
        print("Нажмите Ctrl+C для остановки")

        try:
            while True:
                await self.run_spam_session()

                # Ожидание до следующей рассылки
                print(f"\nСледующая рассылка через {Settings.SPAM_INTERVAL // 3600} часа...")
                for remaining in range(Settings.SPAM_INTERVAL, 0, -1):
                    if remaining % 3600 == 0 and remaining != Settings.SPAM_INTERVAL:
                        hours = remaining // 3600
                        print(f"⏳ Осталось: {hours} час(ов)")
                    await asyncio.sleep(1)

        except KeyboardInterrupt:
            print("\nБот остановлен пользователем")
            await self.bot_handler.send_notification(Messages.NOTIFICATION_STOP)
        except Exception as e:
            logger.error(f"Критическая ошибка: {e}")
            await self.bot_handler.send_notification(f"❌ Критическая ошибка: {e}")
        finally:
            await self.client_manager.disconnect()


def main():
    """Точка входа"""
    try:
        spamer = TelegramSpamer()
        asyncio.run(spamer.run())
    except KeyboardInterrupt:
        print("\nПрограмма завершена")
    except Exception as e:
        logger.error(f"Ошибка: {e}")
        print(f"Ошибка: {e}")


if __name__ == "__main__":
    main()
# Проверка комита
# PyInstaller --onefile --console --add-data "config;config" --add-data "core;core" --add-data "models;models" --add-data "utils;utils" --add-data "data;data" run_app.py