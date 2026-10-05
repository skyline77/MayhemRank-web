import { locale } from './locale'
import messages from './messages.json'
type Translations = [string, string, string]
const dictionary = messages as unknown as Record<string, Translations>
const translated = new Set(Object.values(dictionary).flat())
export const missingTranslations = new Set<string>()
export function t(value: unknown): string {
  const text = value == null ? '' : String(value)
  if (locale.value === 'zh-CN') return text
  const key = text.trim().replace(/\s+/g, ' ')
  const translation = (dictionary[text] || dictionary[key])?.[
    locale.value === 'zh-TW' ? 0 : locale.value === 'ja-JP' ? 1 : 2
  ]
  if (translation !== undefined) return translation
  if (translated.has(text)) return text
  if (!/[\u3400-\u9fff]/.test(text)) return text
  missingTranslations.add(key)
  return `⟦${locale.value}: ${text}⟧`
}
export function message(key: string, values: Record<string, string | number> = {}): string {
  return t(key).replace(/\{(\w+)\}/g, (_, name) =>
    typeof values[name] === 'string' && dictionary[values[name] as string]
      ? t(values[name])
      : String(values[name] ?? '{' + name + '}'),
  )
}
