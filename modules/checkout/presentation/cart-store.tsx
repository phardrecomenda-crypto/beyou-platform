export function CartStore({ children, initialCart, products }: Readonly<{ children: ReactNode; initialCart: Cart | null; products: readonly Product[] }>) {
  const [cart, setCart] = useState(initialCart);
  const [opened, setOpened] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const closeButton = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Reads window.location on mount only; must stay an effect since the URL
    // is a browser-only API and this keeps SSR/hydration output stable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (new URLSearchParams(window.location.search).get("cart") === "open") setOpened(true);
  }, []);

  useEffect(() => {
    // Resyncs local cart state when the server-provided cart changes (e.g.
    // after a Server Action revalidates the page). A single setState call
    // tied to a real prop change, not a cascading chain.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart(initialCart);
  }, [initialCart]);

  // ...restante do arquivo permanece igual ao que já está no main
