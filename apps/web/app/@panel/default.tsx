/**
 * Nothing is intercepted, so the slot renders nothing. Every route reached by a
 * hard load or a refresh lands here and shows its own full page instead.
 */
export default function PanelDefault() {
  return null;
}
