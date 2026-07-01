export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-5 py-12 text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Privacy Policy
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Dinder Privacy Policy</h1>
          <p className="text-base leading-7 text-muted-foreground">
            Dinder is a simple meal planning app for a household. This page explains what information
            is stored and how it is used.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">What data is collected</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            To make the app work, Dinder may store:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
            <li>Google account information used for sign-in, such as your name and email address</li>
            <li>Meal preferences and dietary choices, such as favorites, hidden meals, and restrictions</li>
            <li>Shopping list and basket data, such as ingredients and items you save or check off</li>
          </ul>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">How this data is used</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            This information is used only to provide Dinder’s meal planning features, such as
            building a shopping list, saving favorite meals, and keeping your household preferences
            available across sessions.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Sharing</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Dinder does not sell your data and does not share it with third parties for advertising
            or other unrelated purposes.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            If you have any questions about this privacy policy, please contact us at{' '}
            <a className="text-foreground underline underline-offset-4" href="mailto:hello@dinder.app">
              hello@dinder.app
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
