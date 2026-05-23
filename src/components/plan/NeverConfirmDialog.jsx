import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const REASONS = [
  "I don't like these ingredients",
  'Too complex to make',
  'Too expensive to make',
  'Not our style of food',
  'Dietary concern not listed',
]

export default function NeverConfirmDialog({ meal, open, onConfirm, onCancel }) {
  const [selectedReason, setSelectedReason] = useState(null)

  function handleConfirm() {
    onConfirm(meal, selectedReason)
    setSelectedReason(null)
  }

  function handleCancel() {
    setSelectedReason(null)
    onCancel()
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && handleCancel()}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Never show this meal?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong className="text-foreground">{meal?.name}</strong> will be permanently hidden
            from your swipe deck. You can restore it from the Hidden screen.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Optional reason chips */}
        <div className="py-1">
          <p className="text-sm text-muted-foreground mb-2">Reason (optional)</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((reason) => (
              <button
                key={reason}
                onClick={() => setSelectedReason((r) => (r === reason ? null : reason))}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  selectedReason === reason
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background text-foreground hover:bg-secondary'
                )}
              >
                {reason}
              </button>
            ))}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={handleConfirm}>
            Hide this meal
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
