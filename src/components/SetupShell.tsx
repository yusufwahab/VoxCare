import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Dots, Page } from './ui'

/** Shared layout for every setup screen: progress dots, big picture, short title, one primary action */
export function SetupShell({ step, total = 4, back, title, children, footer }: { step: number; total?: number; back?: string; title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <Page className="flex min-h-dvh flex-col bg-ivory">
      <header className="flex items-center justify-between px-4 pb-2 pt-4 sm:px-8">
        {back ? (
          <Link to={back} aria-label="Back" className="grid h-12 w-12 place-items-center rounded-full bg-sand"><ArrowLeft aria-hidden /></Link>
        ) : <span className="h-12 w-12" />}
        <Dots step={step} total={total} />
        <span className="h-12 w-12" />
      </header>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-6 px-5 pb-6 pt-4">
        <h1 className="h2 text-center">{title}</h1>
        {children}
      </div>
      <footer className="safe-b sticky bottom-0 bg-gradient-to-t from-ivory via-ivory to-transparent px-5 pt-6">
        <div className="mx-auto flex max-w-md flex-col items-stretch gap-3">{footer}</div>
      </footer>
    </Page>
  )
}
