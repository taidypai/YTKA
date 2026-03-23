from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class BotConfig(BaseModel):
    """Модель конфигурации бота"""
    bot_token: str
    admin_id: int
    admin_name: Optional[str] = None
    setup_date: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    setup_complete: bool = True

class SpamResult(BaseModel):
    """Модель результата рассылки"""
    success_count: int = 0
    failed_count: int = 0
    failed_groups: list[dict] = Field(default_factory=list)
    start_time: datetime = Field(default_factory=datetime.now)
    end_time: Optional[datetime] = None

    @property
    def duration(self) -> float:
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0

    @property
    def total(self) -> int:
        return self.success_count + self.failed_count