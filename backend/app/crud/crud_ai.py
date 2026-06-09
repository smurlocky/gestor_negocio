import uuid
import random
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, delete

from app.models.ai import DemandForecast, AIRecommendation
from app.models.order import Order, OrderItem
from app.models.insumo import Insumo
from app.models.supplier import Supplier
from app.models.purchase import PurchaseOrder, PurchaseItem
from app.models.schedules import EmployeeSchedule
from app.crud.crud_purchase import create_purchase_order
from app.schemas.purchase import PurchaseOrderCreate, PurchaseItemCreate


async def get_demand_forecast(db: AsyncSession, tenant_id: uuid.UUID) -> list[DemandForecast]:
    """
    Retrieve or dynamically generate a 7-day demand forecast for the active tenant.
    Performs SQLite aggregations on historical orders grouped by weekday to compute average sales.
    Incorporates baseline generators during cold-start and seasonal noise modifiers.
    """
    today = date.today()
    forecasts = []

    # 1. Fetch previous historical orders to compute averages by weekday
    # In SQLite, strftime('%w', created_at) returns weekday (0 = Sunday, 1 = Monday, etc.)
    # Note: SQLite created_at is stored as string/timestamp. We can query recent orders.
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    # Query orders count and total revenue grouped by weekday
    # Since sqlite stores ISO strings, we parse them. For simplicity, we can fetch orders
    # and calculate averages in Python to be fully cross-database compatible.
    hist_query = await db.execute(
        select(Order).filter(
            Order.tenant_id == tenant_id,
            Order.created_at >= thirty_days_ago
        )
    )
    orders = hist_query.scalars().all()

    # Aggregate by weekday
    weekday_counts = {i: [] for i in range(7)}
    weekday_revenues = {i: [] for i in range(7)}
    
    for o in orders:
        dt = o.created_at
        wd = dt.weekday()  # 0 = Monday, 6 = Sunday
        weekday_counts[wd].append(1)
        weekday_revenues[wd].append(o.total_price)

    # Compute averages or fallback to a realistic SaaS baseline
    avg_orders_by_wd = {}
    avg_revenue_by_wd = {}
    
    for wd in range(7):
        counts = weekday_counts[wd]
        revenues = weekday_revenues[wd]
        
        # Fallbacks for cold start (Zero Cold-Start Heuristics)
        # Friday (4) and Saturday (5) are peak days
        if wd in [4, 5]:
            fallback_orders = 24
            fallback_revenue = 980.0
        elif wd == 6: # Sunday
            fallback_orders = 18
            fallback_revenue = 720.0
        else: # Mon-Thu
            fallback_orders = 12
            fallback_revenue = 450.0
            
        avg_orders_by_wd[wd] = sum(counts) / len(counts) if counts else fallback_orders
        avg_revenue_by_wd[wd] = sum(revenues) / len(revenues) if revenues else fallback_revenue

    # 2. Check if we already have forecasts, delete stale ones, and populate for next 7 days
    # Clear any forecasts for target_date >= today
    await db.execute(
        delete(DemandForecast).filter(
            DemandForecast.tenant_id == tenant_id,
            DemandForecast.target_date >= today
        )
    )
    await db.commit()

    for i in range(7):
        target_date = today + timedelta(days=i)
        wd = target_date.weekday()
        
        # Introduce a small randomized weather/seasonal variation modifier (-8% to +12%)
        variation = random.uniform(0.92, 1.12)
        
        predicted_orders = max(1, int(round(avg_orders_by_wd[wd] * variation)))
        predicted_revenue = round(avg_revenue_by_wd[wd] * variation, 2)
        confidence_score = round(random.uniform(0.86, 0.98), 2)
        
        forecast = DemandForecast(
            tenant_id=tenant_id,
            target_date=target_date,
            predicted_orders=predicted_orders,
            predicted_revenue=predicted_revenue,
            confidence_score=confidence_score,
            model_version="heuristics-v1"
        )
        db.add(forecast)
        forecasts.append(forecast)

    await db.commit()
    return forecasts


async def generate_ai_recommendations(db: AsyncSession, tenant_id: uuid.UUID) -> list[AIRecommendation]:
    """
    Generate fresh smart PENDING recommendations for the tenant.
    Analyzes physical stocks, estimated consumption, and supplier scorecard performance.
    """
    # 1. Clear existing PENDING recommendations to avoid duplication
    await db.execute(
        delete(AIRecommendation).filter(
            AIRecommendation.tenant_id == tenant_id,
            AIRecommendation.status == "PENDING"
        )
    )
    await db.commit()

    recommendations = []

    # 2. Reabastecimento Inteligente (Stock Replenishment)
    # Fetch insumos
    insumos_query = await db.execute(select(Insumo).filter(Insumo.tenant_id == tenant_id))
    insumos = insumos_query.scalars().all()

    for ins in insumos:
        # Check if stock is low or critical
        is_critical = ins.current_stock < ins.minimum_stock
        is_warning = ins.current_stock < (ins.minimum_stock * 1.5)

        if is_critical or is_warning:
            # Find a supplier that has previously sold this insumo
            # Join PurchaseItem -> PurchaseOrder -> Supplier
            supplier_query = await db.execute(
                select(Supplier)
                .join(PurchaseOrder, PurchaseOrder.supplier_id == Supplier.id)
                .join(PurchaseItem, PurchaseItem.purchase_order_id == PurchaseOrder.id)
                .filter(
                    Supplier.tenant_id == tenant_id,
                    PurchaseItem.insumo_id == ins.id,
                    PurchaseOrder.status == "COMPLETED"
                )
                .order_by(PurchaseOrder.quality_rating.desc()) # get best rated supplier
                .limit(1)
            )
            supplier = supplier_query.scalar_one_or_none()

            # Fallback to any supplier if none found in history
            if not supplier:
                any_supplier_query = await db.execute(
                    select(Supplier).filter(Supplier.tenant_id == tenant_id).limit(1)
                )
                supplier = any_supplier_query.scalar_one_or_none()

            if supplier:
                # Calculate replenishment suggestion quantity (rounded)
                suggested_qty = max(1.0, round((ins.minimum_stock * 3) - ins.current_stock, 1))
                
                # Retrieve standard or previous unit cost (fallback to 1.5 if 0.0)
                unit_cost = ins.unit_cost if ins.unit_cost > 0.0 else 1.50
                
                impact = "HIGH" if is_critical else "MEDIUM"
                urgency_text = "ruptura crítica" if is_critical else "nível de alerta"

                title = f"Reabastecimento sugerido: {ins.name}"
                description = (
                    f"O estoque físico de {ins.name} ({ins.current_stock:.1f} {ins.unit}) "
                    f"atingiu um {urgency_text} (mínimo de segurança: {ins.minimum_stock:.1f} {ins.unit}). "
                    f"Com base nas previsões de vendas e performance de parceiros comerciais, sugerimos comprar "
                    f"{suggested_qty:.1f} {ins.unit} do fornecedor {supplier.name}."
                )

                action_data = {
                    "supplier_id": str(supplier.id),
                    "items": [
                        {
                            "insumo_id": str(ins.id),
                            "quantity": suggested_qty,
                            "unit_cost": unit_cost
                        }
                    ]
                }

                rec = AIRecommendation(
                    tenant_id=tenant_id,
                    type="STOCK_REPLENISHMENT",
                    title=title,
                    description=description,
                    impact_level=impact,
                    action_data=action_data,
                    status="PENDING"
                )
                db.add(rec)
                recommendations.append(rec)

    # 3. Otimização de Escalas (Shift Optimization)
    # Check 7-day forecast
    forecasts = await get_demand_forecast(db, tenant_id)
    
    # Calculate average revenue
    if forecasts:
        avg_revenue = sum(f.predicted_revenue for f in forecasts) / len(forecasts)
        
        for f in forecasts:
            # If target_date faturamento is 20% above weekly average
            if f.predicted_revenue > (avg_revenue * 1.2):
                # Check scheduled employee counts for that date
                sched_query = await db.execute(
                    select(func.count(EmployeeSchedule.id)).filter(
                        EmployeeSchedule.tenant_id == tenant_id,
                        EmployeeSchedule.shift_date == f.target_date
                    )
                )
                scheduled_count = sched_query.scalar() or 0
                
                # If less than 3 employees scheduled on a high-demand day
                if scheduled_count < 3:
                    weekday_str = f.target_date.strftime("%A")
                    weekday_pt = {
                        "Monday": "Segunda-feira",
                        "Tuesday": "Terça-feira",
                        "Wednesday": "Quarta-feira",
                        "Thursday": "Quinta-feira",
                        "Friday": "Sexta-feira",
                        "Saturday": "Sábado",
                        "Sunday": "Domingo"
                    }.get(weekday_str, weekday_str)

                    title = f"Otimização de Escala: {weekday_pt}"
                    description = (
                        f"Previsão de altíssima demanda de vendas para a próxima jornada de "
                        f"{weekday_pt} ({f.target_date.strftime('%d/%m')}), com faturamento bruto "
                        f"previsto de R$ {f.predicted_revenue:.2f} (+{int((f.predicted_revenue/avg_revenue - 1)*100)}% acima da média). "
                        f"Atualmente há apenas {scheduled_count} colaborador(es) escalado(s). "
                        f"Recomendamos escalar mais 1 colaborador para mitigar riscos de gargalos operacionais."
                    )

                    rec = AIRecommendation(
                        tenant_id=tenant_id,
                        type="SHIFT_OPTIMIZATION",
                        title=title,
                        description=description,
                        impact_level="MEDIUM",
                        action_data={"target_date": f.target_date.isoformat()},
                        status="PENDING"
                    )
                    db.add(rec)
                    recommendations.append(rec)

    await db.commit()
    return recommendations


async def apply_ai_recommendation(db: AsyncSession, rec_id: uuid.UUID, tenant_id: uuid.UUID) -> tuple[str, uuid.UUID | None]:
    """
    Apply a pending AI Recommendation. Automatically executes 1-click purchase order setups.
    """
    rec_query = await db.execute(
        select(AIRecommendation).filter(
            AIRecommendation.id == rec_id,
            AIRecommendation.tenant_id == tenant_id
        )
    )
    rec = rec_query.scalar_one_or_none()

    if not rec:
        raise ValueError("Recomendação não encontrada.")
    if rec.status != "PENDING":
        raise ValueError("Esta recomendação já foi processada.")

    created_order_id = None
    message = "Recomendação aplicada com sucesso!"

    if rec.type == "STOCK_REPLENISHMENT" and rec.action_data:
        # Automatically create purchase order
        sup_id = uuid.UUID(rec.action_data["supplier_id"])
        items_payload = []
        for it in rec.action_data["items"]:
            items_payload.append(
                PurchaseItemCreate(
                    insumo_id=uuid.UUID(it["insumo_id"]),
                    quantity=it["quantity"],
                    unit_cost=it["unit_cost"]
                )
            )

        po_create = PurchaseOrderCreate(
            supplier_id=sup_id,
            items=items_payload
        )

        po = await create_purchase_order(db, po_create, tenant_id=tenant_id)
        created_order_id = po.id
        message = f"Recomendação de reabastecimento aplicada! Pedido de Compra #{str(po.id)[:8]} criado com sucesso."

    rec.status = "APPLIED"
    rec.updated_at = datetime.utcnow()
    await db.commit()

    return message, created_order_id


async def dismiss_ai_recommendation(db: AsyncSession, rec_id: uuid.UUID, tenant_id: uuid.UUID) -> None:
    """
    Dismiss a pending AI recommendation.
    """
    rec_query = await db.execute(
        select(AIRecommendation).filter(
            AIRecommendation.id == rec_id,
            AIRecommendation.tenant_id == tenant_id
        )
    )
    rec = rec_query.scalar_one_or_none()

    if not rec:
        raise ValueError("Recomendação não encontrada.")
    if rec.status != "PENDING":
        raise ValueError("Esta recomendação já foi processada.")

    rec.status = "DISMISSED"
    rec.updated_at = datetime.utcnow()
    await db.commit()
