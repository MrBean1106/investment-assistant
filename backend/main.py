import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base, SessionLocal
from models import Enterprise
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

# Allow all origins for production (安全起见，上线后可收紧)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(enterprises_router, prefix="/api/enterprises", tags=["enterprises"])
app.include_router(policies_router, prefix="/api/policies", tags=["policies"])
app.include_router(properties_router, prefix="/api/properties", tags=["properties"])
app.include_router(industry_chain_router, prefix="/api/industry-chain", tags=["industry-chain"])
app.include_router(ai_router, prefix="/api/ai", tags=["ai"])
app.include_router(reports_router, prefix="/api/reports", tags=["reports"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/seed")
async def api_seed():
    """Trigger database seeding."""
    try:
        count = db_query_count()
        if count > 0:
            return {"message": f"已有 {count} 家企业", "seeded": True}
        from seed import seed
        seed()
        count = db_query_count()
        return {"message": f"✅ 已灌入 {count} 家企业", "seeded": True}
    except Exception as e:
        return {"message": f"❌ 失败: {str(e)}", "seeded": False}


def db_query_count():
    db = SessionLocal()
    try:
        return db.query(Enterprise).count()
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
