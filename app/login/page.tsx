import Link from "next/link";
import { AuthForm } from "../auth/auth-form";
import { loginAction } from "../auth/actions";

export default function LoginPage() {
  return <AuthForm title="Entre na sua conta" subtitle="Acesse sua jornada, pedidos e benefícios." submitLabel="Entrar" action={loginAction} fields={[{ name:"email", label:"E-mail", type:"email", autoComplete:"email" },{ name:"password", label:"Senha", type:"password", autoComplete:"current-password" }]} footer={<><Link href="/recuperar-senha">Esqueci minha senha</Link><p>Ainda não tem conta? <Link href="/cadastro">Criar conta</Link></p></>} />;
}
