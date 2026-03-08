import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "TEN BSA Local",
  manifest: "/manifest-local.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TEN Local",
  },
  icons: {
    apple: "/icons/icon-local-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function LocalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
