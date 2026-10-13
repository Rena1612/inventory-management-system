from app.routes.auth import router as auth_router
from app.routes.locations import categories_router
from app.routes.locations import router as locations_router
from app.routes.movements import router as movements_router
from app.routes.orgs import router as orgs_router
from app.routes.products import router as products_router
from app.routes.purchase_orders import router as purchase_orders_router
from app.routes.reports import router as reports_router
from app.routes.suppliers import router as suppliers_router

__all__ = [
    "auth_router",
    "categories_router",
    "locations_router",
    "movements_router",
    "orgs_router",
    "products_router",
    "purchase_orders_router",
    "reports_router",
    "suppliers_router",
]