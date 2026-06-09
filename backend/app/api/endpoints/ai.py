import uuid
from datetime import date, datetime
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.api import deps
from app.core.database import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.models.insumo import Insumo
from app.models.order import Order
from app.models.supplier import Supplier
from app.models.schedules import EmployeeSchedule
from app.schemas.ai import (
    DemandForecastOut, AIRecommendationOut, AIRecommendationApplyOut,
    CopilotRequest, CopilotResponse
)
from app.crud import (
    get_demand_forecast, generate_ai_recommendations,
    apply_ai_recommendation, dismiss_ai_recommendation,
    create_audit_log
)

router = APIRouter()


@router.get("/forecast", response_model=List[DemandForecastOut])
async def list_demand_forecasts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    Get 7-day demand forecasts for active tenant.
    """
    forecasts = await get_demand_forecast(db, current_tenant.id)
    return forecasts


@router.get("/recommendations", response_model=List[AIRecommendationOut])
async def list_ai_recommendations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    Get active smart PENDING recommendations (replenishments & schedule advice).
    """
    recs = await generate_ai_recommendations(db, current_tenant.id)
    return recs


@router.post("/recommendations/{rec_id}/apply", response_model=AIRecommendationApplyOut)
async def apply_recommendation(
    rec_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER", "SUPERVISOR"]))]
):
    """
    Apply a pending AI recommendation (e.g., auto-generating a supplier purchase order).
    """
    try:
        msg, order_id = await apply_ai_recommendation(db, rec_id, current_tenant.id)
        
        # Audit
        await create_audit_log(
            db,
            tenant_id=current_tenant.id,
            user_id=current_user.id,
            action="AI_RECOMMENDATION_APPLY",
            table_name="ai_recommendations",
            record_id=str(rec_id),
            after_state={"message": msg, "created_order_id": str(order_id) if order_id else None}
        )
        return {"message": msg, "created_order_id": order_id}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/recommendations/{rec_id}/dismiss", status_code=status.HTTP_204_NO_CONTENT)
async def dismiss_recommendation(
    rec_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER", "SUPERVISOR"]))]
):
    """
    Dismiss a pending AI recommendation.
    """
    try:
        await dismiss_ai_recommendation(db, rec_id, current_tenant.id)
        # Audit
        await create_audit_log(
            db,
            tenant_id=current_tenant.id,
            user_id=current_user.id,
            action="AI_RECOMMENDATION_DISMISS",
            table_name="ai_recommendations",
            record_id=str(rec_id)
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/copilot", response_model=CopilotResponse)
async def interactive_copilot(
    payload: CopilotRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    SaaS Chat Copilot powered by database parsing heuristics.
    Answers dynamically using real SQLite records from the tenant's context.
    """
    msg = payload.message.lower().strip()
    
    # Intent 1: Vendas/Faturamento (Sales & Revenue)
    if any(k in msg for k in ["faturamento", "venda", "faturado", "financeiro", "ganh", "receit"]):
        orders_query = await db.execute(
            select(
                func.sum(Order.total_price),
                func.count(Order.id)
            ).filter(Order.tenant_id == current_tenant.id)
        )
        revenue, orders_count = orders_query.first()
        revenue = float(revenue) if revenue else 0.0
        orders_count = int(orders_count) if orders_count else 0
        avg_ticket = round(revenue / orders_count, 2) if orders_count > 0 else 0.0

        response = (
            f"### 📊 Desempenho Financeiro da Empresa\n\n"
            f"Identifiquei as seguintes métricas consolidadas em nossa base de dados:\n"
            f"- **Total de Pedidos Realizados**: `{orders_count}` vendas fechadas\n"
            f"- **Faturamento Bruto Consolidado**: `R$ {revenue:,.2f}`\n"
            f"- **Ticket Médio por Venda**: `R$ {avg_ticket:,.2f}`\n\n"
            f"Estes dados refletem o histórico total transacionado na plataforma."
        )
        return {"response": response}

    # Intent 2: Estoque/Insumos Críticos (Stock Critical Insumos)
    if any(k in msg for k in ["estoque", "insumo", "falta", "crític", "ruptur", "acab"]):
        critical_query = await db.execute(
            select(Insumo).filter(
                Insumo.tenant_id == current_tenant.id,
                Insumo.current_stock < Insumo.minimum_stock
            )
        )
        critical_insumos = critical_query.scalars().all()

        if not critical_insumos:
            response = (
                f"### ⚠️ Controle de Estoque & Rupturas\n\n"
                f"🎉 **Excelente notícia!** Não há nenhum insumo operando abaixo do estoque de segurança no momento.\n"
                f"Todos os materiais estão em níveis operacionais ideais."
            )
        else:
            rows = ""
            for i in critical_insumos:
                rows += f"| {i.name} | `{i.current_stock:.1f}` | `{i.minimum_stock:.1f}` | {i.unit} | 🔴 Crítico |\n"
            
            response = (
                f"### ⚠️ Alertas de Ruptura de Estoque\n\n"
                f"Identifiquei **{len(critical_insumos)}** insumo(s) abaixo do limite de segurança:\n\n"
                f"| Insumo | Estoque Atual | Mínimo Requerido | Unidade | Status |\n"
                f"| :--- | :---: | :---: | :---: | :---: |\n"
                f"{rows}\n"
                f"*Dica: Vá até o painel de **IA Analytics** para aplicar as recomendações de compra sugeridas em 1-clique!*"
            )
        return {"response": response}

    # Intent 3: Escalas/Colaboradores (Shift Schedules today)
    if any(k in msg for k in ["escala", "turno", "trabalha", "quem", "colaborad", "equipe", "funcion"]):
        today = date.today()
        sched_query = await db.execute(
            select(EmployeeSchedule).filter(
                EmployeeSchedule.tenant_id == current_tenant.id,
                EmployeeSchedule.shift_date == today
            )
        )
        schedules = sched_query.scalars().all()

        if not schedules:
            response = (
                f"### 📅 Escalas de Turnos para Hoje ({today.strftime('%d/%m/%Y')})\n\n"
                f"Nenhum colaborador foi escalado para trabalhar no dia de hoje.\n"
                f"Acesse a aba **Escalas & Turnos** para atribuir novos turnos rápidos no quadro semanal."
            )
        else:
            rows = ""
            for s in schedules:
                emp_name = s.user.name if s.user else "N/A"
                emp_role = s.user.role if s.user else "OPERATOR"
                rows += f"| {emp_name} | {emp_role} | `{s.start_time} até {s.end_time}` | {s.notes or '-'}\n"
            
            response = (
                f"### 📅 Escalas de Turnos para Hoje ({today.strftime('%d/%m/%Y')})\n\n"
                f"Temos **{len(schedules)}** turno(s) ativo(s) agendado(s) para hoje:\n\n"
                f"| Colaborador | Função | Horário do Turno | Observações |\n"
                f"| :--- | :--- | :---: | :--- |\n"
                f"{rows}\n"
                f"Consulte o quadro interativo de escalas se precisar realizar trocas de folgas."
            )
        return {"response": response}

    # Intent 4: Fornecedores (Suppliers & performance overview)
    if any(k in msg for k in ["fornecedor", "parceir", "scorecard", "compr"]):
        sup_query = await db.execute(select(Supplier).filter(Supplier.tenant_id == current_tenant.id))
        suppliers = sup_query.scalars().all()

        if not suppliers:
            response = (
                f"### 🤝 Nossos Fornecedores Ativos\n\n"
                f"Nenhum parceiro comercial foi cadastrado neste tenant até o momento.\n"
                f"Acesse a aba **Fornecedores** para cadastrar novos contatos de suprimentos."
            )
        else:
            rows = ""
            for s in suppliers:
                rows += f"| {s.name} | {s.contact_name or '-'} | {s.email or '-'} | {s.phone or '-'}\n"
            
            response = (
                f"### 🤝 Nossos Fornecedores Cadastrados\n\n"
                f"Identifiquei **{len(suppliers)}** parceiro(s) ativo(s) na empresa:\n\n"
                f"| Fornecedor | Contato Comercial | E-mail | Telefone |\n"
                f"| :--- | :--- | :--- | :--- |\n"
                f"{rows}\n"
                f"Dica: Acesse a aba **Fornecedores** para ver o Scorecard de Performance de cada parceiro."
            )
        return {"response": response}

    # Fallback response
    response = (
        f"Olá, **{current_user.name}**! Sou o **Copiloto Inteligente do Gestor SaaS** 🤖.\n\n"
        f"Posso extrair respostas diretamente do banco de dados em tempo real. "
        f"Experimente me perguntar:\n"
        f"- 📊 *\"Qual o faturamento bruto atual?\"*\n"
        f"- ⚠️ *\"Quais insumos estão críticos de estoque?\"*\n"
        f"- 📅 *\"Quem está escalado para trabalhar hoje?\"*\n"
        f"- 🤝 *\"Quais fornecedores temos cadastrados?\"*\n\n"
        f"Como posso ajudar a otimizar sua operação hoje?"
    )
    return {"response": response}
