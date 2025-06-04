import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionProvider from "../context/SessionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Control de Tiempos",
  description: "Develop by AdoDeveloper",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-white text-black">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
