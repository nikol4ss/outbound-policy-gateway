# Produto

## Problema e proposta

Agências mantêm consentimentos, bloqueios e regras em vários sistemas. O produto aplica políticas antes do envio a Vapi ou Retell e relaciona decisão, política e evidência. Não vende telefonia, aconselhamento jurídico ou garantia universal de compliance.

## Escopo do MVP

- Agência com até três workspaces na oferta inicial; cada workspace representa um vendedor identificado.
- Consentimento com origem, texto apresentado, telefone, vendedor, escopo, data e referência de evidência.
- Opt-out por vendedor/telefone compartilhado entre os dois provedores.
- DNC interno e importação autorizada do National DNC quando exigida pela política.
- Políticas versionadas com vigência, jurisdições, horários, requisitos e divulgação configurada.
- Avaliação determinística; despacho condicionado a nova avaliação e persistência.
- Eventos autenticados, deduplicação, estado desconhecido e reconciliação.
- Painel, diagnóstico, consumo e exportação auditável.

Ficam fora: HighLevel, inbound, campanhas sem cobertura aprovada, análise por LLM, SDK próprio, retenção indiscriminada de áudio/transcrição, discagem fora do gateway e cobrança de telefonia.

## Jornadas

1. Criar ou acessar a agência e identificar o vendedor.
2. Vincular fontes de consentimento e configurar a política suportada.
3. Configurar Vapi e Retell, incluindo retorno de eventos e opt-out estruturado.
4. Executar uma avaliação em sandbox; corrigir motivos de bloqueio.
5. Executar um despacho simulado e exportar sua trilha.
6. Revisar o diagnóstico de prontidão e as rotas paralelas da campanha.
7. Ativar produção somente após os gates do plano mestre.

Não usar métricas ou chamadas simuladas como prova de atividade real. O modo sandbox deve ser visível no painel e nos registros.

## Critérios funcionais

| Cenário | Resultado esperado |
|---|---|
| Consentimento ausente, incompatível, vencido ou revogado | `BLOCK`, com motivo auditável |
| Opt-out em Vapi seguido de tentativa em Retell | Nova chamada bloqueada para o mesmo vendedor/telefone |
| Estado/fuso sem evidência suficiente | Bloqueio; código de área não substitui localização |
| Política fora da vigência ou sem aprovação | Bloqueio |
| DNC obrigatório ausente, vencido ou sem cobertura | Bloqueio |
| Evento repetido ou fora de ordem | Sem duplicação de efeitos nem regressão de estado |
| Timeout após solicitação ao provedor | Estado desconhecido; sem nova discagem automática |
| Suspensão ou franquia esgotada | Novas chamadas bloqueadas; opt-outs e eventos continuam aceitos |
| Restauração do banco | Despachos suspensos até recuperação dos bloqueios confirmados |
| Consulta entre workspaces | Dados inacessíveis fora do escopo autorizado |

## Hipóteses comerciais e métricas

Oferta de teste: US$ 79/mês, três workspaces, 10 mil avaliações únicas. Retentativas técnicas não duplicam consumo. Franquia e preço são hipóteses para medição no piloto; não há excedente cobrado automaticamente.

Ativação = primeira sequência completa de consentimento → decisão → despacho autorizado/simulado → evento → exportação. Medir separadamente sandbox e produção. Acompanhar tempo de ativação, conversão paga, retenção em 30 dias, custo por conta, minutos de suporte, chamadas bloqueadas por motivo e razões de cancelamento.

Meta de engenharia inicial: p95 da avaliação até um segundo a dez requisições por segundo, com despacho medido separadamente. Só divulgar desempenho depois de registrar ambiente, carga, volume de dados e resultado. Não é SLA contratual.
