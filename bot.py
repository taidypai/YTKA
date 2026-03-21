# bot.py
import asyncio
import logging
import os
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery
from aiogram.enums import ParseMode

from config import BOT_TOKEN, ADMIN_ID, PHOTO_PATH
from spam_bot import SpamBot
from keyboards import main_menu, back_menu
from tg_message import send_message

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Инициализация бота и диспетчера
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# Глобальный объект рассыльщика
spam_bot = SpamBot()

# Проверка админа
def is_admin(user_id: int) -> bool:
    return user_id == ADMIN_ID

# Команда /start
@dp.message(Command("start"))
async def cmd_start(message: Message):
    if not is_admin(message.from_user.id):
        await message.answer("⛔ У вас нет доступа к этому боту!")
        return

    status = spam_bot.get_status()
    status_text = "🟢 Работает" if status['is_running'] else "🔴 Остановлен"

    text = (
        "🤖 *Бот управления рассылкой*\n\n"
        "Привет! Я управляю автоматической рассылкой портфолио.\n\n"
        f"📌 *Статус:* {status_text}\n"
        f"📊 *Сессий выполнено:* {status['session_count']}\n"
        f"👥 *Групп в базе:* {status['groups_count']}\n"
        "Выбери действие:"
    )

    await message.answer(text, reply_markup=main_menu(), parse_mode=ParseMode.MARKDOWN)

# Команда /status
@dp.message(Command("status"))
async def cmd_status(message: Message):
    if not is_admin(message.from_user.id):
        return

    status = spam_bot.get_status()
    status_text = "🟢 Работает" if status['is_running'] else "🔴 Остановлен"

    text = (
        f"📊 *СТАТУС РАССЫЛКИ*\n\n"
        f"📌 Состояние: {status_text}\n"
        f"📈 Сессий выполнено: {status['session_count']}\n"
        f"👥 Групп в базе: {status['groups_count']}\n"
    )

    await message.answer(text, parse_mode=ParseMode.MARKDOWN)

# Команда /stop
@dp.message(Command("stop"))
async def cmd_stop(message: Message):
    if not is_admin(message.from_user.id):
        return

    if not spam_bot.is_running:
        await message.answer("⚠️ Рассылка и так не работает!")
        return

    await message.answer("🛑 Останавливаю рассылку...")
    await spam_bot.stop()
    await message.answer("✅ Рассылка остановлена!")

# Команда /start_spam
@dp.message(Command("start_spam"))
async def cmd_start_spam(message: Message):
    if not is_admin(message.from_user.id):
        return

    if spam_bot.is_running:
        await message.answer("⚠️ Рассылка уже запущена!")
        return

    await message.answer("🚀 Запускаю рассылку...")
    success = await spam_bot.start()

    if success:
        await message.answer("✅ Рассылка успешно запущена!")
    else:
        await message.answer("❌ Ошибка запуска рассылки! Проверьте логи.")


# Команда /report
@dp.message(Command("report"))
async def cmd_report(message: Message):
    if not is_admin(message.from_user.id):
        return

    if not spam_bot.last_report:
        await message.answer("📭 Отчетов пока нет!")
        return

    report = spam_bot.last_report

    text = (
        f"📋 *ОТЧЕТ О РАССЫЛКЕ*\n\n"
        f"📅 Дата: {report['timestamp']}\n"
        f"📊 Сессия: #{report['session']}\n"
        f"✅ Успешно: {report['success']}/{report['total']}\n"
    )

    if report['failed']:
        text += f"\n❌ *НЕУДАЧНЫЕ ОТПРАВКИ ({len(report['failed'])}):*\n"
        for i, fail in enumerate(report['failed'][:-1], 1):
            username = f"@{fail['username']}" if fail['username'] else f"ID: {fail['id']}"
            text += f"{i}. {username} {fail['name']}\n"
            text += f"   ⚠️ {fail['error'][:50]}\n"

    await message.answer(text, parse_mode=ParseMode.MARKDOWN)

# Обработка callback кнопок
@dp.callback_query()
async def handle_callback(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ Нет доступа!", show_alert=True)
        return

    action = callback.data

    if action == "start_spam":
        if spam_bot.is_running:
            await callback.answer("⚠️ Рассылка уже запущена!", show_alert=True)
        else:
            await callback.answer("🚀 Запускаю...")
            await callback.message.edit_text("🚀 Запускаю рассылку...")
            success = await spam_bot.start()
            if success:
                await callback.message.edit_text("✅ Рассылка успешно запущена!", reply_markup=main_menu())
            else:
                await callback.message.edit_text("❌ Ошибка запуска!", reply_markup=main_menu())

    elif action == "stop_spam":
        if not spam_bot.is_running:
            await callback.answer("⚠️ Рассылка уже остановлена!", show_alert=True)
        else:
            await callback.answer("🛑 Останавливаю...")
            await callback.message.edit_text("🛑 Останавливаю рассылку...")
            await spam_bot.stop()
            await callback.message.edit_text("✅ Рассылка остановлена!", reply_markup=main_menu())

    elif action == "status":
        status = spam_bot.get_status()
        status_text = "🟢 Работает" if status['is_running'] else "🔴 Остановлен"

        text = (
            f"📊 *СТАТУС РАССЫЛКИ*\n\n"
            f"📌 Состояние: {status_text}\n"
            f"📈 Сессий выполнено: {status['session_count']}\n"
            f"👥 Групп в базе: {status['groups_count']}\n"
        )

        if status['last_report']:
            report = status['last_report']
            text += f"\n📋 *Последний отчет:*\n"
            text += f"⏰ {report['timestamp']}\n"
            text += f"✅ {report['success']}/{report['total']}\n"
            if report['failed']:
                text += f"❌ Ошибок: {len(report['failed'])}"

        await callback.message.edit_text(text, reply_markup=main_menu(), parse_mode=ParseMode.MARKDOWN)

    elif action == "report":
        if not spam_bot.last_report:
            await callback.answer("Отчетов пока нет!", show_alert=True)
            return

        report = spam_bot.last_report

        text = (
            f"📋 *ОТЧЕТ О РАССЫЛКЕ*\n\n"
            f"📅 Дата: {report['timestamp']}\n"
            f"📊 Сессия: #{report['session']}\n"
            f"✅ Успешно: {report['success']}/{report['total']}\n"
        )

        if report['failed']:
            text += f"\n❌ *НЕУДАЧНЫЕ ОТПРАВКИ ({len(report['failed'])}):*\n"
            for i, fail in enumerate(report['failed'][:10], 1):
                username = f"@{fail['username']}" if fail['username'] else f"ID: {fail['id']}"
                text += f"{i}. {fail['name']} ({username})\n"
                text += f"   ⚠️ {fail['error'][:50]}\n"
            if len(report['failed']) > 10:
                text += f"\n... и еще {len(report['failed']) - 10} групп"

        await callback.message.edit_text(text, reply_markup=main_menu(), parse_mode=ParseMode.MARKDOWN)

    elif action == "back":
        status = spam_bot.get_status()
        status_text = "🟢 Работает" if status['is_running'] else "🔴 Остановлен"

        text = (
            "🤖 *Бот управления рассылкой*\n\n"
            f"📌 *Статус:* {status_text}\n"
            f"📊 *Сессий выполнено:* {status['session_count']}\n"
            f"👥 *Групп в базе:* {status['groups_count']}\n"
            f"✅ *Активных групп:* {status['enabled_groups']}\n\n"
            "Выбери действие:"
        )

        await callback.message.edit_text(text, reply_markup=main_menu(), parse_mode=ParseMode.MARKDOWN)

    await callback.answer()

async def main():
    """Запуск бота"""
    print("="*50)
    print("🤖 БОТ ЗАПУЩЕН!")
    print("="*50)
    await send_message("Бот запущен нажмите -> /start")
    print(f"📱 Бот: @{ (await bot.get_me()).username }")
    print("🛑 Для остановки нажми Ctrl+C")
    print("="*50)

    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())