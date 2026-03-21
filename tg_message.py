# ────────────────────────────────────────────────────────────────────────────
# МОДУЛЬ: tg_message.py
# НАЗНАЧЕНИЕ: Инициализация сценариев взаимодействия пользователя с ботом
#
# ХОД:
# 1. Отправка сообщений спомощью ссылки
#
# ВАЖНО: ...
# ────────────────────────────────────────────────────────────────────────────
""" Импорт логера """
# Настройка логирования

""" Импорт библиотек """
import config
import asyncio
import aiohttp
import re
import ssl
import certifi
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

BOT_TOKEN = config.BOT_TOKEN
CHAT_ID = config.ADMIN_ID

# Экранирует специальные символы для MarkdownV2
def escape_markdown(text):
    special_chars = {
        '_': r'\_',
        '[': r'\[',
        ']': r'\]',
        '(': r'\(',
        ')': r'\)',
        '~': r'\~',
        '`': r'\`',
        '>': r'\>',
        '#': r'\#',
        '+': r'\+',
        '-': r'\-',
        '=': r'\=',
        '|': r'\|',
        '{': r'\{',
        '}': r'\}',
        '.': r'\.',
        '!': r'\!'
    }
    escaped_text = ''
    for char in text:
        if char in special_chars:
            escaped_text += special_chars[char]
        else:
            escaped_text += char

    return escaped_text

async def send_message(message_text: str, parse_mode: str = "MarkdownV2") -> bool:
    """Отправляет сообщение в Telegram. Возвращает True при успехе."""
    if parse_mode == "MarkdownV2":
        original = message_text
        message_text = escape_markdown(message_text)
        logger.debug(f"Оригинал: {original}")
        logger.debug(f"Экранировано: {message_text}")

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": CHAT_ID,
        "text": message_text,
        "parse_mode": parse_mode,
    }

    try:
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        connector = aiohttp.TCPConnector(ssl=ssl_context)

        async with aiohttp.ClientSession(connector=connector) as session:
            async with session.post(url, json=payload, timeout=10) as response:
                if response.status == 200:
                    return True
                error_text = await response.text()
                logger.error(f"✗ Telegram {response.status}: {error_text}")
                return False

    except asyncio.TimeoutError:
        logger.error("✗ Таймаут при отправке в Telegram")
    except aiohttp.ClientError as e:
        logger.error(f"✗ Ошибка подключения к Telegram: {e}")
    except Exception as e:
        logger.error(f"✗ Непредвиденная ошибка: {e}")

    return False

if __name__ == "__main__":
    async def main():
        await send_message('ASD')

    asyncio.run(main())