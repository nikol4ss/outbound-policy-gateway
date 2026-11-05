# Matriz regulatória — pacote para revisão

**Estado: não aprovada para produção.** Este documento organiza o trabalho de um advogado americano especializado. Não é parecer jurídico, não habilita estados e não deve ser transformado automaticamente em regras de produção.

## Escopo solicitado ao especialista

Marketing outbound com voz de IA, leads próprios do vendedor, consentimento documentado, duas plataformas e operação do SaaS a partir do Brasil. Revisar finalidade, tipo de destinatário, jurisdição, horários, origem do consentimento, revogação, DNC, divulgação, registros e responsabilidades entre agência, vendedor e SaaS.

Revisar também termos, privacidade, processamento de dados, suboperadores, transferências internacionais, resposta a incidentes, retenção após cancelamento e encerramento do serviço. Excluir atividades não avaliadas; ausência de regra não significa permissão.

## Matriz de cobertura

| ID | Uso / jurisdição | Requisitos e fontes | Vigência | Responsável pela revisão | Referência de aprovação | Estado |
|---|---|---|---|---|---|---|
| COV-001 | Marketing com voz de IA / federal | TCPA, TSR, consentimento, opt-out, DNC e registros aplicáveis | A verificar | Advogado americano | Não recebida | Bloqueado para produção |
| COV-002 | Estados dos primeiros clientes | Mapear regras estaduais, horários e restrições adicionais | A verificar | Advogado americano | Não recebida | Sem estados habilitados |
| COV-003 | Gravação e transcrição | Fora da retenção integral do MVP; revisar práticas dos provedores/clientes | A verificar | Advogado americano | Não recebida | Não coberto pelo MVP |

Cada política aprovada deve ter ID/versão, data de publicação, início/fim de vigência, casos positivos e negativos, jurisdições, revisor e artefato da aprovação. Aprovação não será uma opção livre de um cliente na interface de produção.

## Matriz de retenção e responsabilidade

Preencher os prazos e marcos com a revisão jurídica. A regra final e orientações específicas devem prevalecer sobre textos gerais desatualizados.

| Categoria | Origem | Responsável proposto | Marco inicial a confirmar | Prazo / retenção | Exportação |
|---|---|---|---|---|---|
| Consentimento e texto apresentado | Formulário/CRM do vendedor | Vendedor fornece; SaaS preserva evidência recebida | Conforme uso e regra aplicável | A aprovar | JSON + artefato |
| Decisão, política e controles | Gateway | SaaS | Conforme categoria | A aprovar | JSON/CSV + referências |
| Scripts e versões de campanha | Vendedor/provedor | Responsabilidade contratual explícita | Fim de uso pode ser relevante | A aprovar | Artefato versionado |
| Identidade do vendedor, caller ID e autorização | Vendedor/provedor | Vendedor fornece; SaaS registra escopo recebido | Conforme categoria | A aprovar | JSON + evidência |
| DNC: versão, acesso, cobertura e consulta | Fonte autorizada | Vendedor e prestador conforme contrato | Conforme categoria | A aprovar | Metadados e referência protegida |
| Opt-out e propagação | Cliente, CRM ou agente de voz | SaaS no fluxo integrado; vendedor nos demais canais | Conforme categoria | A aprovar | Eventos duráveis |
| Chamada e resultado | Vapi/Retell | Responsabilidade distribuída por contrato | Conforme categoria | A aprovar | Campos permitidos + correlação |
| Contratos e prestadores | Agência/vendedor/SaaS | Cada parte conforme obrigação | Fim do contrato pode ser relevante | A aprovar | Documento e referências |

Não marcar um item como coberto se o SaaS apenas guarda um link temporário para o provedor. Não apagar evidências de retenção obrigatória em resposta automática ao cancelamento. Solicitações de privacidade exigem classificação por categoria e base aplicável.

## Prova de acesso National DNC

- Identificar vendedor e direito de acesso; não compartilhar uma assinatura entre vendedores independentes.
- Comprovar cobertura dos códigos de área necessários e processo autorizado de obtenção/importação.
- Guardar versão, data, cobertura e referência protegida da autorização.
- Impedir uso de lista vencida ou sem cobertura quando exigida.
- Confirmar responsabilidades de atualização e efeito da perda do acesso.

O SAN não é, por si só, uma API de consulta síncrona. O teste de acesso deve ocorrer antes de prometer automação completa.

## Fontes do planejamento

- [FCC 24-17 — voz artificial/pré-gravada e IA](https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf).
- [FTC — FAQ sobre National DNC](https://www.ftc.gov/business-guidance/resources/qa-telemarketers-sellers-about-dnc-provisions-tsr-0).
- [FTC — orientação específica sobre registros, outubro de 2024](https://www.ftc.gov/business-guidance/blog/2024/10/mark-your-calendars-telemarketers-sellers-october-15-telemarketing-sales-rules-record-store-day).
- [Regra final de registros, Federal Register de 16/04/2024](https://www.govinfo.gov/content/pkg/FR-2024-04-16/pdf/2024-07180.pdf).
- [FTC — TSR e interação com regras estaduais](https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule).
- [FCC 26-67 — publicação de 26/10/2026](https://www.govinfo.gov/content/pkg/FR-2026-10-26/pdf/2026-21821.pdf): revisar transição e vigência na data de lançamento, sem reutilizar resumos antigos.

Essas fontes fundamentam a necessidade de revisão; não constituem uma matriz jurídica completa. Revalidar na data da implantação e após cada mudança relevante.
