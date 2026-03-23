from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from config.settings import Settings
from config.messages import Messages
from models.config_models import BotConfig
from utils.logger import logger
from utils.file_manager import FileManager

class BotHandler:
    """Обработчик Telegram бота для настройки"""

    def __init__(self):
        self.bot = None
        self.dp = None
        self.admin_id = None
        self.bot_token = None

    async def setup_bot(self) -> int:
        """Настройка бота и получение admin_id"""
        print("\n" + "="*60)
        print("🤖 НАСТРОЙКА TELEGRAM БОТА")
        print("="*60)

        self.bot_token = input("Введите токен бота (получите у @BotFather): ").strip()

        if not self.bot_token:
            print("❌ Токен не введен!")
            return None

        self.bot = Bot(token=self.bot_token)
        self.dp = Dispatcher()

        @self.dp.message(Command("start"))
        async def cmd_start(message: types.Message):
            self.admin_id = message.from_user.id
            user_name = message.from_user.first_name

            await message.answer(
                Messages.WELCOME_MESSAGE.format(
                    user_name=user_name,
                    user_id=self.admin_id
                ),
                parse_mode='Markdown'
            )
            Settings.ADMIN_ID = self.admin_id
            Settings.BOT_TOKEN = self.bot_token
            admin_data = {
                "ADMIN_ID": self.admin_id,
                "BOT_TOKEN": self.bot_token
            }
            FileManager.save_json(Settings.BOT_CONFIG_FILE, admin_data)
            logger.info(f"Бот настроен! Admin ID: {self.admin_id}")

            # Останавливаем бота
            await self.dp.stop_polling()

        print("\n🚀 Запускаю бота для получения ID...")
        print("📱 Напишите /start в вашем боте")
        print("🛑 Для отмены нажмите Ctrl+C")
        print("="*60)

        try:
            await self.dp.start_polling(self.bot)
            return self.admin_id
        except Exception as e:
            logger.error(f"Ошибка настройки бота: {e}")
            return None
        finally:
            await self.bot.session.close()

    async def send_notification(self, message: str) -> bool:
        """Отправка уведомления админу"""
        if not Settings.BOT_TOKEN or not Settings.ADMIN_ID:
            return False

        try:
            bot = Bot(token=Settings.BOT_TOKEN)
            await bot.send_message(chat_id=Settings.ADMIN_ID, text=message)
            await bot.session.close()
            return True
        except Exception as e:
            logger.error(f"Ошибка отправки уведомления: {e}")
            return False