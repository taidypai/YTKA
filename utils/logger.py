import logging
from config.settings import Settings

def setup_logger(name: str = "YTKASpamer") -> logging.Logger:
    """Настройка логирования"""
    logger = logging.getLogger(name)
    logger.setLevel(Settings.LOG_LEVEL)

    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s | %(funcName)s() :%(lineno)d] - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Обработчик для файла
    file_handler = logging.FileHandler(Settings.LOG_FILE, encoding='utf-8')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    # Обработчик для консоли
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    return logger

# Глобальный логгер
logger = setup_logger()