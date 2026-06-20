type TavernWindow = Window & {
  TavernHelper?: {
    triggerSlash?: (command: string) => unknown;
  };
  triggerSlash?: (command: string) => unknown;
};

const inputSelectors = [
  '#send_textarea',
  'textarea#send_textarea',
  'textarea[name="send_textarea"]',
  'textarea[data-testid="send_textarea"]',
  'textarea',
  '[contenteditable="true"]',
];

const setNativeValue = (element: HTMLTextAreaElement | HTMLInputElement, value: string) => {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
};

const tryFillInput = (payload: string, targetWindow: Window | null | undefined) => {
  try {
    const doc = targetWindow?.document;
    if (!doc) return false;
    const element = inputSelectors
      .map(selector => doc.querySelector(selector))
      .find(Boolean) as HTMLTextAreaElement | HTMLInputElement | HTMLElement | null;

    if (!element) return false;

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      setNativeValue(element, payload);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.focus();
      return true;
    }

    element.textContent = payload;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: payload }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.focus();
    return true;
  } catch {
    return false;
  }
};

export const submitPayloadToSillyTavernInput = async (payload: string, clipboardStatus: string) => {
  const currentWindow = window as TavernWindow;
  const parentWindow = window.parent as TavernWindow | undefined;

  if (tryFillInput(payload, parentWindow) || tryFillInput(payload, currentWindow)) {
    return '已写入输入框';
  }

  const triggerSlash = currentWindow.TavernHelper?.triggerSlash
    || parentWindow?.TavernHelper?.triggerSlash
    || currentWindow.triggerSlash
    || parentWindow?.triggerSlash;

  if (typeof triggerSlash === 'function') {
    await triggerSlash(`/setinput ${payload}`);
    return '已写入输入框';
  }

  try {
    await navigator.clipboard?.writeText(payload);
    return clipboardStatus;
  } catch {
    return '载荷已生成';
  }
};
