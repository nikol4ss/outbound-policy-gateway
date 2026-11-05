# Plano mestre

Referência: plano aprovado nesta conversa, em 05/11/2026. A pesquisa original define a oportunidade; projeções e orçamento são hipóteses, não resultados observados.

## Direção e capacidade

Fundador solo com IA, 20–30 horas por semana, especialistas pontuais. MVP multivendor com Vapi e Retell. Público inicial: agências americanas que operam campanhas de marketing para vendedores identificados. Produto e atendimento em inglês; gestão interna em português.

Estimativa de planejamento: 450–600 horas, ou 18–24 semanas a 25 horas semanais. Prazos de terceiros podem ampliar o calendário. Não converter essa estimativa em compromisso comercial antes de medir a execução.

## Etapas

| Etapa | Horas | Entrega | Dependência para avançar |
|---|---:|---|---|
| 1. Validar negócio e viabilidade | 40–60 | Entrevistas, três compromissos de piloto, revisão jurídica iniciada, prova de acesso DNC e avaliação de cobrança | Evidências do problema e disposição de testar |
| 2. Construir a base | 60–80 | Autenticação, isolamento, ambientes, banco e entrega de software | Contratos técnicos definidos |
| 3. Políticas e evidências | 110–140 | Consentimentos, opt-outs, DNC, horários, versões e exportação | Base e casos de referência revisados |
| 4. Vapi e Retell | 90–120 | Despacho, eventos, revogação e reconciliação nos dois provedores | Motor e preservação de evidências |
| 5. Produto e comercialização | 80–110 | Painel, onboarding, documentação, cobrança aprovada e contratos | Aprovações externas para produção |
| 6. Piloto e lançamento | 70–90 | 3–5 agências, testes reais autorizados e conversão paga | Todos os gates de campanhas reais |

Comercial e jurídico trabalham desde a etapa 1. Desenvolvimento local em sandbox pode avançar sem fabricar aprovações externas; isso não libera campanhas reais.

## Responsabilidades

| Frente | Dono | Entrega verificável |
|---|---|---|
| Produto | Fundador | Escopo, jornadas, backlog e decisões |
| Engenharia | Fundador + IA | Código, contratos, testes e revisão |
| Infraestrutura | Fundador + IA | Implantação reproduzível e restauração demonstrada |
| Segurança | Fundador + especialista | Isolamento, credenciais e revisão independente |
| Jurídico americano | Advogado contratado | Matriz de cobertura, retenção e contratos aprovados |
| Contabilidade brasileira | Contador contratado | Estrutura de faturamento e obrigações brasileiras |
| Comercial e atendimento | Fundador | Pilotos, onboarding, suporte e receita observada |

## Backlog e estado

O [CSV](backlog.csv) contém IDs, donos, dependências, esforço e critérios de aceite. As linhas começam como `planejado`: a presença de documentos ou código não comprova aprovação jurídica, implantação nem teste em provedor real. Atualizar o status somente com evidência referenciada.

Estados do quadro: `planejado`, `em andamento`, `bloqueado externamente`, `em verificação`, `concluído`. Uma tarefa concluída tem entrega identificável, verificação registrada e limitações documentadas. Não usar percentuais subjetivos de conclusão.

Não há, neste pacote, quadro GitHub remoto criado, contratação de especialistas, entrevistas realizadas ou clientes adquiridos. O CSV é o artefato de preparação; a criação do quadro depende da identificação do repositório remoto.

## Gates

**Campanhas reais:** cobertura e contratos revisados; acesso DNC comprovado quando aplicável; duas integrações verificadas; preservação e restauração testadas; nenhuma falha crítica conhecida; monitoramento e interrupção operacionais. Até lá, sandbox.

**Lançamento ampliado:** três agências ativadas; duas conversões com pagamento efetivo de US$ 79; duas ativações sem reunião obrigatória; duas semanas sem incidente crítico pendente; margem positiva observada; retenção pós-cancelamento financiada.

**Cobrança:** aprovação do modelo pelo processador antes de checkout real. A aceitação de um país ou conta não comprova aceitação do produto.

## Decisões e riscos

| Decisão / risco | Tratamento |
|---|---|
| Duas integrações desde o primeiro MVP | Vapi e Retell; HighLevel depois |
| Gate pode ser contornado fora do sistema | Documentar cobertura e remover rotas paralelas das campanhas integradas |
| Origem ou validade do consentimento insuficiente | Bloquear; evidência estruturada e revisão do caso de uso |
| Acesso DNC não automatizável como imaginado | Importação autorizada com validade/cobertura; não inventar API do SAN |
| Chamada com resultado desconhecido | Reconciliar; não repetir às cegas |
| Dependência jurídica e de cobrança | Gates externos com responsáveis; sem aprovação fictícia em configuração |
| Fundador indisponível | Manual de recuperação, controle de acessos e procedimento de continuidade |
| Retenção maior que a vida comercial do cliente | Reserva financeira, exportação e responsabilidade contratual |

Revisão semanal: entregas concluídas, próximos bloqueios, evidências, horas gastas e orçamento. Mudanças de escopo entram no registro de decisões antes de gerar trabalho.
