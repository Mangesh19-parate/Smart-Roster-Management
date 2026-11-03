from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import approval, auth, changes, config, leaves, rosters, utils
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Smart Roster Management API",
    version="0.1.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(auth.router)
app.include_router(config.router)
app.include_router(leaves.router)
app.include_router(rosters.router)
app.include_router(changes.router)
app.include_router(approval.router)
app.include_router(utils.router)