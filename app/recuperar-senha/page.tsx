import Link from "next/link";
import { AuthForm } from "../auth/auth-form";
import { requestPasswordResetAction } from "../auth/actions";

export default function RecuperarSenhaPage() {
  return <AuthForm title="Recupere sua senha" subtitle="Enviaremos um link seguro para o seu e-mail." submitLabel="Enviar link" action={requestPasswordResetAction} fields={[{name:"email",label:"E-mail",type:"email",autoComplete:"email"}]} footer={<p><Link href="/login">Voltar para o login</Link></p>} />;
}
