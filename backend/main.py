from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import invitations, members, projects, workspace

app = FastAPI(title="AI Value Framework API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api/v1")
app.include_router(workspace.router, prefix="/api/v1")
app.include_router(members.router, prefix="/api/v1")
app.include_router(invitations.router)


@app.get("/health")
def health():
    return {"status": "ok"}
