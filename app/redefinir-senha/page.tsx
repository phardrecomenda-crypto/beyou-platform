import { AuthForm } from "../auth/auth-form";
import { updatePasswordAction } from "../auth/actions";

export default function RedefinirSenhaPage() {
  return <AuthForm title="Defina uma nova senha" subtitle="Use pelo menos 8 caracteres." submitLabel="Atualizar senha" action={updatePasswordAction} fields={[{name:"password",label:"Nova senha",type:"password",autoComplete:"new-password"},{name:"confirmPassword",label:"Confirmar nova senha",type:"password",autoComplete:"new-password"}]} footer={<p>O link de recuperação é válido por tempo limitado.</p>} />;
}
