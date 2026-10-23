import { UI } from './ui';

let ui: UI | null = null;
export function getUI(): UI {
  if (!ui) ui = new UI();
  return ui;
}
