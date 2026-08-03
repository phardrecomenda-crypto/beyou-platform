# BEYOU Platform — Business Rules

Versão: 1.0  
Status: Oficial  
Autoridade: Fundadores + CTO  

Este documento contém regras obrigatórias de negócio. Em caso de conflito com o código, estas regras prevalecem. Alterações exigem decisão registrada e migration compatível quando afetarem dados persistidos.

## 1. Ciclo de Vida do Cliente

O Ciclo de Vida do Cliente é uma regra transversal utilizada por Orders, Affiliate Engine, Wallet, Customer Area, CRM, Customer Success, Remarketing e AI.

Fluxo principal:

```text
Lead
↓
Cadastro
↓
Compra
↓
Pagamento aprovado
↓
Pedido criado
↓
Cliente recebe acesso
↓
Anamnese
↓
IA gera análise
↓
Plano alimentar semanal
↓
Lista de compras
↓
Início do protocolo
↓
Check-ins
↓
Acompanhamento
↓
Customer Success
↓
Resultados
↓
Renovação
↓
Nova jornada
```

## 2. Estados oficiais

```text
LEAD
NEW_CUSTOMER
ACTIVE
ENGAGED
AT_RISK
NEAR_RENEWAL
RENEWED
INACTIVE
REACTIVATED
```

| Estado | Significado |
|---|---|
| `LEAD` | Pessoa identificada que ainda não possui compra aprovada. |
| `NEW_CUSTOMER` | Primeira compra aprovada e acesso liberado. |
| `ACTIVE` | Cliente com ciclo vigente. |
| `ENGAGED` | Cliente ativo com adesão e interação recorrentes. |
| `AT_RISK` | Cliente com baixa adesão, ausência ou risco de churn. |
| `NEAR_RENEWAL` | Cliente dentro da janela oficial de renovação. |
| `RENEWED` | Cliente que concluiu a renovação do ciclo. |
| `INACTIVE` | Cliente sem ciclo vigente e sem renovação. |
| `REACTIVATED` | Cliente inativo que iniciou um novo ciclo. |

Toda transição deve registrar estado anterior, estado novo, motivo, origem, data e identificador de correlação. Estados nunca são alterados apenas pela interface.

## 3. Compra e ativação

O protocolo oficial é composto por BeFit, BeFiber e BeCalm.

Após a confirmação idempotente do pagamento, o sistema deve:

1. confirmar a transação;
2. criar o pedido uma única vez;
3. criar ou localizar o cliente pelo identificador oficial;
4. registrar a atribuição do afiliado quando existente;
5. gerar os lançamentos de comissão;
6. gerar os lançamentos de Wallet;
7. liberar a Área do Cliente;
8. criar o primeiro ciclo do cliente;
9. registrar a transição para `NEW_CUSTOMER`;
10. emitir os eventos internos correspondentes.

Pagamento, pedido, comissão e Wallet devem usar registros idempotentes. O reprocessamento do mesmo evento não pode duplicar efeitos financeiros ou operacionais.

## 4. Primeiro acesso

No primeiro acesso após a liberação, o cliente deve receber:

- boas-vindas;
- explicação do protocolo;
- vídeo inicial;
- termo de uso vigente;
- acesso à anamnese.

O aceite deve registrar versão do termo, data, usuário e contexto técnico necessário à auditoria.

## 5. Anamnese

A anamnese coleta:

- objetivo;
- peso;
- altura;
- idade;
- sexo;
- rotina;
- atividade física;
- restrições alimentares;
- preferências;
- histórico de saúde.

Após a conclusão válida, a plataforma solicita à IA:

- análise estruturada;
- plano alimentar semanal;
- lista de compras.

Respostas incompletas não podem gerar plano definitivo. Cada geração deve ser versionada e vinculada à anamnese que a originou.

A IA não realiza diagnóstico, prescrição médica ou substituição de acompanhamento profissional. Situações incompatíveis com o escopo do sistema devem ser encaminhadas para avaliação profissional.

## 6. Início do protocolo

O ciclo começa no Dia 1 e apresenta:

- orientações de uso do BeFit conforme rótulo aprovado;
- orientações de uso do BeFiber conforme rótulo aprovado;
- orientações de uso do BeCalm conforme rótulo aprovado;
- lembretes;
- hidratação;
- dicas aprovadas.

Posologia nunca é inferida pela IA. A plataforma utiliza exclusivamente o conteúdo regulatório aprovado e versionado para cada produto.

## 7. Check-ins e acompanhamento

Os check-ins podem ser diários ou semanais e registrar:

- peso;
- medidas;
- humor;
- energia;
- sono;
- fome;
- água;
- exercícios.

O histórico é imutável para fins de evolução. Correções devem preservar o valor anterior e a auditoria. A IA pode analisar tendências, mas não pode alterar respostas fornecidas pelo cliente.

## 8. Customer Success

Customer Success deve:

- identificar clientes que pararam de acessar;
- identificar baixa adesão;
- identificar baixa recompra;
- identificar risco de cancelamento;
- identificar risco de churn;
- medir satisfação e NPS;
- criar tarefas de reativação;
- registrar atendimento e SLA.

Os critérios que alteram o estado do ciclo devem ser configuráveis, versionados e auditáveis.

## 9. Remarketing

Remarketing integra Customer Success.

Quando a empresa realiza nova venda para cliente atribuído a um afiliado:

- o atendimento deve ser registrado;
- o SLA deve ser registrado;
- a atribuição original deve ser preservada conforme a regra vigente;
- o afiliado recebe 15%;
- a empresa recebe 5%;
- os lançamentos devem aparecer em extrato transparente;
- estornos devem gerar lançamentos compensatórios, nunca apagar o histórico.

Percentuais são calculados sobre a base elegível definida pelo motor de comissão. Arredondamentos financeiros são realizados em centavos.

## 10. Renovação

### D-10

- identificar que o protocolo está próximo do fim;
- alterar o estado para `NEAR_RENEWAL`;
- iniciar campanha de preparação.

### D-7

- solicitar avaliação da evolução do cliente.

### D-5

- apresentar resultados registrados;
- apresentar evolução e consistência;
- apresentar benefícios acompanhados sem criar alegações não registradas.

### D-3

- apresentar oferta personalizada elegível.

### D-1

- emitir lembrete de encerramento no dia seguinte.

### Dia 0

- disponibilizar a ação principal `Renovar agora`.

## 11. Renovação concluída

Após pagamento aprovado da renovação, o sistema deve:

1. criar um novo ciclo;
2. preservar ciclos anteriores;
3. preservar evolução e metas;
4. gerar nova comissão;
5. atualizar a Wallet por lançamentos;
6. reiniciar o acompanhamento operacional;
7. registrar `RENEWED`;
8. estabelecer o novo período vigente.

Renovação nunca sobrescreve o ciclo anterior.

## 12. Cliente sem renovação

O cliente que não renovar entra na régua de recuperação:

```text
D+7
↓
D+15
↓
D+30
↓
D+60
↓
D+90
```

Cada etapa pode utilizar:

- e-mail;
- WhatsApp;
- notificações;
- ofertas personalizadas;
- conteúdos educativos.

Toda comunicação deve respeitar consentimento, opt-out, frequência e canal permitido. O sistema registra envio, entrega, interação, falha e origem da campanha.

Após o encerramento do ciclo sem renovação, o estado passa para `INACTIVE`. Uma nova compra aprovada altera o estado para `REACTIVATED` e cria um novo ciclo.

## 13. Eventos internos obrigatórios

Os módulos devem reagir a eventos de domínio, não a dependências diretas entre interfaces.

- `customer.registered`
- `payment.approved`
- `order.created`
- `customer.access_granted`
- `assessment.completed`
- `nutrition_plan.generated`
- `protocol.started`
- `checkin.completed`
- `customer.risk_detected`
- `renewal.window_started`
- `renewal.completed`
- `customer.inactivated`
- `customer.reactivated`

Cada evento contém ID único, tipo, versão, entidade, data, origem, correlação e payload mínimo necessário. Consumidores devem ser idempotentes.

## 14. Privacidade e segurança

- Dados de saúde possuem acesso restrito e RLS obrigatória.
- Informações de anamnese não são expostas a afiliados.
- Afiliados acessam somente dados comerciais necessários e autorizados.
- Dados sensíveis não são enviados para logs de aplicação.
- Consentimentos e finalidades de tratamento devem ser registrados.
- Exclusão e retenção obedecem à política jurídica e de auditoria vigente.
- Operações financeiras preservam histórico por lançamentos compensatórios.

## 15. Implementação no Roadmap

Esta regra não altera a sequência oficial:

- Fase 06 — Orders: pedido, aprovação e ciclo inicial.
- Fase 07 — Affiliate Engine: atribuição e comissões.
- Fase 08 — Wallet: lançamentos e extratos.
- Fase 09 — Customer Area: primeiro acesso, protocolo e check-ins.
- Fase 10 — CRM: estado consolidado e histórico de relacionamento.
- Fase 11 — SAC: atendimentos e SLA.
- Fase 13 — AI: análise, plano alimentar e acompanhamento automatizado.

Cada fase implementará sua parte desta regra somente quando chegar sua posição oficial no Roadmap.
