import Link from"next/link";

export function BrandLogo({className="",tone="dark",subtitle}:{className?:string;tone?:"dark"|"light";subtitle?:string}){
 return <Link className={`beyou-official-logo ${tone} ${className}`} href="/" aria-label="BeYou Nutrition — início"><svg viewBox="0 0 54 32" aria-hidden="true"><path d="M3 23C9 7 25 7 34 24C20 29 9 29 3 23Z"/><path d="M34 20C30 10 35 2 46 2C50 12 45 19 34 20Z"/></svg><span>BeYou</span>{subtitle&&<small>{subtitle}</small>}</Link>
}
