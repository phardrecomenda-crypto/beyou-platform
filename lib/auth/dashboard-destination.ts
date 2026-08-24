export function dashboardDestination(role:string|null|undefined){
  if(role==="admin"||role==="super_admin")return"/admin";
  if(role==="support")return"/admin/suporte";
  if(role==="finance")return"/admin/financeiro";
  if(role==="affiliate"||role==="manager"||role==="recruiter")return"/afiliados/painel";
  return"/minha-area";
}

export function safeInternalDestination(value:string){
  return value.startsWith("/")&&!value.startsWith("//")?value:null;
}
