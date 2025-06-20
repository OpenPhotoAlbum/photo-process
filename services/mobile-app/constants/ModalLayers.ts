/**
 * Modal Layer Z-Index System
 * 
 * Defines semantic page levels for modal stacking order.
 * Higher levels appear on top of lower levels.
 */

export const ModalLayers = {
  // Base application layer
  BASE: 0,
  
  // Level 1: Primary navigation modals
  L1_ALBUMS: 1000,
  
  // Level 2: Content detail modals  
  L2_ALBUM_DETAIL: 2000,
  L2_FACES: 2000,
  L2_FILTERS: 2000,
  
  // Level 3: Item detail modals (highest priority)
  L3_PHOTO_DETAIL: 3000,
  
  // Special overlays (always on top)
  OVERLAY_DEBUG: 9000,
  OVERLAY_SETTINGS: 9500,
  OVERLAY_ALERTS: 10000,
} as const;

export type ModalLayer = typeof ModalLayers[keyof typeof ModalLayers];

/**
 * Helper function to get z-index style object
 */
export const getModalStyle = (layer: ModalLayer) => ({
  zIndex: layer,
});

/**
 * Modal Layer Documentation:
 * 
 * L1 (1000): Primary navigation - Albums list, main sections
 * L2 (2000): Content detail - Album detail, Faces management  
 * L3 (3000): Item detail - Photo detail, individual item views
 * 
 * Overlays (9000+): System overlays, debug panels, alerts
 */