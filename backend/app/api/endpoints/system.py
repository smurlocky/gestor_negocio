from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import traceback
import sys
import os

# Ensure the backend root is in sys.path so we can import seed_db
backend_path = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from seed_db import seed_data

router = APIRouter()

class SeedResponse(BaseModel):
    message: str

@router.post("/seed", response_model=SeedResponse)
async def seed_database():
    """
    Roda a função seed_data para popular o banco de dados.
    """
    try:
        await seed_data()
        return {"message": "Banco populado com sucesso!"}
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"Unexpected error seeding DB:\n{error_details}")
        raise HTTPException(status_code=500, detail=str(e))
