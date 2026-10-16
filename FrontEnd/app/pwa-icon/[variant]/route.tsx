import { ImageResponse } from "next/og";

const VARIANTS = {
  "192": { size: 192, padding: 0 },
  "512": { size: 512, padding: 0 },
  // Maskable: el contenido tiene que entrar en el "safe zone" (80% central).
  maskable: { size: 512, padding: 0.12 },
} as const;

type Variant = keyof typeof VARIANTS;

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[variant]">) {
  const { variant } = await ctx.params;
  const cfg = VARIANTS[variant as Variant];
  if (!cfg) return new Response("Not found", { status: 404 });

  const { size, padding } = cfg;
  const ball = Math.round(size * (1 - padding * 2) * 0.62);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#15803d",
          borderRadius: padding ? 0 : size * 0.22,
        }}
      >
        <div style={{ fontSize: ball, lineHeight: 1, display: "flex" }}>⚽</div>
      </div>
    ),
    { width: size, height: size, emoji: "twemoji" },
  );
}
