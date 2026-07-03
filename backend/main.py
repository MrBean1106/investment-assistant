import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routers.enterprises import router as enterprises_router
from routers.resources import policies_router, properties_router
from routers.industry_chain import router as industry_chain_router
from routers.ai import router as ai_router
from routers.reports import router as reports_router

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="产业招商助手 API",
    description="企业库、政策库、物业资源库、产业图谱管理",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        os.getenv("FRONTEND_URL", ""),
        "https://investment-assistant-two.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(enterprises_router, prefix="/api/enterprises", tags=["enterprises"])
app.include_router(policies_router, prefix="/api/policies", tags=["policies"])
app.include_router(properties_router, prefix="/api/properties", tags=["properties"])
app.include_router(industry_chain_router, prefix="/api/industry-chain", tags=["industry-chain"])
app.include_router(ai_router, prefix="/api/ai", tags=["ai"])
app.include_router(reports_router, prefix="/api/reports", tags=["reports"])


@app.get("/api/health")
async def health():
    from database import SessionLocal
    from models import Enterprise
    db = SessionLocal()
    try:
        count = db.query(Enterprise).count()
        return {"status": "ok", "enterprises": count}
    finally:
        db.close()


@app.post("/api/seed")
async def api_seed():
    """Trigger database seeding (first deployment only)."""
    from database import SessionLocal
    from models import Enterprise
    db = SessionLocal()
    try:
        count = db.query(Enterprise).count()
        if count > 0:
            return {"message": f"数据库已有 {count} 家企业，无需灌入"}
        from seed import seed
        seed()
        db = SessionLocal()  # refresh
        count = db.query(Enterprise).count()
        return {"message": "✅ 种子数据已灌入", "enterprises": count}
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
