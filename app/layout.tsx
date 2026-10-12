import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Lao } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoLao = Noto_Sans_Lao({
  variable: "--font-lao",
  subsets: ["lao"],
});

export const metadata: Metadata = {
  title: { default: "HAL ແຈ້ງບິນ WhatsApp", template: "%s · HAL ແຈ້ງບິນ" },
  description: "Demo: ສາຂາ HAL Express ແຈ້ງລູກຄ້າເມື່ອພັດສະດຸຮອດ ຜ່ານ OpenWA",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="lo"
      className={`${geistSans.variable} ${geistMono.variable} ${notoLao.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
