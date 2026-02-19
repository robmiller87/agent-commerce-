# Agent Commerce 🛒

Agent-ready e-commerce with Amazon arbitrage fulfillment.

## The Thesis

Agents can't shop on Amazon (CAPTCHAs, anti-bot, complex checkout). We solve this by:
1. Listing popular products at 2-3% markup over Amazon
2. Providing a simple API agents can use
3. Fulfilling via Amazon when orders come in

**Value prop:** Pay a small premium, get agent-accessible checkout.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Agent/User    │────▶│  Agent Commerce │────▶│     Stripe      │
│   (API call)    │     │      API        │     │   (payment)     │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Order Queue    │
                        │  (Airtable/DB)  │
                        └────────┬────────┘
                                 │
                                 ▼ (manual for MVP)
                        ┌─────────────────┐
                        │     Amazon      │
                        │   (buy & ship)  │
                        └─────────────────┘
```

## MVP Scope

### Phase 1: Proof of Concept
- [ ] 10-20 curated products (stable prices, good margins)
- [ ] Simple REST API for browsing + checkout
- [ ] Stripe payment integration
- [ ] Manual fulfillment (Robert buys on Amazon)
- [ ] Basic order tracking

### Phase 2: Automation
- [ ] Price sync with Amazon (Keepa API or scraping)
- [ ] Stock availability checks
- [ ] Automated order notifications
- [ ] Return handling workflow

## API Design

```
GET  /api/products              # List all products
GET  /api/products/:id          # Product details
POST /api/orders                # Create order (agent checkout)
GET  /api/orders/:id            # Order status
```

### Example: Agent Checkout

```bash
curl -X POST https://agent-commerce.example.com/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "bose-qc45",
    "quantity": 1,
    "shipping": {
      "name": "Robert Miller",
      "address": "123 Main St",
      "city": "Biarritz",
      "country": "FR",
      "postal": "64200"
    },
    "payment_method": "pm_card_visa"
  }'
```

### Response

```json
{
  "order_id": "ord_abc123",
  "status": "paid",
  "total": 420.00,
  "currency": "USD",
  "estimated_delivery": "2026-02-26",
  "tracking": null
}
```

## Product Catalog Strategy

### Selection Criteria
- Amazon price stability (use Keepa to verify)
- High demand, low return rate
- Easy to ship (not oversized)
- $100-500 price range (good absolute margin)

### Initial Products
| Product | Amazon Price | Our Price | Margin |
|---------|-------------|-----------|--------|
| Bose QC45 | $329 | $339 | $10 (3%) |
| AirPods Pro 2 | $249 | $256 | $7 (2.8%) |
| Logitech MX Master 3S | $99 | $102 | $3 (3%) |
| Sony WH-1000XM5 | $398 | $410 | $12 (3%) |
| Keychron Q1 Pro | $199 | $205 | $6 (3%) |

## Tech Stack

- **Runtime:** Node.js + Express
- **Database:** SQLite (MVP) → PostgreSQL (scale)
- **Payments:** Stripe
- **Hosting:** Vercel or Railway
- **Order Management:** Airtable (MVP) → Custom dashboard

## Revenue Model

At 3% margin:
- 10 orders/week @ $300 avg = $90/week profit
- 50 orders/week @ $300 avg = $450/week profit

Not a business. It's validation + community building.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Amazon ToS violation | Stay low volume, use business account |
| Price drift | Daily price sync, pause listings if drift >5% |
| Out of stock | Check availability before confirming order |
| Returns | Clear return policy, eat cost if needed |

## Getting Started

```bash
cd ~/clawd/projects/agent-commerce
npm install
cp .env.example .env  # Add Stripe keys
npm run dev
```

## Links

- Stripe Dashboard: https://dashboard.stripe.com
- Amazon Business: https://business.amazon.com
- Keepa (price tracking): https://keepa.com
