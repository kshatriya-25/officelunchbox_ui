import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react'

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden="true">
      {name}
    </span>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  // Turmeric on forest green — the design's maximum-contrast CTA.
  primary:
    'bg-tertiary-fixed-dim text-on-tertiary-fixed hover:brightness-95 disabled:bg-surface-container-high disabled:text-outline',
  secondary:
    'border border-outline-variant text-primary bg-surface-container-lowest hover:bg-surface-container disabled:text-outline',
  ghost: 'text-on-surface-variant hover:bg-surface-container hover:text-primary',
  danger: 'bg-error text-on-error hover:brightness-110',
  dark: 'bg-primary-container text-on-primary hover:brightness-125 disabled:bg-surface-container-high disabled:text-outline',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: string
  loading?: boolean
}

export function Button({
  variant = 'primary',
  icon,
  loading,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-label-lg font-semibold
        transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100
        ${BUTTON_STYLES[variant]} ${className}`}
    >
      {loading ? <Icon name="progress_activity" className="animate-spin text-[18px]" /> : icon ? <Icon name={icon} className="text-[18px]" /> : null}
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      {/* Permanent labels, never floating — the design calls for clarity in
          data-heavy forms over the cleverness of a floating label. */}
      <span className="text-label-lg font-semibold text-on-surface-variant">{label}</span>
      {children}
      {error ? (
        <span className="text-label-md text-error">{error}</span>
      ) : hint ? (
        <span className="text-label-md text-on-surface-variant">{hint}</span>
      ) : null}
    </label>
  )
}

const CONTROL_CLASS =
  'w-full rounded border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-body-md ' +
  'text-on-surface placeholder:text-outline focus:border-secondary focus:outline-none'

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${CONTROL_CLASS} ${className}`} />
}

interface SelectOption {
  value: string
  label: string
  disabled: boolean
}

/** Read `<option>` children so call sites keep the familiar markup. */
function readOptions(children: ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return []
    const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean }
    return [{
      value: String(props.value ?? ''),
      label: Children.toArray(props.children).join(''),
      disabled: Boolean(props.disabled),
    }]
  })
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  /** Kept event-shaped so existing `(e) => setX(e.target.value)` handlers work unchanged. */
  onChange?: (event: { target: { value: string } }) => void
}

/**
 * Accessible listbox replacing the native `<select>`.
 *
 * Native selects can't be styled — they render as OS chrome that ignores the
 * design system entirely. This keeps the same `<option>` child API so call
 * sites are unchanged.
 *
 * The menu renders in a portal with fixed positioning: several of these live
 * inside tables with `overflow-x: auto`, which would otherwise clip the popup.
 */
export function Select({
  className = '',
  children,
  value,
  onChange,
  disabled,
  required,
  name,
  ...rest
}: SelectProps) {
  const options = useMemo(() => readOptions(children), [children])
  const current = String(value ?? '')
  const selected = options.find((option) => option.value === current)

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [rect, setRect] = useState<{ top: number; left: number; width: number; flip: boolean } | null>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typeahead = useRef({ term: '', at: 0 })
  const listboxId = useId()

  const selectable = (index: number) => options[index] && !options[index].disabled

  const position = useCallback(() => {
    const node = triggerRef.current
    if (!node) return
    const box = node.getBoundingClientRect()
    const below = window.innerHeight - box.bottom
    setRect({
      top: below < 260 && box.top > below ? box.top : box.bottom + 4,
      left: box.left,
      width: box.width,
      flip: below < 260 && box.top > below,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    position()
    const handler = () => position()
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [open, position])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  function openMenu(startAt = options.findIndex((o) => o.value === current)) {
    if (disabled) return
    setActiveIndex(startAt >= 0 ? startAt : options.findIndex((_, i) => selectable(i)))
    setOpen(true)
  }

  function commit(index: number) {
    const option = options[index]
    if (!option || option.disabled) return
    onChange?.({ target: { value: option.value } })
    setOpen(false)
    triggerRef.current?.focus()
  }

  function step(from: number, direction: 1 | -1) {
    let next = from
    for (let i = 0; i < options.length; i += 1) {
      next = (next + direction + options.length) % options.length
      if (selectable(next)) return next
    }
    return from
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        openMenu()
      }
      return
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
        break
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((i) => step(i, 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((i) => step(i, -1))
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(step(-1, 1))
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(step(0, -1))
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        commit(activeIndex)
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        // Type-ahead: jump to the first option starting with what was typed.
        if (event.key.length === 1) {
          const now = Date.now()
          typeahead.current.term =
            now - typeahead.current.at > 800 ? event.key : typeahead.current.term + event.key
          typeahead.current.at = now
          const term = typeahead.current.term.toLowerCase()
          const found = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(term))
          if (found >= 0) setActiveIndex(found)
        }
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded border bg-surface-container-lowest px-3 py-2.5 text-left text-body-md transition-colors
          ${open ? 'border-secondary' : 'border-outline-variant hover:border-outline'}
          ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <span className={`truncate ${selected && selected.value !== '' ? 'text-on-surface' : 'text-outline'}`}>
          {selected?.label ?? options[0]?.label ?? 'Select…'}
        </span>
        <Icon
          name="expand_more"
          className={`shrink-0 text-[20px] text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Keeps native form validation working — a button can't be `required`.
          Sized rather than display:none, because hidden controls are exempt
          from validation and the browser cannot focus them to report an error. */}
      {required ? (
        <input
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          required
          value={current}
          onChange={() => {}}
          onFocus={() => triggerRef.current?.focus()}
          className="pointer-events-none absolute bottom-1 left-3 h-0 w-0 border-0 p-0 opacity-0"
        />
      ) : null}

      {open && rect
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
              <ul
                ref={listRef}
                id={listboxId}
                role="listbox"
                tabIndex={-1}
                style={{
                  position: 'fixed',
                  top: rect.flip ? undefined : rect.top,
                  bottom: rect.flip ? window.innerHeight - rect.top + 4 : undefined,
                  left: rect.left,
                  width: rect.width,
                }}
                className="z-[100] max-h-64 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-[0_8px_28px_rgba(18,37,28,0.16)]"
              >
                {options.map((option, index) => {
                  const isSelected = option.value === current
                  return (
                    <li
                      key={`${option.value}-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled || undefined}
                      data-active={index === activeIndex}
                      onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                      onClick={() => commit(index)}
                      className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-body-md
                        ${option.disabled ? 'cursor-not-allowed text-outline' : ''}
                        ${index === activeIndex && !option.disabled ? 'bg-surface-container-high' : ''}
                        ${isSelected ? 'font-semibold text-primary' : 'text-on-surface'}`}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected ? (
                        <Icon name="check" className="shrink-0 text-[18px] text-secondary" />
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </>,
            document.body,
          )
        : null}
    </div>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`card ${className}`}>{children}</div>
}

type ToneName = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const TONES: Record<ToneName, string> = {
  neutral: 'bg-surface-container-high text-on-surface-variant',
  success: 'bg-secondary-container text-on-secondary-fixed',
  warning: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  danger: 'bg-error-container text-on-error-container',
  info: 'bg-primary-fixed text-on-primary-fixed',
}

export function Badge({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: ToneName
  icon?: string
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-label-md font-semibold ${TONES[tone]}`}
    >
      {icon ? <Icon name={icon} className="text-[14px]" /> : null}
      {children}
    </span>
  )
}

export const STATUS_TONE: Record<string, ToneName> = {
  CONFIRMED: 'info',
  PREPARING: 'warning',
  PACKED: 'warning',
  DISPATCHED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  PAID: 'success',
  PENDING: 'warning',
  REFUNDED: 'neutral',
  FAILED: 'danger',
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: ToneName
  title?: string
  children: ReactNode
}) {
  const ICONS: Record<ToneName, string> = {
    neutral: 'info',
    info: 'info',
    success: 'check_circle',
    warning: 'schedule',
    danger: 'error',
  }
  return (
    <div className={`flex gap-3 rounded-xl px-4 py-3 ${TONES[tone]}`} role="status">
      <Icon name={ICONS[tone]} className="text-[20px] shrink-0" />
      <div className="text-body-md">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className="text-label-lg font-normal tracking-normal">{children}</div>
      </div>
    </div>
  )
}

/**
 * Placeholder that holds a region's shape while its data loads.
 *
 * Swapping a whole page for a spinner tears the layout down and rebuilds it on
 * every navigation, which reads as a flash. Skeletons keep the shell still.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-container-high ${className}`} />
}

export function SkeletonRows({ rows = 5, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}

/** Consistent page masthead across the console, so the eye lands in one place. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-outline-variant/50 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="label-caps">{eyebrow}</p> : null}
        <h1 className="mt-1 font-display text-headline-lg leading-none text-primary">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-body-md text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/**
 * A whole console page while its data loads.
 *
 * Renders the same masthead the loaded page will, so the header never moves —
 * only the content region resolves underneath it.
 */
export function PageSkeleton({
  eyebrow,
  title,
  description,
  rows = 6,
}: {
  eyebrow?: string
  title: string
  description?: string
  rows?: number
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <Card>
        <SkeletonRows rows={rows} className="p-5" />
      </Card>
    </>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-on-surface-variant" role="status">
      <Icon name="progress_activity" className="animate-spin text-[24px]" />
      <span className="text-body-md">{label}…</span>
    </div>
  )
}

export function EmptyState({
  icon = 'inbox',
  title,
  children,
  action,
}: {
  icon?: string
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="rounded-full bg-surface-container p-4">
        <Icon name={icon} className="text-[28px] text-on-surface-variant" />
      </div>
      <h3 className="text-headline-md">{title}</h3>
      {children ? <p className="max-w-md text-body-md text-on-surface-variant">{children}</p> : null}
      {action}
    </div>
  )
}

/**
 * Click-or-drop image field with a live preview.
 *
 * Menu photos sell the dish, so choosing one should be a visible part of the
 * form rather than an icon hidden in a row of actions.
 */
export function ImagePicker({
  previewUrl,
  onSelect,
  onClear,
  busy,
  disabled,
  emptyIcon = 'add_photo_alternate',
  emptyLabel = 'Add a photo',
  hint = 'JPG, PNG or WebP · up to 5 MB',
  className = '',
}: {
  previewUrl: string | null
  onSelect: (file: File) => void
  onClear?: () => void
  busy?: boolean
  disabled?: boolean
  emptyIcon?: string
  emptyLabel?: string
  hint?: string
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function take(files: FileList | null) {
    const file = files?.[0]
    if (file) onSelect(file)
  }

  return (
    <div className={className}>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!disabled) take(e.dataTransfer.files)
        }}
        className={`relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors ${
          dragging
            ? 'border-secondary bg-secondary-container/30'
            : 'border-outline-variant bg-surface-container-low'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="Selected photo preview" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-black/60 to-transparent p-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || busy}
                className="rounded bg-white/95 px-2.5 py-1 text-label-md font-semibold text-primary hover:bg-white"
              >
                Replace
              </button>
              {onClear ? (
                <button
                  type="button"
                  onClick={onClear}
                  disabled={disabled || busy}
                  className="rounded bg-white/95 px-2.5 py-1 text-label-md font-semibold text-error hover:bg-white"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || busy}
            className="flex flex-col items-center gap-1.5 px-4 py-6 text-center"
          >
            <Icon name={emptyIcon} className="text-[28px] text-outline" />
            <span className="text-body-md font-medium text-primary">{emptyLabel}</span>
            <span className="text-label-md text-on-surface-variant">Click or drag an image here</span>
          </button>
        )}

        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/70">
            <Icon name="progress_activity" className="animate-spin text-[26px] text-primary" />
          </div>
        ) : null}
      </div>

      {hint ? <p className="mt-1.5 text-label-md text-on-surface-variant">{hint}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          take(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

/** Veg / non-veg indicator — the square-dot convention Indian menus use. */
export function FoodDot({ type }: { type: string | null }) {
  const isVeg = type === 'VEG'
  const colour = type === 'EGG' ? 'border-tertiary-fixed-dim' : isVeg ? 'border-secondary' : 'border-error'
  const dot = type === 'EGG' ? 'bg-tertiary-fixed-dim' : isVeg ? 'bg-secondary' : 'bg-error'

  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 ${colour}`}
      title={isVeg ? 'Vegetarian' : type === 'EGG' ? 'Contains egg' : 'Non-vegetarian'}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
    </span>
  )
}
