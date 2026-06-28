import type { Metadata } from "next";
import "./globals.css";
import Header from "./components/Header";

export const metadata: Metadata = {
  title: "WhenToCut — Steam discount advisor",
  description:
    "Data-driven discount timing & sizing for indie Steam developers. Know when to cut, and by how much.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
