'use client'

import { type ReactNode } from 'react'

/**
 * Client-side providers wrapper.
 *
 * When @initia/interwovenkit-react is installed and configured,
 * wrap children with InterwovenKitProvider:
 *
 *   import { InterwovenKitProvider } from '@initia/interwovenkit-react'
 *
 *   export default function Providers({ children }: { children: ReactNode }) {
 *     return (
 *       <InterwovenKitProvider networkType="testnet">
 *         {children}
 *       </InterwovenKitProvider>
 *     )
 *   }
 */
export default function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>
}
