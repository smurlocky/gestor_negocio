import uuid
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class DemandForecastOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    target_date: date
    predicted_orders: int
    predicted_revenue: float
    confidence_score: float
    model_version: str

    class Config:
        from_attributes = True


class AIRecommendationOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    type: str
    title: str
    description: str
    impact_level: str
    action_data: Optional[Dict[str, Any]] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AIRecommendationApplyOut(BaseModel):
    message: str
    created_order_id: Optional[uuid.UUID] = None


class CopilotRequest(BaseModel):
    message: str


class CopilotResponse(BaseModel):
    response: str
