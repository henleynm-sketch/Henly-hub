# Email Notification System — Evidence Digest

Commits: 2b71e6b (rail) · 673a51e (catalog+resolution) · 26b70fd (templates+UI).
tsc clean (tsc-output.txt). Gate evidence: Test-ServicePrincipalAuthorization
screenshot from Nick shows Application Mail.Send InScope=True on
HenleyHubMailScope (hello@ only).

## What is code-verified here
- Layered resolution order enforced in one place (events.ts): visibility
  recheck at SEND time → user pref/org default → client/vendor optOut →
  unsubscribe (HMAC, confirm-page, scanner-safe) → master switch; every
  suppression writes a reason to the delivery row.
- Dedupe: unique dedupeKey eventType:subject:email:day — second emit same day
  cannot create a second delivery row (DB constraint, not app logic).
- Retry: attempts capped at 5, 2^n-minute backoff, instrumentation interval
  hot-reload-guarded; Flush button forces a sweep.
- Emit points wired: client-visible daily log, estimate SENT/ACCEPTED,
  contract SENT/SIGNED, job stage change (opt-in), inbound inbox message,
  daily sweeps (milestone T-2, COI expiring/expired, W-9 monthly w/ org
  toggle, CEO time-approval digest).
- Dormant by honesty (no fabricated sends): SELECTION_* reminders (Selections
  module has no dueDate yet), JOB_ASSIGNED / VENDOR_ASSIGNED (no assignment
  actions exist in the app yet). Catalog + prefs ready; they fire the day the
  actions exist.

## What only Nick can verify (received-mail checks)
1. `npx prisma db push; npx prisma generate`, restart dev.
2. Settings → Notifications → Send test email → arrives in Outlook FROM
   hello@henleycontracting.com; delivery log row flips queued→sent.
3. Post a client-visible daily log on a job whose client has a real email →
   client receives the branded update; flip the log to internal BEFORE the
   send (kill switch on, flush after flip) → delivery shows suppressed
   "log no longer client-visible".
4. Vendor COI case: set a vendor COI date within 30 days → next sweep emails
   them; click unsubscribe in that email → confirm page → future deliveries
   suppressed "recipient unsubscribed".
5. Kill switch ON → all new attempts suppress with "master switch off";
   re-enable + Flush resumes.
6. Outlook rendering check on the branded template (serif header, accent bar).
