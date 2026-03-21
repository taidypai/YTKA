# keyboards.py
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

def main_menu() -> InlineKeyboardMarkup:
    """Главное меню"""
    keyboard = [
        [
            InlineKeyboardButton(text="START", callback_data="start_spam"),
            InlineKeyboardButton(text="STOP", callback_data="stop_spam")
        ],
        [
            InlineKeyboardButton(text="STATUS", callback_data="status"),
        ]
    ]
    return InlineKeyboardMarkup(inline_keyboard=keyboard)

def back_menu() -> InlineKeyboardMarkup:
    """Кнопка назад"""
    keyboard = [
        [InlineKeyboardButton(text="◀️ Назад", callback_data="back")]
    ]
    return InlineKeyboardMarkup(inline_keyboard=keyboard)