import { Link } from 'react-router-dom'
import { useGetPublicSettingsQuery } from '../store/api'
import { useAppSelector } from '../store'
import { Card, Icon } from '../components/ui'

/**
 * Public bulk-orders page.
 *
 * Deliberately outside the authenticated app: the audience is an office
 * manager pricing up a team lunch who does not have an account yet, and
 * making them sign up before they can read what we offer loses the enquiry.
 *
 * The WhatsApp QR points at a *channel* — a broadcast feed, not a chat. It is
 * framed as "follow", with a separate phone route for actually enquiring,
 * because telling someone to message a channel would send them nowhere.
 */

const WHATSAPP_CHANNEL = 'https://whatsapp.com/channel/0029Vb8RVR81iUxhMVsuxV1O'

const OCCASIONS = [
  {
    icon: 'groups',
    title: 'Team lunches',
    body: 'Sprint kickoffs, monthly all-hands, or a Friday the team actually looks forward to.',
  },
  {
    icon: 'handshake',
    title: 'Client meetings',
    body: 'Boxed meals that arrive plated-neat and on time, so lunch is not the thing anyone remembers.',
  },
  {
    icon: 'school',
    title: 'Training days',
    body: 'Back-to-back sessions fed without a queue. Boxes labelled and stacked by room.',
  },
  {
    icon: 'celebration',
    title: 'Milestones',
    body: 'Launches, farewells and festival lunches, with a menu built for the occasion.',
  },
]

const STEPS = [
  {
    title: 'Tell us the shape of it',
    body: 'Headcount, date, veg and non-veg split, and where in the park it lands. A rough number is enough to start.',
  },
  {
    title: 'We come back with a menu and a price',
    body: 'A per-box price with everything included. No delivery charge inside the tech parks we serve.',
  },
  {
    title: 'It arrives packed and labelled',
    body: 'One drop point or several floors. Our team hands over and takes the packaging away.',
  },
]

export default function BulkOrders() {
  const { data: settings } = useGetPublicSettingsQuery()
  const signedIn = Boolean(useAppSelector((state) => state.auth.accessToken))

  const phone = settings?.support_contact
  const phoneDigits = (phone ?? '').replace(/\D/g, '')
  const enquiryText = encodeURIComponent(
    "Hi Mealhub — I'd like a quote for a bulk order.\n\nHeadcount:\nDate:\nTech park / floor:\nVeg / non-veg split:",
  )
  const enquiryLink = phoneDigits
    ? `https://wa.me/${phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits}?text=${enquiryText}`
    : null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Header ── */}
      <header className="border-b border-outline-variant/40 bg-surface/95 backdrop-blur-md">
        <div className="page flex h-20 items-center justify-between gap-4">
          <Link to={signedIn ? '/menu' : '/login'} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container">
              <Icon name="lunch_dining" className="text-[22px] text-tertiary-fixed-dim" />
            </span>
            <span className="font-display text-headline-md tracking-tight text-primary">
              Mealhub
            </span>
          </Link>

          <Link
            to={signedIn ? '/menu' : '/login'}
            className="rounded-xl bg-tertiary-fixed-dim px-5 py-2.5 text-label-lg font-semibold text-on-tertiary-fixed transition-all hover:brightness-95 active:scale-[0.98]"
          >
            {signedIn ? 'Order today’s lunch' : 'Sign in'}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="page grid gap-10 py-14 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:py-20">
          <div>
            <p className="label-caps text-secondary">Bulk &amp; corporate orders</p>
            <h1 className="mt-3 font-display text-display-lg leading-[1.05] text-primary">
              Feeding a room,
              <br />
              not a desk.
            </h1>
            <p className="mt-5 max-w-xl text-body-lg text-on-surface-variant">
              We cater team lunches, client meetings and event days across the tech parks we already
              deliver to every morning — same kitchens, same standard, built to a headcount.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {enquiryLink ? (
                <a
                  href={enquiryLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 text-label-lg font-semibold text-[#0b3d1f] transition-all hover:brightness-95 active:scale-[0.98]"
                >
                  <Icon name="chat" className="text-[20px]" />
                  Get a quote on WhatsApp
                </a>
              ) : null}
              {phone ? (
                <a
                  href={`tel:${phone.replace(/\s/g, '')}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-6 py-3 text-label-lg font-semibold text-primary transition-colors hover:bg-surface-container"
                >
                  <Icon name="call" className="text-[20px]" />
                  {phone}
                </a>
              ) : null}
            </div>

            <p className="mt-4 text-label-md text-on-surface-variant">
              Tell us headcount, date and your floor — we'll come back with a menu and a per-box price.
            </p>
          </div>

          {/* ── The channel QR ── */}
          <Card className="mx-auto w-full max-w-sm overflow-hidden">
            <div className="bg-primary-container px-6 py-5 text-center">
              <p className="text-label-md font-semibold uppercase tracking-[0.18em] text-on-primary-container">
                WhatsApp channel
              </p>
              <p className="mt-1 font-display text-headline-md text-white">Mealhub Coimbatore</p>
            </div>

            <div className="flex flex-col items-center gap-4 px-6 py-7">
              <div className="rounded-xl border border-outline-variant bg-white p-3">
                <img
                  src="/whatsapp-channel-qr.svg"
                  alt="Scan to follow the Mealhub Coimbatore WhatsApp channel"
                  className="h-48 w-48"
                  width={192}
                  height={192}
                />
              </div>

              <p className="text-center text-body-md text-on-surface-variant">
                Scan with your camera to follow the channel — daily menus, bulk offers and festival
                specials, before they go out.
              </p>

              <a
                href={WHATSAPP_CHANNEL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant px-5 py-2.5 text-label-lg font-semibold text-primary transition-colors hover:bg-surface-container"
              >
                <Icon name="open_in_new" className="text-[18px]" />
                Open the channel
              </a>

              <p className="text-center text-label-md text-on-surface-variant">
                It's a broadcast channel — to place a bulk order, message or call us directly.
              </p>
            </div>
          </Card>
        </section>

        {/* ── Occasions ── */}
        <section className="border-y border-outline-variant/40 bg-surface-container-low py-14">
          <div className="page">
            <h2 className="font-display text-headline-lg text-primary">What we cater</h2>
            <div className="mt-8 grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
              {OCCASIONS.map((item) => (
                <Card key={item.title} className="card-interactive p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary-container">
                    <Icon name={item.icon} className="text-[22px] text-on-secondary-container" />
                  </span>
                  <h3 className="mt-4 font-display text-body-lg font-semibold text-primary">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-label-lg font-normal leading-relaxed tracking-normal text-on-surface-variant">
                    {item.body}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="page py-14">
          <h2 className="font-display text-headline-lg text-primary">How it works</h2>
          <ol className="mt-8 grid gap-gutter lg:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="border-t-2 border-primary-container pt-5">
                {/* Numbered because it genuinely is a sequence, not decoration. */}
                <span className="font-display text-headline-lg leading-none text-tertiary-fixed-dim">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 font-display text-body-lg font-semibold text-primary">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-label-lg font-normal leading-relaxed tracking-normal text-on-surface-variant">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Practicalities ── */}
        <section className="page pb-16">
          <Card className="grid gap-6 p-6 sm:grid-cols-3">
            {[
              {
                icon: 'schedule',
                title: 'Notice',
                body: 'A day ahead for most sizes. Larger counts and custom menus need a little longer — ask and we will tell you straight.',
              },
              {
                icon: 'restaurant',
                title: 'Dietary mix',
                body: 'Veg, non-veg and egg in whatever split you need, labelled per box. Jain and no-onion-no-garlic on request.',
              },
              {
                icon: 'receipt_long',
                title: 'Payment',
                body: 'UPI on confirmation, or a GST invoice raised to the company for finance to settle.',
              },
            ].map((item) => (
              <div key={item.title}>
                <div className="flex items-center gap-2">
                  <Icon name={item.icon} className="text-[20px] text-secondary" />
                  <h3 className="font-display text-body-lg font-semibold text-primary">
                    {item.title}
                  </h3>
                </div>
                <p className="mt-2 text-label-lg font-normal leading-relaxed tracking-normal text-on-surface-variant">
                  {item.body}
                </p>
              </div>
            ))}
          </Card>
        </section>

        {/* ── Closing CTA ── */}
        <section className="page pb-20">
          <div className="flex flex-col items-center gap-5 rounded-2xl bg-primary-container px-6 py-12 text-center">
            <h2 className="max-w-xl font-display text-headline-lg text-white">
              Tell us the headcount. We'll do the rest.
            </h2>
            <p className="max-w-lg text-body-md text-primary-fixed">
              Most quotes come back the same day.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {enquiryLink ? (
                <a
                  href={enquiryLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-tertiary-fixed-dim px-6 py-3 text-label-lg font-semibold text-on-tertiary-fixed transition-all hover:brightness-95 active:scale-[0.98]"
                >
                  <Icon name="chat" className="text-[20px]" />
                  Start a bulk enquiry
                </a>
              ) : null}
              <Link
                to={signedIn ? '/menu' : '/login'}
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-label-lg font-semibold text-white transition-colors hover:bg-white/10"
              >
                See today's menu
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-variant/40 bg-surface-container">
        <div className="page flex flex-col gap-3 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Icon name="lunch_dining" className="text-[20px] text-primary" />
            <span className="font-display text-body-lg font-semibold text-primary">
              Mealhub
            </span>
          </div>
          <p className="text-label-md text-on-surface-variant">
            {settings?.support_note ?? 'Corporate catering across your tech park.'}
          </p>
        </div>
      </footer>
    </div>
  )
}
