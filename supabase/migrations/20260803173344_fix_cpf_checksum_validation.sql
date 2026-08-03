create or replace function public.is_valid_cpf(value text)
returns boolean language sql immutable strict set search_path = ''
as $$
  with digits as (
    select regexp_replace(value, '[^0-9]', '', 'g') as cpf
  ),
  first_digit as (
    select cpf,
      (((select sum(substr(cpf, position, 1)::integer * (11 - position))
         from generate_series(1, 9) as position) * 10 % 11) % 10) as d1
    from digits
  ),
  second_digit as (
    select cpf, d1,
      (((select sum(substr(cpf, position, 1)::integer * (12 - position))
         from generate_series(1, 10) as position) * 10 % 11) % 10) as d2
    from first_digit
  )
  select length(cpf) = 11
    and cpf !~ '^([0-9])\1{10}$'
    and substr(cpf, 10, 1)::integer = d1
    and substr(cpf, 11, 1)::integer = d2
  from second_digit
$$;
