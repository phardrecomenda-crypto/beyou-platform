# Fase 05 — Checkout: Frontend

## Status

Carrinho e página interna do checkout implementados, testados e versionados.

## Carrinho

- drawer responsivo;
- contador e subtotal;
- barra progressiva até R$ 600,00;
- order bump com produtos ainda ausentes;
- uma unidade por produto;
- remoção de itens;
- retorno após autenticação;
- CTA interno para `/checkout`.

## Página do checkout

A rota protegida `/checkout` usa o frontend anterior da BEYOU como referência visual e mantém a arquitetura atual.

Etapas apresentadas:

1. identificação preenchida pelo perfil;
2. seleção ou cadastro de endereço;
3. condição de entrega e meta de frete;
4. Pix ou cartão;
5. resumo persistente do pedido.

## Regras comerciais

- Pix exibe 3% de desconto;
- subtotal até R$ 499,99: até 3x sem juros;
- subtotal entre R$ 500,00 e R$ 999,99: até 6x sem juros;
- subtotal a partir de R$ 1.000,00: até 10x sem juros;
- frete grátis a partir de R$ 600,00;
- assinaturas não aparecem nesta fase.

## Segurança e arquitetura

- a página usa serviços de domínio e não consulta tabelas diretamente;
- o formulário envia somente endereço, meio de pagamento e parcelas;
- preços, desconto, frete e total permanecem sob autoridade do PostgreSQL;
- visitante é redirecionado para login com retorno ao checkout;
- carrinho vazio retorna para a loja;
- pagamento não é simulado nem marcado como aprovado antes da integração oficial.

## Responsividade e acessibilidade

- resumo fixo no desktop e reposicionado no celular;
- formulário em duas colunas com redução para uma coluna;
- mensagens com `role=alert` e `role=status`;
- controles com labels;
- estados de carregamento e bloqueio;
- navegação de retorno identificada.

## Validação

- TypeScript strict: aprovado;
- build completo: aprovado;
- artefato de hospedagem: aprovado;
- 26 testes automatizados: aprovados;
- 0 falhas.

## Próxima etapa

Integração do checkout: cálculo de frete abaixo da meta, gateway de pagamento em sandbox, tokenização segura do cartão, Pix, webhooks e confirmação. Nenhum dado sensível de cartão será persistido pela BEYOU.
