# spam_bot.py
import asyncio
import json
import os
import logging
from datetime import datetime
from typing import List, Dict, Tuple
from telethon import TelegramClient
from config import *

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SpamBot:
    """Класс для автоматической рассылки сообщений"""

    def __init__(self):
        self.api_id = API_ID
        self.api_hash = API_HASH
        self.phone = PHONE
        self.photo_path = PHOTO_PATH
        self.groups_file = GROUPS_FILE
        self.groups = []
        self.client = None
        self.is_running = False
        self.spam_task = None
        self.session_count = 0
        self.failed_groups = []
        self.last_report = None

    async def start(self) -> bool:
        """Запуск рассыльщика"""
        if self.is_running:
            return False

        self.is_running = True
        logger.info("🚀 Запуск рассыльщика...")

        # Инициализируем клиент
        if not await self.init_client():
            self.is_running = False
            return False

        # Запускаем цикл рассылки
        self.spam_task = asyncio.create_task(self.spam_cycle())
        return True

    async def stop(self):
        """Остановка рассыльщика"""
        self.is_running = False
        if self.spam_task:
            self.spam_task.cancel()
            try:
                await self.spam_task
            except asyncio.CancelledError:
                pass
        await self.shutdown()
        logger.info("🛑 Рассыльщик остановлен")

    async def init_client(self) -> bool:
        """Инициализация Telegram клиента"""
        try:
            self.client = TelegramClient(SESSION_FILE, self.api_id, self.api_hash)
            await self.client.start(phone=self.phone)
            me = await self.client.get_me()
            logger.info(f"✅ Авторизация успешна! Аккаунт: {me.first_name}")
            return True
        except Exception as e:
            logger.error(f"❌ Ошибка авторизации: {e}")
            return False

    async def parse_groups_from_account(self) -> List[Dict]:
        """Парсинг всех групп с аккаунта"""
        logger.info("🔍 Парсинг групп с аккаунта...")
        groups = []

        try:
            async for dialog in self.client.iter_dialogs():
                if dialog.is_group or dialog.is_channel:
                    username = None
                    if hasattr(dialog.entity, 'username') and dialog.entity.username:
                        username = dialog.entity.username

                    chat_type = "group" if dialog.is_group else "channel"

                    group_info = {
                        "name": dialog.title,
                        "identifier": username if username else str(dialog.id),
                        "id": dialog.id,
                        "username": username,
                        "type": chat_type,
                        "enabled": True,
                        "link": f"https://t.me/{username}" if username else None
                    }
                    groups.append(group_info)

            logger.info(f"✅ Найдено групп/каналов: {len(groups)}")
            return groups

        except Exception as e:
            logger.error(f"❌ Ошибка парсинга: {e}")
            return []

    async def save_groups(self, groups: List[Dict]):
        """Сохранение групп в JSON"""
        data = {
            "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_groups": len(groups),
            "groups": groups
        }
        with open(self.groups_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

    async def update_groups(self):
        """Обновление списка групп"""
        groups = await self.parse_groups_from_account()
        if groups:
            await self.save_groups(groups)
            self.groups = groups

    def get_message_text(self) -> str:
        """Текст сообщения"""
        return """Ищете дизайнера, который превратит идеи в стильные визуальные решения? 🎨

<b><a href="@ytportofolio">СМОТРЕТЬ ПОРТФОЛИО</a></b>

<b>Я создаю:</b>
• Аватарки
• Моушен Дизайн
• Логотипы и фирменный стиль
• Баннеры и посты для соцсетей
• Карточки товаров для маркетплейсов
• Инфографику и полиграфию

<b>Почему стоит выбрать меня:</b>
✓ Больше года опыта в графическом дизайне
✓ Соблюдаю сроки — сдаю работы в оговорённые даты
✓ Вношу правки до 3х бесплатно после согласования

<b>За заказом пиши:</b> @ytka4k"""

    async def send_to_group(self, group: Dict) -> Tuple[bool, str]:
        """Отправка в одну группу"""
        try:
            identifier = group.get('identifier')
            name = group.get('name')

            if not os.path.exists(self.photo_path):
                return False, f"Фото не найдено: {self.photo_path}"

            await self.client.send_file(
                identifier,
                self.photo_path,
                caption=self.get_message_text(),
                parse_mode='html'
            )
            return True, ""

        except Exception as e:
            return False, str(e)

    async def send_to_all_groups(self) -> Dict:
        """Отправка во все группы"""
        self.failed_groups = []

        enabled_groups = [g for g in self.groups if g.get('enabled', True)]

        if not enabled_groups:
            return {"success": 0, "total": 0, "failed": []}

        logger.info(f"📤 Отправка в {len(enabled_groups)} групп...")

        success_count = 0
        for i, group in enumerate(enabled_groups):
            success, error = await self.send_to_group(group)

            if success:
                success_count += 1
            else:
                self.failed_groups.append({
                    "name": group.get('name'),
                    "username": group.get('username'),
                    "id": group.get('id'),
                    "error": error
                })

            if i < len(enabled_groups) - 1:
                await asyncio.sleep(DELAY_BETWEEN_GROUPS)

        result = {
            "success": success_count,
            "total": len(enabled_groups),
            "failed": self.failed_groups,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "session": self.session_count
        }

        self.last_report = result
        return result

    async def spam_cycle(self):
        """Цикл рассылки"""
        while self.is_running:
            self.session_count += 1
            logger.info(f"="*50)
            logger.info(f"🚀 СЕССИЯ #{self.session_count} | {datetime.now()}")

            # Обновляем группы
            await self.update_groups()

            if self.groups:
                # Отправляем
                result = await self.send_to_all_groups()

                # Сохраняем отчет
                self.save_report(result)

                logger.info(f"📊 Результат: {result['success']}/{result['total']}")
                if result['failed']:
                    logger.info(f"❌ Неудачно: {len(result['failed'])} групп")
            else:
                logger.warning("Нет групп для рассылки")

            # Ждем следующий цикл
            if self.is_running:
                logger.info(f"⏰ Следующая рассылка через {SPAM_INTERVAL_HOURS} часа")
                await asyncio.sleep(SPAM_INTERVAL_HOURS * 3600)

    def save_report(self, result: Dict):
        """Сохранение отчета"""
        os.makedirs("reports", exist_ok=True)
        report_file = f"reports/report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=4, ensure_ascii=False)

    async def shutdown(self):
        """Завершение работы"""
        if self.client:
            await self.client.disconnect()

    def get_status(self) -> Dict:
        """Получение статуса"""
        enabled_count = len([g for g in self.groups if g.get('enabled', True)])
        return {
            "is_running": self.is_running,
            "session_count": self.session_count,
            "groups_count": len(self.groups),
            "enabled_groups": enabled_count,
            "last_report": self.last_report
        }

    def generate_failure_text(self) -> str:
        """Генерация текста отчета"""
        if not self.last_report or not self.last_report.get('failed'):
            return None

        failed = self.last_report['failed']
        text = f"❌ *ОТЧЕТ О НЕУДАЧНЫХ ОТПРАВКАХ*\n"
        text += f"📅 Сессия: #{self.last_report['session']}\n"
        text += f"📊 Результат: {self.last_report['success']}/{self.last_report['total']}\n\n"
        text += f"*Не удалось отправить ({len(failed)} групп):*\n"

        for i, fail in enumerate(failed[:15], 1):
            username = f"@{fail['username']}" if fail['username'] else f"ID: {fail['id']}"
            text += f"{i}. {fail['name']} ({username})\n"
            text += f"   ⚠️ {fail['error'][:60]}\n"

        if len(failed) > 15:
            text += f"\n... и еще {len(failed) - 15} групп"

        return text