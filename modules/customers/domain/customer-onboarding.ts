export type LegalDocument={id:string;version:string;title:string;body:string;publishedAt:string};
export type CustomerOnboarding={eligible:boolean;accepted:boolean;currentStep:"WELCOME"|"TERMS"|"ASSESSMENT"|"COMPLETED";document:LegalDocument|null};
