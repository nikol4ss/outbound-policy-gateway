# Outbound Policy Gateway

A workspace-scoped policy gateway for outbound AI calls through Vapi and Retell. It evaluates configured calling policies, records decisions, propagates opt-outs, and preserves evidence. It does not provide legal advice or guarantee compliance for calls made outside the gateway.

## Local sandbox

Requirements: Node.js 24 and npm. No provider credentials are needed for sandbox calls.

```sh
npm install
npm run setup
npm run dev
```

In a second terminal:

```sh
npm run worker
```

Open [localhost:3000](http://localhost:3000). Use the workspace API key printed by setup to establish a local dashboard session. Treat this key as a credential; do not commit or share it. Local data belongs in the ignored `.data` directory. Sandbox provider results are simulated and must never be represented as real calls.

See [`.env.example`](.env.example) for configuration. Keep `GATEWAY_MODE=sandbox` and `LIVE_CALLS_ENABLED=false` while developing. Copy configuration only when needed; never paste real credentials into source files, issue reports, or logs.

## Verification

```sh
npm run check
npm test
npm run build
```

The checks prove local behavior only. Provider contract tests and sandbox simulations do not establish that a real account, webhook, DNC access, cloud deployment, or legal policy has been approved.

## Deployment boundaries

[`render.yaml`](render.yaml) describes a web process and a worker. It is a reviewable deployment template, not evidence that services exist. Both processes must use the same PostgreSQL database, encryption key, storage configuration, and policy approvals. Never use local SQLite as shared cloud storage.

Before live operation, verify Supabase authentication and workspace membership, PostgreSQL isolation, independent durable opt-out storage, S3 retention configuration, approved policies and jurisdictions, both provider integrations, authorized DNC access where required, and restoration. Live dispatch remains disabled until these checks and the legal review have passed.

Billing integration and public paid launch depend on merchant approval. The repository does not contain legal sign-off, customer commitments, a payment-provider acceptance, or a promise of 24/7 support.

## Project documents (Português)

| Document | Purpose |
|---|---|
| [Plano mestre](docs/plano-mestre.md) | Workstreams, sequencing, responsibilities, dependencies and gates |
| [Produto](docs/produto.md) | Scope, journeys, acceptance criteria and metrics |
| [Arquitetura e API](docs/arquitetura-api.md) | Boundaries, contracts, storage and security |
| [Matriz regulatória](docs/matriz-regulatoria.md) | Review package and coverage/retention templates |
| [Comercial](docs/comercial.md) | Interviews, pilot, positioning and acquisition |
| [Orçamento](docs/orcamento.md) | Cost assumptions, unit economics and quote register |
| [Operação](docs/operacao.md) | Deployment, incidents, recovery and account closure |
| [Backlog CSV](docs/backlog.csv) | Portable task register for GitHub Projects |

No remote GitHub project is created by these files. Import the backlog only into the confirmed repository/project after a remote is configured.
