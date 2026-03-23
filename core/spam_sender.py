import asyncio
from datetime import datetime
from config.settings import Settings
from config.messages import Messages
from utils.logger import logger
from models.config_models import SpamResult

from core.bot_handler import BotHandler

class SpamSender:
    """Класс для рассылки сообщений"""

    def __init__(self, client):
        self.client = client
        self.result = SpamResult()
        self.bot_handler = BotHandler()

    async def send_to_group(self, dialog) -> bool:
        """Отправка сообщения в группу"""
        try:
            # Получаем username
            username = None
            if hasattr(dialog.entity, 'username') and dialog.entity.username:
                username = dialog.entity.username

            identifier = username if username else str(dialog.id)
            await self.client.send_file(
                identifier,
                str(Settings.PHOTO_FILE),
                caption=Messages.SPAM_MESSAGE,
                parse_mode='html'
                )

            self.result.success_count += 1
            logger.info(f"Отправлено в: {dialog.title} (@{username})")
            await self.bot_handler.send_notification(f"✅ @{username}")
            return True

        except Exception as e:
            self.result.failed_count += 1
            error_msg = str(e)[:100]
            self.result.failed_groups.append({
                "name": dialog.title,
                "error": error_msg
            })
            logger.error(f"Ошибка при отправке в: {error_msg}")
            await self.bot_handler.send_notification(f"❌ @{username}")
            return False

    async def send_spam(self) -> SpamResult:
        """Запуск рассылки"""
        self.result = SpamResult()

        print("\n" + "="*50)
        print("ЗАПУСК РАССЫЛКИ")
        print("="*50)
        print(f"Время: {self.result.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*50)

        # Проверяем группы
        async for dialog in self.client.iter_dialogs():
            # Проверяем, является ли группа мегагруппой
            is_megagroup = False
            if hasattr(dialog.entity, 'megagroup'):
                is_megagroup = dialog.entity.megagroup

            if is_megagroup:
                await self.send_to_group(dialog)
                await asyncio.sleep(Settings.SLEEP_BETWEEN_MESSAGES)

        self.result.end_time = datetime.now()
        self._print_report()
        return self.result

    def _print_report(self):
        """Вывод отчета"""
        duration = self.result.duration

        print("\n" + "="*50)
        print("📊 ИТОГИ РАССЫЛКИ")
        print("="*50)
        print(f"Успешно: {self.result.success_count}")
        print(f"Ошибок: {self.result.failed_count}")
        print(f"Всего: {self.result.total}")
        print(f"Длительность: {int(duration // 60)} мин {int(duration % 60)} сек")
        print("="*50)