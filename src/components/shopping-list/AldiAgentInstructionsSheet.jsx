import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Copy, ClipboardPaste, PartyPopper, ShieldCheck } from 'lucide-react'

const STEPS = [
  { icon: Copy, text: 'Open Claude in Chrome in your browser sidebar' },
  { icon: ClipboardPaste, text: 'Paste and press Enter' },
  { icon: PartyPopper, text: "Come back when it's done" },
]

// CB_17: shown right after the agent prompt is copied to the clipboard.
// Purely instructional — no agent state to track here in v1.
export default function AldiAgentInstructionsSheet({ open, onOpenChange }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0">
        <SheetHeader className="border-b">
          <SheetTitle>Prompt copied</SheetTitle>
        </SheetHeader>

        <div className="px-4 py-5 space-y-4">
          {STEPS.map(({ icon: Icon, text }, idx) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 text-sm font-semibold text-primary">
                {idx + 1}
              </div>
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-sm flex-1">{text}</p>
            </div>
          ))}

          <div className="flex items-start gap-2 pt-2 text-xs text-muted-foreground leading-relaxed">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p>The agent will never submit your order or touch payment — you review and checkout yourself.</p>
          </div>
        </div>

        <SheetFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Got it
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
