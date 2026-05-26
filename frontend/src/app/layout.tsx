import './globals.css';

import type { Metadata } from 'next';

import { AuthProvider } from '@/components/auth-provider';

export const metadata: Metadata = {
  title: 'Inventario - Gestión de usuarios',
  description: 'Módulo de autenticación y administración de usuarios',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
