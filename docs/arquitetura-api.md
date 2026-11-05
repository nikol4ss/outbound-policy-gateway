# Arquitetura e API

## Organização

Monólito modular em TypeScript/Node.js: Next.js para painel/API e processo worker para tarefas persistidas. PostgreSQL/Supabase é o armazenamento compartilhado de produção. SQLite local serve exclusivamente ao sandbox de desenvolvimento. Não colocar SQLite no filesystem efêmero da Render nem compartilhar cópias independentes entre web e worker.

Fluxo: CRM/campanha → avaliar → registrar decisão/evidência → reavaliar antes do despacho → Vapi/Retell → evento autenticado → atualização de estado e opt-out → exportação.

## Identidade e autorização

Chaves de API são restritas ao workspace. O painel local troca a chave por sessão HTTP-only em `POST /api/session`; produção usa identidade Supabase validada e associação ao workspace. O identificador informado no corpo não concede acesso. Nunca colocar a chave administrativa do Supabase no browser ou confiar apenas em filtros de interface.

Aplicar isolamento no banco e na aplicação. Chaves `service_role` podem ignorar RLS; rotas privilegiadas precisam de autorização explícita. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Superfície pública

| Recurso | Responsabilidade |
|---|---|
| `/v1/consents` | Registrar e consultar consentimentos e suas evidências |
| `/v1/opt-outs` | Registrar supressão para vendedor/telefone |
| `/v1/checks` | Avaliar sem iniciar chamada |
| `/v1/calls` | Reavaliar, registrar e solicitar despacho |
| `/v1/webhooks/{provider}` | Autenticar eventos, deduplicar e processar campos permitidos |
| `/v1/audit/exports` | Exportar registros com referências e integridade verificável |
| `/v1/workspace` | Consultar configuração e prontidão do workspace |
| `/v1/policies` | Gerenciar versões de políticas dentro do escopo autorizado |
| `/v1/dnc` | Importar e consultar metadados/cobertura de listas autorizadas |
| `/v1/integrations` | Configurar integrações sem devolver credenciais em claro |
| `/v1/decisions` | Consultar histórico de decisões |
| `/v1/jobs` | Consultar processamento e falhas |

A resposta de avaliação contém `decision` (`ALLOW` ou `BLOCK`), `reason`, `policy_version` e `decision_id`; pode incluir `required_disclosure`. IDs são referências, não provas de validade do consentimento. Erro técnico não equivale a autorização.

Exemplo conceitual de entrada:

```json
{
  "phone": "+14155550123",
  "seller_id": "seller-example",
  "campaign": "lead-followup",
  "consent_id": "consent-example",
  "provider": "vapi",
  "state": "CA",
  "timezone": "America/Los_Angeles",
  "location_source": "customer-provided"
}
```

Esse exemplo não habilita uma jurisdição nem constitui evidência suficiente por si só. Políticas de sandbox não são aprovações para produção.

## Consistência e falhas

- Coordenar despacho e revogação por vendedor/telefone; reavaliar imediatamente antes do envio.
- `ALLOW` de `/checks` não é um passe reutilizável para `/calls`.
- Persistir intenção e identificador antes de chamar o provedor. Timeout ou resposta ambígua exigem reconciliação; não repetir às cegas.
- Usar idempotência nativa somente conforme o contrato do provedor. [Retell outbound](https://docs.retellai.com/deploy/outbound-call).
- Validar eventos usando o corpo original antes da desserialização quando a assinatura exigir. Descartar áudio, transcrição e campos não necessários antes de persistir.
- Nunca interromper a ingestão de opt-outs por franquia, inadimplência ou suspensão comercial.
- Confirmar opt-out somente após sua preservação recuperável; após restauração, manter despachos bloqueados até reconstituir os registros confirmados.

## Evidências e retenção

Banco mantém referências e projeções consultáveis. Evidências abrangidas pela matriz aprovada usam S3 com versionamento e Object Lock em modo compliance. Proteger também credenciais, chaves de criptografia e acesso administrativo; bloquear exclusão do objeto não substitui esses controles. [S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html).

Registrar versão da política, origem e texto do consentimento, resultado de cada controle, referência da lista DNC e correlação com a chamada. Preservar materiais de origem necessários antes da expiração nos provedores. Não atribuir cinco anos a todo objeto automaticamente: prazo e marco inicial vêm da matriz regulatória.

## Implantação e mudanças

Ambientes separados; configuração por variáveis; credenciais em armazenamento de segredos. A CI executa checagem, testes e build. Deploy permanece controlado, com rollback de aplicação e migrações compatíveis. O [Blueprint](../render.yaml) não provisiona Supabase, S3 ou aprovações jurídicas. [Render Blueprint](https://render.com/docs/blueprint-spec).

Tokens de ativação, referências de aprovação e flags não substituem evidências externas. O procedimento de liberação está no [manual operacional](operacao.md).
