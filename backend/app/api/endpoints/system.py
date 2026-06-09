from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import subprocess
import os

router = APIRouter()

class SeedResponse(BaseModel):
    message: str

@router.post("/seed", response_model=SeedResponse)
async def seed_database():
    """
    Roda o script seed_db.py para popular o banco de dados.
    """
    try:
        # Run the seed_db.py script
        script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "seed_db.py")
        result = subprocess.run(
            ["python3", script_path],
            capture_output=True,
            text=True,
            check=True
        )
        return {"message": "Banco populado com sucesso!"}
    except subprocess.CalledProcessError as e:
        print(f"Error seeding DB: {e.stderr}")
        raise HTTPException(status_code=500, detail=f"Erro ao popular o banco: {e.stderr}")
    except Exception as e:
        print(f"Unexpected error seeding DB: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao popular o banco.")
