import Link from "next/link";
import { AuthForm } from "../auth/auth-form";
import { signUpAction } from "../auth/actions";

export default function CadastroPage() {
  return <AuthForm title="Crie sua conta" subtitle="Comece agora sua jornada com a BEYOU." submitLabel="Criar minha conta" action={signUpAction} terms fields={[{name:"name",label:"Nome completo",autoComplete:"name"},{name:"email",label:"E-mail",type:"email",autoComplete:"email"},{name:"password",label:"Senha",type:"password",autoComplete:"new-password"},{name:"confirmPassword",label:"Confirmar senha",type:"password",autoComplete:"new-password"}]} footer={<p>Já possui conta? <Link href="/login">Entrar</Link></p>} />;
}
