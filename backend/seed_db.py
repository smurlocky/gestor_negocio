import asyncio
import uuid
from datetime import datetime, timezone

from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.tenant import Tenant
from app.models.user import User
from app.models.category import Category
from app.models.insumo import Insumo
from app.models.product import Product, ProductIngredient
from app.models.supplier import Supplier

async def seed_data():
    print("Iniciando a população do banco de dados com dados de demonstração (Pequena/Média Empresa)...")
    
    # Optional: you could drop all tables and recreate them if you want a fresh start
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        
    async with SessionLocal() as session:
        # 1. Create Tenant
        tenant = Tenant(
            name="Sabores & Cia Ltda",
            slug="sabores-cia"
        )
        session.add(tenant)
        await session.flush()
        
        # 2. Create Users
        admin_user = User(
            tenant_id=tenant.id,
            name="João Silva (Gerente)",
            email="joao@saborescia.com",
            hashed_password=get_password_hash("admin123"),
            role="MANAGER"
        )
        op_user = User(
            tenant_id=tenant.id,
            name="Maria Santos (Operadora)",
            email="maria@saborescia.com",
            hashed_password=get_password_hash("operador123"),
            role="OPERATOR"
        )
        session.add_all([admin_user, op_user])
        await session.flush()

        # 3. Create Categories
        cat_bebidas = Category(tenant_id=tenant.id, name="Bebidas", type="PRODUCT")
        cat_lanches = Category(tenant_id=tenant.id, name="Lanches Rápidos", type="PRODUCT")
        cat_pratos = Category(tenant_id=tenant.id, name="Pratos Principais", type="PRODUCT")
        
        cat_carnes = Category(tenant_id=tenant.id, name="Carnes e Frios", type="INSUMO")
        cat_hortifruti = Category(tenant_id=tenant.id, name="Hortifruti", type="INSUMO")
        cat_mercenaria = Category(tenant_id=tenant.id, name="Mercearia", type="INSUMO")
        cat_embalagens = Category(tenant_id=tenant.id, name="Embalagens", type="INSUMO")
        
        session.add_all([cat_bebidas, cat_lanches, cat_pratos, cat_carnes, cat_hortifruti, cat_mercenaria, cat_embalagens])
        await session.flush()

        # 4. Create Insumos (Raw Materials)
        insumo_pao = Insumo(
            tenant_id=tenant.id, category_id=cat_mercenaria.id,
            name="Pão de Hambúrguer Brioche", unit="un",
            current_stock=150, minimum_stock=50, unit_cost=1.50
        )
        insumo_carne = Insumo(
            tenant_id=tenant.id, category_id=cat_carnes.id,
            name="Blend de Carne Angus (Burger)", unit="kg",
            current_stock=25.5, minimum_stock=10.0, unit_cost=35.00
        )
        insumo_queijo = Insumo(
            tenant_id=tenant.id, category_id=cat_carnes.id,
            name="Queijo Cheddar Fatiado", unit="kg",
            current_stock=8.0, minimum_stock=3.0, unit_cost=42.00
        )
        insumo_alface = Insumo(
            tenant_id=tenant.id, category_id=cat_hortifruti.id,
            name="Alface Americana", unit="un",
            current_stock=20, minimum_stock=5, unit_cost=2.50
        )
        insumo_tomate = Insumo(
            tenant_id=tenant.id, category_id=cat_hortifruti.id,
            name="Tomate Carmem", unit="kg",
            current_stock=12.0, minimum_stock=4.0, unit_cost=6.50
        )
        insumo_batata = Insumo(
            tenant_id=tenant.id, category_id=cat_mercenaria.id,
            name="Batata Frita Congelada", unit="kg",
            current_stock=45.0, minimum_stock=15.0, unit_cost=14.90
        )
        insumo_coca = Insumo(
            tenant_id=tenant.id, category_id=cat_bebidas.id,
            name="Coca-Cola Lata 350ml", unit="un",
            current_stock=240, minimum_stock=48, unit_cost=2.80
        )
        insumo_caixa_burger = Insumo(
            tenant_id=tenant.id, category_id=cat_embalagens.id,
            name="Caixa Kraft para Burger", unit="un",
            current_stock=500, minimum_stock=100, unit_cost=0.45
        )
        
        session.add_all([
            insumo_pao, insumo_carne, insumo_queijo, insumo_alface, 
            insumo_tomate, insumo_batata, insumo_coca, insumo_caixa_burger
        ])
        await session.flush()

        # 5. Create Products & Recipes (Fichas Técnicas)
        
        # Produto 1: Cheeseburger Clássico
        prod_burger = Product(
            tenant_id=tenant.id, category_id=cat_lanches.id,
            name="Cheeseburger Clássico", price=28.90, is_active=True
        )
        session.add(prod_burger)
        await session.flush()
        
        # Ingredientes do Burger (Ficha Técnica)
        session.add_all([
            ProductIngredient(product_id=prod_burger.id, insumo_id=insumo_pao.id, quantity=1.0),
            ProductIngredient(product_id=prod_burger.id, insumo_id=insumo_carne.id, quantity=0.180), # 180g de carne
            ProductIngredient(product_id=prod_burger.id, insumo_id=insumo_queijo.id, quantity=0.040), # 40g de queijo
            ProductIngredient(product_id=prod_burger.id, insumo_id=insumo_alface.id, quantity=0.1), # 1/10 de um pé de alface
            ProductIngredient(product_id=prod_burger.id, insumo_id=insumo_tomate.id, quantity=0.050), # 50g de tomate
            ProductIngredient(product_id=prod_burger.id, insumo_id=insumo_caixa_burger.id, quantity=1.0),
        ])
        
        # Produto 2: Porção de Batata Frita Média
        prod_batata = Product(
            tenant_id=tenant.id, category_id=cat_lanches.id,
            name="Porção de Batatas (Média)", price=14.90, is_active=True
        )
        session.add(prod_batata)
        await session.flush()
        
        session.add_all([
            ProductIngredient(product_id=prod_batata.id, insumo_id=insumo_batata.id, quantity=0.250), # 250g
        ])
        
        # Produto 3: Refrigerante Lata
        prod_refri = Product(
            tenant_id=tenant.id, category_id=cat_bebidas.id,
            name="Refrigerante Lata 350ml", price=6.00, is_active=True
        )
        session.add(prod_refri)
        await session.flush()
        
        session.add_all([
            ProductIngredient(product_id=prod_refri.id, insumo_id=insumo_coca.id, quantity=1.0),
        ])

        # 6. Create Suppliers (Fornecedores)
        sup_carnes = Supplier(
            tenant_id=tenant.id,
            name="Frigorífico Boi Gordo S/A",
            contact_name="Carlos Mendes",
            email="vendas@boigordo.com.br",
            phone="(11) 9988-7766"
        )
        sup_horti = Supplier(
            tenant_id=tenant.id,
            name="Hortifruti Frescor da Fazenda",
            contact_name="Dona Ana",
            email="contato@frescorfazenda.com.br",
            phone="(11) 3344-5566"
        )
        sup_bebidas = Supplier(
            tenant_id=tenant.id,
            name="Distribuidora de Bebidas Geladão",
            contact_name="Beto",
            email="pedidos@geladao.com",
            phone="(11) 9777-6655"
        )
        
        session.add_all([sup_carnes, sup_horti, sup_bebidas])
        
        # Commit everything to the database
        await session.commit()
        print("\n✅ Banco de dados populado com sucesso!")
        print("\n=============================================")
        print("🏢 Empresa: Sabores & Cia Ltda")
        print("\n🔑 Usuários Criados:")
        print("1. Gerente (Acesso Total):")
        print("   Email: joao@saborescia.com")
        print("   Senha: admin123")
        print("\n2. Operador (PDV/Operacional):")
        print("   Email: maria@saborescia.com")
        print("   Senha: operador123")
        print("\n📦 O que foi cadastrado:")
        print("- 7 Categorias de produtos e insumos")
        print("- 8 Insumos base (com custos e estoque inicial)")
        print("- 3 Produtos finais com Fichas Técnicas (Receitas)")
        print("- 3 Fornecedores ativos")
        print("=============================================")

if __name__ == "__main__":
    asyncio.run(seed_data())
