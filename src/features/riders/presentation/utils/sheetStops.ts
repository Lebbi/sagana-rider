export const SHEET_EXPANDED_OFFSET = 110;
export const SHEET_DEFAULT_OFFSET = 380;
export const MIN_STOP_GAP = 24;

/**
 * Snap stops for the delivery sheet, top to bottom. The default stop is dropped
 * when peek sits on or above it (short screen, long item list), so peek never
 * hides it and the two stops never coincide.
 */
export function getSheetStops(peekOffset: number): number[] {
  return peekOffset - SHEET_DEFAULT_OFFSET > MIN_STOP_GAP
    ? [SHEET_EXPANDED_OFFSET, SHEET_DEFAULT_OFFSET, peekOffset]
    : [SHEET_EXPANDED_OFFSET, peekOffset];
}
