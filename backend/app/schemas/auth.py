"""Pydantic schemas for Auth endpoints"""
from pydantic import BaseModel
from typing import Optional


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str
