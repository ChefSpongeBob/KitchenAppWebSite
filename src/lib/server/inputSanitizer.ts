type PlainTextOptions = {
  maxLength: number;
  multiline?: boolean;
};

const BIDI_CONTROL_CHARACTERS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const CONTROL_CHARACTERS_EXCEPT_WHITESPACE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const CONTROL_CHARACTERS_EXCEPT_LINE_BREAKS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;

export function normalizePlainTextInput(
  value: FormDataEntryValue | string | number | null | undefined,
  options: PlainTextOptions
) {
  const maxLength = Math.max(0, Math.floor(options.maxLength));
  const raw = String(value ?? '').normalize('NFC');
  const withoutSpoofingControls = raw.replace(BIDI_CONTROL_CHARACTERS, '');
  const withoutControls = options.multiline
    ? withoutSpoofingControls.replace(CONTROL_CHARACTERS_EXCEPT_LINE_BREAKS, '')
    : withoutSpoofingControls.replace(CONTROL_CHARACTERS_EXCEPT_WHITESPACE, '');
  const normalizedLines = options.multiline
    ? withoutControls.replace(/\r\n?/g, '\n')
    : withoutControls.replace(/[\r\n\t]+/g, ' ');

  return normalizedLines.trim().slice(0, maxLength);
}

export function normalizeFormText(formData: FormData, key: string, options: PlainTextOptions) {
  return normalizePlainTextInput(formData.get(key), options);
}
