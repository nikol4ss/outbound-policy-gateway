# Manual operacional

## Ambientes e liberação

Local: dados fictícios, SQLite e provedores simulados. Homologação: configuração isolada, sem dados reais desnecessários. Produção: PostgreSQL compartilhado, identidade validada, evidências duráveis e gates aprovados. A configuração sozinha não prova prontidão.

Antes de provisionar o [Blueprint](../render.yaml), confirmar repositório remoto, contas dos fornecedores, orçamento e região. Web e worker precisam compartilhar banco, chave de criptografia, políticas e armazenamento. Não usar SQLite nos dois serviços Render. Segredos de serviço marcados `sync: false` devem ser fornecidos durante a configuração; mudanças posteriores precisam ser verificadas no dashboard do provedor. [Render](https://render.com/docs/blueprint-spec).

Checklist de liberação:

1. Executar checagem, testes e build; guardar a revisão de código e a identificação da versão.
2. Revisar migrações, permissões e plano de rollback antes de aplicá-las.
3. Confirmar autenticação, isolamento de workspaces e proteção de credenciais.
4. Confirmar S3 com versionamento, retenção aprovada e teste de negação de exclusão da versão protegida.
5. Confirmar referências reais de aprovação jurídica, políticas e acesso DNC.
6. Testar Vapi e Retell com números autorizados, incluindo eventos e opt-out durante a chamada.
7. Exercitar interrupção e recuperação; somente depois habilitar despachos reais.

Registrar evidências e executor de cada item. Não marcar concluído a partir de teste com mock ou flag preenchida.

## Monitoramento e suporte

Alertas: falha de avaliação, erro de persistência, aumento de resultados desconhecidos, atraso de eventos, DNC próximo do vencimento, falha de preservação e custo anormal. Logs devem mascarar telefones e excluir credenciais, áudio e transcrição.

Suporte inicial por e-mail em até um dia útil. Alertas técnicos são imediatos, mas não existe promessa de equipe 24 horas. Escalar solicitações jurídicas para o especialista responsável; suporte não interpreta validade legal de consentimento.

Revisão semanal: incidentes, dúvidas, backlog e custos. Mensal: métricas, mudanças regulatórias e fornecedores. Trimestral: restauração, acessos e continuidade.

## Incidentes

| Evento | Ação imediata | Critério de retomada |
|---|---|---|
| Suspeita de `ALLOW` indevido | Pausar despachos no escopo afetado; preservar decisões | Causa corrigida, casos de regressão aprovados e impacto avaliado |
| Credencial exposta | Revogar/rotacionar, pausar integração e revisar acessos | Nova credencial testada e escopo de exposição apurado |
| Resultado de chamada desconhecido | Não reenviar; reconciliar com provedor | Identidade e resultado confirmados ou tratamento manual registrado |
| Falha no registro de opt-out | Bloquear novos despachos afetados; manter ingestão recuperável | Revogações preservadas e projeções reconciliadas |
| DNC vencido/sem acesso | Bloquear chamadas que dependem da consulta | Nova lista autorizada e cobertura verificada |
| Vazamento entre workspaces | Interromper acesso afetado e preservar evidências | Isolamento corrigido e avaliação de incidente concluída |

Pausa operacional não significa rejeitar opt-outs. Usar bloqueio por cliente/provedor quando possível e global quando a causa for compartilhada. Comunicações externas de incidente exigem informações verificadas e aplicação dos contratos/regras pertinentes.

## Backup e restauração

Backups diários do banco não substituem a preservação independente dos opt-outs confirmados. O teste deve comprovar recuperação das revogações ocorridas depois do último backup.

1. Pausar todos os despachos; registrar o instante e a versão em execução.
2. Restaurar banco e configuração em ambiente isolado, sem credenciais de discagem habilitadas.
3. Recuperar registros duráveis de opt-out e evidências posteriores ao backup.
4. Reaplicar projeções e bloqueios de modo idempotente; conferir contagens e integridade.
5. Reconciliar chamadas pendentes/desconhecidas com os provedores; nunca reencaminhar automaticamente uma intenção ambígua.
6. Verificar credenciais, permissões, filas, DNC e políticas vigentes.
7. Executar casos sentinela de bloqueio e um ciclo sandbox; documentar resultados.
8. Reabrir gradualmente apenas os workspaces verificados.

Sem fonte independente íntegra, permanecer pausado. Documentar RPO/RTO medidos no exercício; não prometer objetivos que não foram demonstrados. [Backups Supabase](https://supabase.com/docs/guides/platform/backups).

## Cancelamento, exportação e encerramento

Cancelamento interrompe novos despachos conforme o contrato, mas mantém recepção de opt-outs/eventos e acesso autorizado a exportações necessárias. Separar dados elimináveis de evidências com retenção ou preservação legal. Não reduzir prazos de Object Lock nem apagar registros por simples exclusão da conta.

Exportar decisões, políticas, consentimentos, opt-outs, metadados DNC e resultados cobertos com manifesto de integridade e referências recuperáveis. Confirmar entrega e responsabilidade futura. Links temporários de fornecedores não bastam como exportação permanente.

Encerramento do SaaS: inventariar obrigações por cliente e categoria, preparar exportações, definir custeio/continuidade de armazenamento, comunicar nos termos aprovados e eliminar somente dados elegíveis. O procedimento e a reserva financeira precisam existir antes do lançamento ampliado.
