import { redirect } from "next/navigation";
const aliases:Record<string,string>={"beyou-box":"kit-essencial-beyou",befit:"befit",befiber:"befiber",becalm:"becalm",bemax:"kit-essencial-beyou"};
export default async function LegacyProductPage({params,searchParams}:{params:Promise<{slug:string}>,searchParams:Promise<Record<string,string|undefined>>}){const{slug}=await params;const query=await searchParams;const target=aliases[slug]??slug;redirect(`/loja/${target}${query.openCart?"?cart=open":""}`)}
