# Orçamento e economia unitária

Valores em dólares; estimativas de planejamento, não cotações. Não incluem remuneração do fundador. Fixar o teto somente após cotações e viabilidade das dependências externas.

## Reserva inicial

| Item | Reserva / tratamento | Estado |
|---|---|---|
| Web, worker, banco, evidências, backups, e-mail e monitoramento | US$ 150–350/mês no piloto | Estimar com configuração real |
| Seis meses desses serviços | US$ 900–2.100 | Reserva, não contratação |
| Revisão jurídica americana inicial | Cotação com escopo e entregáveis fechados | Não contratada |
| Atualizações jurídicas posteriores | Cotação separada por revisão/recorrência | Não contratadas |
| Contabilidade e formalização brasileira | Cotar conforme estrutura empresarial | Não contratadas |
| Revisão de segurança | Cotar antes do piloto real | Não contratada |
| Domínio e contas de teste | Registrar custo efetivo | Não adquiridos |
| Telefonia e DNC de produção | Responsabilidade dos clientes, conforme contrato | Confirmar por cliente |
| Contingência | 20% do orçamento consolidado | Calcular após cotações |

Armazenamento, operações de objetos, logs, backup e retenção de contas canceladas entram no custo. Um produto sem áudio pode ter custo baixo por registro, mas isso precisa ser medido.

## Modelo financeiro

Definir:

- `P`: preço mensal efetivamente recebido por conta.
- `t`: percentual efetivo de taxas de cobrança.
- `f`: tarifa fixa por transação.
- `v`: infraestrutura variável e APIs por conta.
- `s`: custo de suporte por conta, incluindo horas do fundador valorizadas.
- `r`: reserva de retenção pós-cancelamento por conta.
- `F`: custos fixos mensais, incluindo serviços profissionais recorrentes.

`Margem de contribuição por conta = P × (1 − t) − f − v − s − r`

`Ponto de equilíbrio = teto(F ÷ margem de contribuição)`, somente quando a margem for positiva.

`Caixa até o lançamento = meses × infraestrutura mensal + custos pontuais + testes + contingência`

Calcular impostos brasileiros e câmbio com o contador; não presumir que Merchant of Record resolve as obrigações da empresa brasileira. Não somar remuneração do fundador duas vezes se ela já estiver incluída em `s` ou `F`.

## Cenários de receita, sem previsão de probabilidade

| Contas pagantes | Preço | MRR bruto | ARR em run-rate |
|---:|---:|---:|---:|
| 5 | US$ 79 | US$ 395 | US$ 4.740 |
| 25 | US$ 79 | US$ 1.975 | US$ 23.700 |
| 50 | US$ 79 | US$ 3.950 | US$ 47.400 |
| 200 | US$ 79 | US$ 15.800 | US$ 189.600 |

Não confundir ARR em run-rate com receita já realizada. Descontos, churn, inadimplência, impostos e custos reduzem o resultado.

## Cobrança e cotações

Lemon Squeezy é uma hipótese condicionada à aprovação do produto. A política restringe determinados serviços relacionados a telemarketing; obter decisão do provedor sobre o SaaS descrito antes de depender do checkout. Não presumir aprovação por ter uma conta ou por o país ser atendido. [Política oficial](https://docs.lemonsqueezy.com/help/getting-started/prohibited-products).

Registro de cotação: fornecedor, escopo, data, moeda, implantação, mensalidade, variável de consumo, limites, impostos, cancelamento, contato responsável e validade. Comparar alternativas somente após conhecer o custo e a elegibilidade do serviço necessário.

No piloto, alertar antes da franquia e interromper novos despachos quando esgotada; manter opt-outs e eventos essenciais. Não criar cobrança surpresa de excedentes.
