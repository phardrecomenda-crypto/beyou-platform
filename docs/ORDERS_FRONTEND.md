# Orders — frontend do cliente

## Rotas

- `/pedidos`: lista exclusivamente os pedidos do usuário autenticado.
- `/pedidos/[id]`: exibe produtos, valores, pagamento, endereço e andamento.
- `/pedido/confirmado?pedido=<uuid>`: confirma visualmente uma compra já registrada.
- `/api/orders/status?paymentId=<asaas-id>`: consulta autenticada usada durante a confirmação assíncrona.

## Autoridade do estado

O navegador nunca cria pedidos nem declara um pagamento aprovado. Após Pix ou cartão, o checkout consulta o estado do pagamento. A navegação para a confirmação acontece somente quando o webhook já gerou um pedido idempotente no banco.

Todas as consultas das telas usam a sessão Supabase e as políticas RLS. A rota de acompanhamento usa o cliente administrativo apenas após autenticar a sessão e restringe tanto a tentativa quanto o pedido ao mesmo `user_id`.
