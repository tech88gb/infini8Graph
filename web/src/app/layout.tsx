import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "infini8Graph - Cross-Channel Intelligence & Ads Dashboard",
  description: "Transform your Instagram presence and Google Ads performance with precision analytics and automation built for growth.",
  verification: {
    google: "poXJa6H0pOXo4FmEb_ADeKHLk3aWYW_D0d-A48O3De4",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
