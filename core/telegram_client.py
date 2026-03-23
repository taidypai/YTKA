from telethon import TelegramClient
from config.settings import Settings
from utils.logger import logger

class TelegramClientManager:
    """Менеджер для работы с Telegram клиентом"""

    def __init__(self):
        self.client = None
        self.is_authenticated = False

    async def authenticate(self, phone: str = None) -> bool:
        """Авторизация в Telegram"""
        self.client = TelegramClient(
            str(Settings.SESSION_FILE),
            Settings.API_ID,
            Settings.API_HASH
        )

        try:
            logger.info("Начинаю авторизацию в Telegram")
            # Проверяем наличие сессии
            if Settings.SESSION_FILE.with_suffix('.session').exists():
                logger.info("Найдена сохраненная сессия")
                if not phone:
                    phone = input('Введите телефон через (+): ')
                await self.client.start(phone=phone)
                Settings.PHONE = phone
            else:
                logger.info("Требуется первая авторизация")

                async def code_callback():
                    return input("Введите код подтверждения: ").strip()

                if not phone:
                    phone = input('Введите телефон через (+): ')
                await self.client.start(phone=phone, code_callback=code_callback)

            me = await self.client.get_me()
            logger.info(f"Авторизация успешна! Аккаунт: {me.first_name} @{me.username}")
            self.is_authenticated = True
            return True

        except Exception as e:
            logger.error(f"Ошибка авторизации: {e}")
            self.is_authenticated = False
            return False

    async def disconnect(self):
        """Отключение клиента"""
        if self.client:
            await self.client.disconnect()
            logger.info("Клиент отключен")

    def get_client(self):
        """Получение клиента"""
        return self.client