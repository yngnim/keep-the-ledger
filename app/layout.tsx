import type { Metadata, Viewport } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Keep the Ledger | 던전 원정 장부",
  description:
    "Keep the Heroes Out 연대기, 던전 세팅, 침입 토큰과 통합 룰북을 한곳에서 관리하는 플레이 컴패니언.",
  applicationName: "Keep the Ledger",
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: `${basePath}/assets/rooms/treasury.png`,
    apple: `${basePath}/assets/rooms/treasury.png`,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    title: "Keep the Ledger | 던전 원정 장부",
    description:
      "연대기 순서, 던전 세팅, 침입 토큰과 통합 룰북을 한곳에서.",
  },
  twitter: {
    card: "summary",
    title: "Keep the Ledger | 던전 원정 장부",
    description:
      "연대기 순서, 던전 세팅, 침입 토큰과 통합 룰북을 한곳에서.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c1714",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
