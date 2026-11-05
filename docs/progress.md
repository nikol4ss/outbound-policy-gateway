# Registro de implementação

Plano: desenvolvimento e lançamento de SaaS de controle de chamadas com IA, aprovado em 2026-11-05.

- Repositório inicial vazio, branch main sem commits, sem remote. Nenhum trabalho prévio a preservar.
- Execução local autorizada. Não criar contas pagas, realizar chamadas reais ou contatar terceiros nesta implementação.
- Decisão: SQLite persistente apenas para sandbox local, PostgreSQL obrigatório em live. Permite testar sem credenciais e não substitui a validação PostgreSQL/RLS.
- Decisão: dados fictícios e política de demonstração identificados como sandbox; produção bloqueada sem revisão jurídica, retenção e infraestrutura configuradas.
- Frentes: motor/provedores, painel e documentos delegados com propriedade separada; serviço/persistência/API/integração sob responsabilidade principal.
- Pendências externas: revisão jurídica, entrevistas e pilotos, aprovação MoR, contas Supabase/AWS/Render e repositório remoto.
