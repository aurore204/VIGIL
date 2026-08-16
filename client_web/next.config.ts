import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true, // l'optimisation d'images Next.js a besoin d'un serveur, incompatible avec l'export statique
  },
};

export default withNextIntl(nextConfig);